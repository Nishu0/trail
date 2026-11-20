// postgres-sync consumes job.stage_changed and copies the new stage into the
// next.js app (postgres), so the overview page and sidebar stay current.
//
//	go run ./cmd/postgres-sync
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("postgres-sync stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.FromEnv()
	if len(cfg.Brokers) == 0 {
		return errors.New("KAFKA_BROKERS is off")
	}
	if err := events.EnsureTopics(ctx, cfg.Brokers[0], events.Topics...); err != nil {
		return err
	}
	s := &syncer{next: cfg.NextURL, http: &http.Client{Timeout: 10 * time.Second}, log: log}
	dlq := events.NewProducer(cfg.Brokers)
	defer dlq.Close()
	return events.Consume(ctx, events.ConsumerConfig{
		Brokers:    cfg.Brokers,
		Group:      "postgres-sync",
		Topics:     []string{events.JobStageChanged},
		DeadLetter: dlq,
	}, s.handle, log)
}

type syncer struct {
	next string
	http *http.Client
	log  *slog.Logger
}

// handle is idempotent: setting the same stage twice leaves postgres the same,
// so a replayed event is harmless. events for one job arrive in order because
// they share a partition, so the last stage written is the last one applied.
func (s *syncer) handle(ctx context.Context, e events.Event) error {
	var d events.StageChangedData
	if err := json.Unmarshal(e.Data, &d); err != nil {
		return events.Permanent(err)
	}
	body := map[string]any{"action": "job", "id": e.JobID, "stage": d.To, "followUp": d.FollowUp}
	if d.Channel != "" {
		body["channel"] = d.Channel
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, s.next+"/api/workspace", bytes.NewReader(raw))
	if err != nil {
		return events.Permanent(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := s.http.Do(req)
	if err != nil {
		return err // app down: retry
	}
	defer res.Body.Close()
	if res.StatusCode >= 500 {
		return fmt.Errorf("next.js answered %d", res.StatusCode)
	}
	if res.StatusCode >= 400 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 300))
		return events.Permanent(fmt.Errorf("next.js rejected it (%d): %s", res.StatusCode, msg))
	}
	s.log.Info("synced to postgres", "job", e.JobID, "stage", d.To)
	return nil
}
