// import copies jobs and drafts from the next.js app (postgres) into dynamodb.
// postgres is only read. reruns skip what already exists.
//
//	go run ./cmd/import -from http://127.0.0.1:3002
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/pipeline"
	"trail/pipeline/internal/store"
)

type workspace struct {
	Jobs []struct {
		pipeline.Job
		Sample bool `json:"sample"`
	} `json:"jobs"`
	Drafts []pipeline.Draft `json:"drafts"`
}

func main() {
	from := flag.String("from", "http://127.0.0.1:3002", "Next.js app URL")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(*from, log); err != nil {
		log.Error("import failed", "err", err)
		os.Exit(1)
	}
}

func run(from string, log *slog.Logger) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, from+"/api/workspace", nil)
	if err != nil {
		return err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("is the Next.js app running at %s? %w", from, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("workspace returned %s", res.Status)
	}
	var ws workspace
	if err := json.NewDecoder(res.Body).Decode(&ws); err != nil {
		return err
	}

	cfg := config.FromEnv()
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		return err
	}
	st := store.New(db, cfg.Table, cfg.User)
	if err := st.EnsureTable(ctx); err != nil {
		return err
	}

	var jobs, drafts, skipped int
	for _, j := range ws.Jobs {
		if j.Sample {
			continue
		}
		_, err := st.CreateJob(ctx, j.Job)
		switch {
		case errors.Is(err, pipeline.ErrExists):
			skipped++
		case err != nil:
			return fmt.Errorf("job %s (%s): %w", j.ID, j.Company, err)
		default:
			jobs++
		}
	}
	for _, d := range ws.Drafts {
		_, err := st.AddDraft(ctx, d)
		switch {
		case errors.Is(err, pipeline.ErrExists), errors.Is(err, pipeline.ErrNotFound):
			skipped++
		case err != nil:
			return fmt.Errorf("draft %s: %w", d.ID, err)
		default:
			drafts++
		}
	}
	log.Info("import finished", "jobs", jobs, "drafts", drafts, "skipped", skipped)
	return nil
}
