package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/segmentio/kafka-go"
)

// Handler processes one event. returning an error retries it, unless the error
// is wrapped with Permanent.
type Handler func(ctx context.Context, e Event) error

type permanent struct{ err error }

func (p permanent) Error() string { return p.err.Error() }
func (p permanent) Unwrap() error { return p.err }

// Permanent marks an error that retrying cannot fix, like a bad payload or a 400.
func Permanent(err error) error {
	if err == nil {
		return nil
	}
	return permanent{err}
}

type ConsumerConfig struct {
	Brokers []string
	Group   string // consumers sharing a group split the partitions between them
	Topics  []string
	Retries int // attempts per event before giving up on it
	// DeadLetter receives messages that failed every retry. nil drops them.
	DeadLetter *Producer
	// DeadLetterTopic defaults to events.dlq. tests use their own.
	DeadLetterTopic string
	// ClientID names this consumer in kafka tools, for example checker-a.
	ClientID string
}

// Consume reads until ctx is cancelled. offsets are committed only after the
// handler succeeds (at-least-once), so a crash replays the event, never skips it.
// handlers must therefore be safe to run twice.
func Consume(ctx context.Context, cfg ConsumerConfig, handle Handler, log *slog.Logger) error {
	if cfg.Retries == 0 {
		cfg.Retries = 5
	}
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     cfg.Brokers,
		GroupID:     cfg.Group,
		GroupTopics: cfg.Topics,
		// a brand new group starts from the oldest event, so nothing is missed.
		StartOffset: kafka.FirstOffset,
		MaxWait:     500 * time.Millisecond,
		Dialer:      &kafka.Dialer{ClientID: cfg.ClientID, Timeout: 10 * time.Second},
	})
	defer r.Close()
	log.Info("consuming", "group", cfg.Group, "topics", cfg.Topics)

	for {
		// FetchMessage does not commit. ReadMessage would commit before handling.
		m, err := r.FetchMessage(ctx)
		if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
			return nil
		}
		if err != nil {
			return err
		}
		e, err := Decode(m)
		if err == nil {
			err = retry(ctx, cfg.Retries, func() error { return handle(ctx, e) })
		} else {
			// undecodable now means undecodable forever. park it, do not block the partition.
			err = Permanent(err)
		}
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			log.Error("giving up on event", "topic", m.Topic, "offset", m.Offset, "id", e.ID, "err", err)
			// if the dlq write fails, stop without committing: the event is retried on restart.
			if err := deadLetter(ctx, cfg, m, err); err != nil {
				return fmt.Errorf("dead letter: %w", err)
			}
		}
		if err := r.CommitMessages(ctx, m); err != nil && ctx.Err() == nil {
			return err
		}
	}
}

// deadLetter copies the failed message to the dlq with where it came from and why.
func deadLetter(ctx context.Context, cfg ConsumerConfig, m kafka.Message, cause error) error {
	if cfg.DeadLetter == nil {
		return nil
	}
	topic := cfg.DeadLetterTopic
	if topic == "" {
		topic = DeadLetter
	}
	return cfg.DeadLetter.WriteRaw(ctx, kafka.Message{
		Topic: topic,
		Key:   m.Key,
		Value: m.Value,
		Headers: append(m.Headers,
			kafka.Header{Key: "dlq-topic", Value: []byte(m.Topic)},
			kafka.Header{Key: "dlq-group", Value: []byte(cfg.Group)},
			kafka.Header{Key: "dlq-partition", Value: []byte(strconv.Itoa(m.Partition))},
			kafka.Header{Key: "dlq-offset", Value: []byte(strconv.FormatInt(m.Offset, 10))},
			kafka.Header{Key: "dlq-error", Value: []byte(cause.Error())},
			kafka.Header{Key: "dlq-at", Value: []byte(time.Now().UTC().Format(time.RFC3339))},
		),
	})
}

// retry backs off 200ms, 400ms, 800ms... between attempts.
func retry(ctx context.Context, attempts int, fn func() error) error {
	wait := 200 * time.Millisecond
	var err error
	for i := range attempts {
		if err = fn(); err == nil {
			return nil
		}
		var p permanent
		if errors.As(err, &p) || i == attempts-1 {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
			wait *= 2
		}
	}
	return err
}
