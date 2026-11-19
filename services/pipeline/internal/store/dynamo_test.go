package store

// integration tests on dynamodb local. each run uses its own table and drops it.
// skipped when dynamodb local is not running:
//
//	docker compose -f services/docker-compose.yml up -d dynamodb

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"testing"
	"time"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/pipeline"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	cfg := config.FromEnv()
	conn, err := net.DialTimeout("tcp", "localhost:8000", 300*time.Millisecond)
	if err != nil {
		t.Skip("DynamoDB Local is not running on :8000")
	}
	conn.Close()
	ctx := context.Background()
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		t.Fatal(err)
	}
	s := New(db, fmt.Sprintf("test-%d", time.Now().UnixNano()), "me")
	if err := s.EnsureTable(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.DeleteTable(context.Background()) })
	return s
}

func job(id, company string) pipeline.Job {
	return pipeline.Job{ID: id, Company: company, Role: "Backend Engineer", Source: "YC", Stage: pipeline.Saved}
}

func TestCreateListAndGet(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	for _, j := range []pipeline.Job{job("j1", "Acme"), job("j2", "Globex")} {
		if _, err := s.CreateJob(ctx, j); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.CreateJob(ctx, job("j1", "Acme")); !errors.Is(err, pipeline.ErrExists) {
		t.Fatalf("second create = %v, want ErrExists", err)
	}
	if _, err := s.AddDraft(ctx, pipeline.Draft{ID: "d1", JobID: "j1", Subject: "hi", Body: "first", CreatedAt: "2026-11-01T00:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddDraft(ctx, pipeline.Draft{ID: "d2", JobID: "j1", Subject: "hi", Body: "second", CreatedAt: "2026-11-02T00:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	all, err := s.ListJobs(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("ListJobs returned %d jobs, want 2", len(all))
	}
	got, err := s.GetJob(ctx, "j1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Drafts) != 2 || got.Drafts[0].ID != "d2" {
		t.Fatalf("drafts = %+v, want d2 first", got.Drafts)
	}
	if _, err := s.GetJob(ctx, "missing"); !errors.Is(err, pipeline.ErrNotFound) {
		t.Fatalf("missing job = %v, want ErrNotFound", err)
	}
	if _, err := s.AddDraft(ctx, pipeline.Draft{ID: "d3", JobID: "missing", Subject: "s", Body: "b"}); !errors.Is(err, pipeline.ErrNotFound) {
		t.Fatalf("draft for missing job = %v, want ErrNotFound", err)
	}
}

func TestFollowUpQueueAndStageIndex(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	for _, id := range []string{"a", "b", "c"} {
		if _, err := s.CreateJob(ctx, job(id, "Co "+id)); err != nil {
			t.Fatal(err)
		}
	}
	date := func(d string) *string { return &d }
	mustMove := func(id string, c pipeline.StageChange) {
		if _, _, err := s.ChangeStage(ctx, id, c); err != nil {
			t.Fatal(err)
		}
	}
	mustMove("a", pipeline.StageChange{Stage: pipeline.Applied, FollowUp: date("2026-11-20")})
	mustMove("b", pipeline.StageChange{Stage: pipeline.Applied, FollowUp: date("2026-11-25")})

	due, err := s.DueFollowUps(ctx, "2026-11-22")
	if err != nil {
		t.Fatal(err)
	}
	if len(due) != 1 || due[0].ID != "a" {
		t.Fatalf("due = %+v, want only a", due)
	}
	// archiving removes the job from the sparse index.
	mustMove("a", pipeline.StageChange{Stage: pipeline.Archived})
	if due, _ = s.DueFollowUps(ctx, "2026-12-31"); len(due) != 1 || due[0].ID != "b" {
		t.Fatalf("after archive due = %+v, want only b", due)
	}
	applied, err := s.JobsByStage(ctx, pipeline.Applied)
	if err != nil {
		t.Fatal(err)
	}
	if len(applied) != 1 || applied[0].ID != "b" {
		t.Fatalf("applied = %+v, want only b", applied)
	}
	if got, _ := s.GetJob(ctx, "b"); got.AppliedAt == "" || got.Version != 2 {
		t.Fatalf("b = %+v, want appliedAt set and version 2", got)
	}
}

// two writers start from the same version, exactly one wins.
func TestOptimisticLocking(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	if _, err := s.CreateJob(ctx, job("j1", "Acme")); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make([]error, 2)
	for i, stage := range []pipeline.Stage{pipeline.Applied, pipeline.Archived} {
		wg.Go(func() {
			_, _, results[i] = s.ChangeStage(ctx, "j1", pipeline.StageChange{Stage: stage, ExpectedVersion: 1})
		})
	}
	wg.Wait()
	wins, conflicts := 0, 0
	for _, err := range results {
		switch {
		case err == nil:
			wins++
		case errors.Is(err, pipeline.ErrConflict):
			conflicts++
		default:
			t.Fatal(err)
		}
	}
	if wins != 1 || conflicts != 1 {
		t.Fatalf("wins=%d conflicts=%d, want 1 and 1", wins, conflicts)
	}
}

func TestUpdateDraft(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	if _, err := s.CreateJob(ctx, job("j1", "Acme")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddDraft(ctx, pipeline.Draft{ID: "d1", JobID: "j1", Subject: "old", Body: "old"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpdateDraft(ctx, "j1", "d1", "new subject", "new body"); err != nil {
		t.Fatal(err)
	}
	got, _ := s.GetJob(ctx, "j1")
	if got.Drafts[0].Subject != "new subject" || got.Drafts[0].UpdatedAt == "" {
		t.Fatalf("draft = %+v", got.Drafts[0])
	}
	if _, err := s.UpdateDraft(ctx, "j1", "nope", "s", "b"); !errors.Is(err, pipeline.ErrNotFound) {
		t.Fatalf("unknown draft = %v, want ErrNotFound", err)
	}
}

func TestHealthAndStageDoNotCollide(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	if _, err := s.CreateJob(ctx, job("j1", "Acme")); err != nil {
		t.Fatal(err)
	}
	// the checker writes health while the page still holds version 1.
	if err := s.SetHealth(ctx, "j1", map[string]any{"status": "closed"}); err != nil {
		t.Fatal(err)
	}
	date := "2026-12-01"
	if _, _, err := s.ChangeStage(ctx, "j1", pipeline.StageChange{Stage: pipeline.Applied, FollowUp: &date, ExpectedVersion: 1}); err != nil {
		t.Fatalf("stage change after health write = %v, want success", err)
	}
	got, _ := s.GetJob(ctx, "j1")
	if got.Health["status"] != "closed" || got.Stage != pipeline.Applied || got.Version != 2 {
		t.Fatalf("got stage=%s health=%v version=%d", got.Stage, got.Health, got.Version)
	}
	if err := s.SetHealth(ctx, "missing", nil); !errors.Is(err, pipeline.ErrNotFound) {
		t.Fatalf("missing = %v, want ErrNotFound", err)
	}
}

// the flag fires once per date, however many schedulers run the sweep.
func TestMarkFollowUpDueOnce(t *testing.T) {
	s, ctx := newTestStore(t), context.Background()
	if _, err := s.CreateJob(ctx, job("j1", "Acme")); err != nil {
		t.Fatal(err)
	}
	date := "2026-11-20"
	if _, _, err := s.ChangeStage(ctx, "j1", pipeline.StageChange{Stage: pipeline.Applied, FollowUp: &date}); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	wins := make(chan bool, 5)
	for range 5 {
		wg.Go(func() {
			ok, err := s.MarkFollowUpDue(ctx, "j1", date)
			if err != nil {
				t.Error(err)
			}
			wins <- ok
		})
	}
	wg.Wait()
	close(wins)
	n := 0
	for ok := range wins {
		if ok {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("%d schedulers flagged it, want exactly 1", n)
	}
	if ok, _ := s.MarkFollowUpDue(ctx, "j1", "2026-11-21"); ok {
		t.Fatal("a date that is not the job's follow-up must not flag")
	}
}
