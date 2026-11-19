// Package api serves the store over http with stdlib routing ("GET /jobs/{id}").
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"trail/pipeline/internal/pipeline"
)

// Store is what handlers need. *store.Store implements it, tests fake it.
type Store interface {
	ListJobs(context.Context) ([]pipeline.JobView, error)
	GetJob(context.Context, string) (pipeline.JobView, error)
	JobsByStage(context.Context, pipeline.Stage) ([]pipeline.JobView, error)
	DueFollowUps(context.Context, string) ([]pipeline.JobView, error)
	CreateJob(context.Context, pipeline.Job) (pipeline.JobView, error)
	ChangeStage(context.Context, string, pipeline.StageChange) (pipeline.JobView, error)
	AddDraft(context.Context, pipeline.Draft) (pipeline.Draft, error)
	UpdateDraft(ctx context.Context, jobID, draftID, subject, body string) (pipeline.Draft, error)
}

var date = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func New(s Store, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		write(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /jobs", func(w http.ResponseWriter, r *http.Request) {
		if stage := r.URL.Query().Get("stage"); stage != "" {
			reply(w, log)(s.JobsByStage(r.Context(), pipeline.Stage(stage)))
			return
		}
		reply(w, log)(s.ListJobs(r.Context()))
	})
	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		reply(w, log)(s.GetJob(r.Context(), r.PathValue("id")))
	})
	mux.HandleFunc("PUT /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		var j pipeline.Job
		if !decode(w, r, &j) {
			return
		}
		j.ID = r.PathValue("id")
		view, err := s.CreateJob(r.Context(), j)
		if err == nil {
			write(w, http.StatusCreated, view)
			return
		}
		fail(w, log, err)
	})
	mux.HandleFunc("PATCH /jobs/{id}/stage", func(w http.ResponseWriter, r *http.Request) {
		var c pipeline.StageChange
		if !decode(w, r, &c) {
			return
		}
		reply(w, log)(s.ChangeStage(r.Context(), r.PathValue("id"), c))
	})
	mux.HandleFunc("POST /jobs/{id}/drafts", func(w http.ResponseWriter, r *http.Request) {
		var d pipeline.Draft
		if !decode(w, r, &d) {
			return
		}
		d.JobID = r.PathValue("id")
		if d.ID == "" || d.Subject == "" || d.Body == "" {
			write(w, http.StatusBadRequest, apiError{"id, subject and body are required"})
			return
		}
		draft, err := s.AddDraft(r.Context(), d)
		if err == nil {
			write(w, http.StatusCreated, draft)
			return
		}
		fail(w, log, err)
	})
	mux.HandleFunc("PATCH /jobs/{id}/drafts/{draftId}", func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Subject, Body string }
		if !decode(w, r, &in) {
			return
		}
		reply(w, log)(s.UpdateDraft(r.Context(), r.PathValue("id"), r.PathValue("draftId"), in.Subject, in.Body))
	})
	mux.HandleFunc("GET /followups", func(w http.ResponseWriter, r *http.Request) {
		until := r.URL.Query().Get("until")
		if until == "" {
			until = time.Now().Format("2006-01-02")
		}
		if !date.MatchString(until) {
			write(w, http.StatusBadRequest, apiError{"until must be YYYY-MM-DD"})
			return
		}
		reply(w, log)(s.DueFollowUps(r.Context(), until))
	})
	return logRequests(mux, log)
}

type apiError struct {
	Error string `json:"error"`
}

func reply(w http.ResponseWriter, log *slog.Logger) func(any, error) {
	return func(v any, err error) {
		if err != nil {
			fail(w, log, err)
			return
		}
		write(w, http.StatusOK, v)
	}
}

func fail(w http.ResponseWriter, log *slog.Logger, err error) {
	switch {
	case errors.Is(err, pipeline.ErrNotFound):
		write(w, http.StatusNotFound, apiError{err.Error()})
	case errors.Is(err, pipeline.ErrConflict), errors.Is(err, pipeline.ErrExists):
		write(w, http.StatusConflict, apiError{err.Error()})
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		write(w, http.StatusServiceUnavailable, apiError{"request timed out"})
	default:
		var invalid *pipeline.InvalidError
		if errors.As(err, &invalid) {
			write(w, http.StatusBadRequest, apiError{err.Error()})
			return
		}
		log.Error("request failed", "err", err)
		write(w, http.StatusInternalServerError, apiError{"internal error"})
	}
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		write(w, http.StatusBadRequest, apiError{"invalid JSON: " + err.Error()})
		return false
	}
	return true
}

func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type recorder struct {
	http.ResponseWriter
	status int
}

func (r *recorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func logRequests(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &recorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status, "took", time.Since(start).String())
	})
}
