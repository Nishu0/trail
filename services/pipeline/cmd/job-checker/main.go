// job-checker consumes job.saved and job.stage_changed, checks the listing,
// stores the result in dynamodb and publishes job.health_checked.
//
//	go run ./cmd/job-checker
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"golang.org/x/time/rate"

	"trail/pipeline/internal/checker"
	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
	"trail/pipeline/internal/pipeline"
	"trail/pipeline/internal/store"
)

func main() {
	// more workers than partitions would sit idle: each partition has one reader per group.
	workers := flag.Int("workers", 3, "consumers in the group, at most one per partition")
	name := flag.String("name", "job-checker", "client id shown in kafka tools")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil)).With("process", *name)
	if err := run(*workers, *name, log); err != nil {
		log.Error("job-checker stopped", "err", err)
		os.Exit(1)
	}
}

func run(workers int, name string, log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.FromEnv()
	if len(cfg.Brokers) == 0 {
		return errors.New("KAFKA_BROKERS is off")
	}
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		return err
	}
	st := store.New(db, cfg.Table, cfg.User)
	if err := events.EnsureTopics(ctx, cfg.Brokers[0], events.Topics...); err != nil {
		return err
	}
	pub := events.NewProducer(cfg.Brokers)
	defer pub.Close()

	h := &handler{
		store: st,
		pub:   pub,
		check: checker.New(),
		// shared by all workers: at most 2 page fetches per second in total.
		limit: rate.NewLimiter(2, 2),
		log:   log,
	}
	var wg sync.WaitGroup
	errs := make(chan error, workers)
	for i := range workers {
		wl := log.With("worker", i)
		wg.Go(func() {
			errs <- events.Consume(ctx, events.ConsumerConfig{
				Brokers:    cfg.Brokers,
				Group:      "job-checker",
				Topics:     []string{events.JobSaved, events.JobStageChanged},
				DeadLetter: pub,
				ClientID:   name,
			}, h.handle, wl)
		})
	}
	wg.Wait()
	close(errs)
	return errors.Join(collect(errs)...)
}

type handler struct {
	store *store.Store
	pub   events.Publisher
	check *checker.Checker
	limit *rate.Limiter
	log   *slog.Logger
}

func (h *handler) handle(ctx context.Context, e events.Event) error {
	url, ok, err := h.urlToCheck(e)
	if err != nil || !ok {
		return err
	}
	if err := h.limit.Wait(ctx); err != nil {
		return err
	}
	result := h.check.Check(ctx, url)
	err = h.store.SetHealth(ctx, e.JobID, map[string]any{
		"status":    result.Status,
		"reason":    result.Reason,
		"url":       url,
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
	})
	if errors.Is(err, pipeline.ErrNotFound) {
		return nil // job removed since the event, nothing to do
	}
	if err != nil {
		return err
	}
	out, err := events.New(events.JobHealthCheck, e.JobID, e.Version, result)
	if err != nil {
		return err
	}
	h.log.Info("checked", "job", e.JobID, "partition", e.Partition, "status", result.Status, "reason", result.Reason)
	return h.pub.Publish(ctx, out)
}

// urlToCheck picks events worth a fetch: new jobs, and jobs moved back to Saved
// or into Applied (worth knowing before you write to them).
func (h *handler) urlToCheck(e events.Event) (string, bool, error) {
	switch e.Type {
	case events.JobSaved:
		var d events.JobSavedData
		if err := json.Unmarshal(e.Data, &d); err != nil {
			return "", false, events.Permanent(err)
		}
		return d.Job.URL, true, nil
	case events.JobStageChanged:
		var d events.StageChangedData
		if err := json.Unmarshal(e.Data, &d); err != nil {
			return "", false, events.Permanent(err)
		}
		return d.URL, d.To == pipeline.Saved || d.To == pipeline.Applied, nil
	}
	return "", false, nil
}

func collect(errs <-chan error) []error {
	var out []error
	for err := range errs {
		out = append(out, err)
	}
	return out
}
