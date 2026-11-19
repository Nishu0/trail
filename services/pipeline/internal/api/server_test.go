package api

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"trail/pipeline/internal/pipeline"
)

// fakeStore tests the http layer without dynamodb.
type fakeStore struct {
	Store
	err error
}

func (f fakeStore) GetJob(context.Context, string) (pipeline.JobView, error) {
	return pipeline.JobView{Job: pipeline.Job{ID: "j1"}}, f.err
}
func (f fakeStore) ChangeStage(_ context.Context, _ string, c pipeline.StageChange) (pipeline.JobView, error) {
	if f.err != nil {
		return pipeline.JobView{}, f.err
	}
	j, err := pipeline.Job{ID: "j1"}.Apply(c, time.Now())
	return pipeline.JobView{Job: j}, err
}

func TestErrorMapping(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"ok", nil, http.StatusOK},
		{"missing", pipeline.ErrNotFound, http.StatusNotFound},
		{"conflict", pipeline.ErrConflict, http.StatusConflict},
		{"invalid", pipeline.Invalid("bad"), http.StatusBadRequest},
		{"unexpected", io.ErrUnexpectedEOF, http.StatusInternalServerError},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := New(fakeStore{err: c.err}, log)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/jobs/j1", nil))
			if rec.Code != c.want {
				t.Fatalf("status = %d, want %d", rec.Code, c.want)
			}
		})
	}
}

func TestRejectsUnknownFields(t *testing.T) {
	h := New(fakeStore{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"stage":"Applied","stagee":"typo"}`)
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPatch, "/jobs/j1/stage", body))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for a misspelt field", rec.Code)
	}
}
