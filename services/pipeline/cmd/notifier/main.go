// notifier consumes followup.due and tells you. with -desktop it also shows a
// macos notification.
//
//	go run ./cmd/notifier -desktop
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
)

func main() {
	desktop := flag.Bool("desktop", false, "show a macos notification")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(*desktop, log); err != nil {
		log.Error("notifier stopped", "err", err)
		os.Exit(1)
	}
}

func run(desktop bool, log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.FromEnv()
	if len(cfg.Brokers) == 0 {
		return errors.New("KAFKA_BROKERS is off")
	}
	if err := events.EnsureTopics(ctx, cfg.Brokers[0], events.Topics...); err != nil {
		return err
	}
	dlq := events.NewProducer(cfg.Brokers)
	defer dlq.Close()
	return events.Consume(ctx, events.ConsumerConfig{
		Brokers:    cfg.Brokers,
		Group:      "notifier",
		Topics:     []string{events.FollowUpDue},
		DeadLetter: dlq,
	}, func(ctx context.Context, e events.Event) error {
		var d events.FollowUpDueData
		if err := json.Unmarshal(e.Data, &d); err != nil {
			return events.Permanent(err)
		}
		msg := fmt.Sprintf("follow up with %s (%s), due %s", d.Company, d.Role, d.Date)
		log.Info("reminder", "msg", msg)
		if desktop && runtime.GOOS == "darwin" {
			return notify(ctx, "Trail", msg)
		}
		return nil
	}, log)
}

// notify runs osascript. company names are user data, so quotes and
// backslashes are escaped before going into the applescript string.
func notify(ctx context.Context, title, msg string) error {
	esc := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	script := fmt.Sprintf(`display notification "%s" with title "%s"`, esc.Replace(msg), esc.Replace(title))
	return exec.CommandContext(ctx, "osascript", "-e", script).Run()
}
