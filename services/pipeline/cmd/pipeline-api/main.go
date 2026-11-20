// pipeline-api serves the job pipeline from dynamodb.
//
//	go run ./cmd/pipeline-api
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trail/pipeline/internal/api"
	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
	"trail/pipeline/internal/service"
	"trail/pipeline/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("pipeline-api stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	// ctx is cancelled on ctrl-c or sigterm, which starts graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.FromEnv()
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		return err
	}
	st := store.New(db, cfg.Table, cfg.User)
	setup, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := st.EnsureTable(setup); err != nil {
		return err
	}

	// with streams the relay publishes; the api only writes dynamodb.
	var pub events.Publisher = events.Nop{}
	if len(cfg.Brokers) > 0 && cfg.EventSource == "direct" {
		if err := events.EnsureTopics(setup, cfg.Brokers[0], events.Topics...); err != nil {
			return err
		}
		pub = events.NewProducer(cfg.Brokers)
	}
	defer pub.Close()

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.New(service.New(st, pub, log), log),
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
	}
	errs := make(chan error, 1)
	go func() {
		log.Info("pipeline-api listening", "addr", cfg.Addr, "table", cfg.Table, "events", cfg.EventSource)
		errs <- srv.ListenAndServe()
	}()

	select {
	case err := <-errs:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down; finishing in-flight requests")
		done, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(done)
	}
	return nil
}
