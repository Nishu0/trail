// stream-relay reads the dynamodb stream of the pipeline table and publishes
// each change to kafka. it replaces publishing from the api.
//
//	go run ./cmd/stream-relay
package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
	"trail/pipeline/internal/relay"
	"trail/pipeline/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("stream-relay stopped", "err", err)
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
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		return err
	}
	streams, err := cfg.Streams(ctx)
	if err != nil {
		return err
	}
	st := store.New(db, cfg.Table, cfg.User)
	if err := st.EnsureTable(ctx); err != nil {
		return err
	}
	arn, err := st.StreamARN(ctx)
	if err != nil {
		return err
	}
	if err := events.EnsureTopics(ctx, cfg.Brokers[0], events.Topics...); err != nil {
		return err
	}
	pub := events.NewProducer(cfg.Brokers)
	defer pub.Close()
	r := &relay.Relay{
		Streams:   streams,
		DB:        db,
		StreamARN: arn,
		Table:     cfg.Table + "-relay-checkpoints",
		Pub:       pub,
		Log:       log,
	}
	if err := r.EnsureCheckpointTable(ctx); err != nil {
		return err
	}
	return r.Run(ctx)
}
