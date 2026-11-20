// followup-scheduler finds follow-ups that are due and flags them once.
// it never talks to kafka: flagging changes the item, the stream sees the
// change and the relay publishes followup.due.
//
//	go run ./cmd/followup-scheduler -every 1m
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/store"
)

func main() {
	every := flag.Duration("every", time.Minute, "how often to look for due follow-ups")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(*every, log); err != nil {
		log.Error("followup-scheduler stopped", "err", err)
		os.Exit(1)
	}
}

func run(every time.Duration, log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.FromEnv()
	db, err := cfg.Dynamo(ctx)
	if err != nil {
		return err
	}
	st := store.New(db, cfg.Table, cfg.User)
	// follow-up dates are india dates, matching the next.js app.
	ist, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		return err
	}
	tick := time.NewTicker(every)
	defer tick.Stop()
	for {
		sweep(ctx, st, time.Now().In(ist).Format("2006-01-02"), log)
		select {
		case <-ctx.Done():
			return nil
		case <-tick.C:
		}
	}
}

// sweep is safe to run as often as you like, or from two processes at once:
// the conditional write lets exactly one flag win per job and date.
func sweep(ctx context.Context, st *store.Store, today string, log *slog.Logger) {
	due, err := st.DueFollowUps(ctx, today)
	if err != nil {
		log.Error("query due follow-ups", "err", err)
		return
	}
	for _, j := range due {
		marked, err := st.MarkFollowUpDue(ctx, j.ID, j.FollowUp)
		switch {
		case err != nil:
			log.Error("flag follow-up", "job", j.ID, "err", err)
		case marked:
			log.Info("follow-up due", "company", j.Company, "date", j.FollowUp)
		}
	}
}
