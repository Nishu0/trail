package events

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

func TestRetryStopsOnPermanent(t *testing.T) {
	calls := 0
	err := retry(context.Background(), 5, func() error {
		calls++
		return Permanent(errors.New("bad payload"))
	})
	if calls != 1 || err == nil {
		t.Fatalf("calls=%d err=%v, want 1 call and an error", calls, err)
	}
}

func TestRetryRecovers(t *testing.T) {
	calls := 0
	err := retry(context.Background(), 5, func() error {
		calls++
		if calls < 3 {
			return errors.New("broker busy")
		}
		return nil
	})
	if err != nil || calls != 3 {
		t.Fatalf("calls=%d err=%v, want success on try 3", calls, err)
	}
}

// round trip through the local broker. skipped when kafka is not running:
//
//	docker compose -f services/docker-compose.yml up -d kafka
func TestPublishAndConsume(t *testing.T) {
	conn, err := net.DialTimeout("tcp", "localhost:9092", 300*time.Millisecond)
	if err != nil {
		t.Skip("kafka is not running on :9092")
	}
	conn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	topic := fmt.Sprintf("test.events.%d", time.Now().UnixNano())
	if err := EnsureTopics(ctx, "localhost:9092", topic); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if cc, err := controllerConn(context.Background(), "localhost:9092"); err == nil {
			_ = cc.DeleteTopics(topic)
			cc.Close()
		}
	})
	p := NewProducer([]string{"localhost:9092"})
	defer p.Close()
	var sent []Event
	for i := range 3 {
		e, _ := New(topic, "job-1", i+1, map[string]int{"n": i})
		sent = append(sent, e)
	}
	if err := p.Publish(ctx, sent...); err != nil {
		t.Fatal(err)
	}

	got := make(chan Event, 3)
	cctx, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() {
		done <- Consume(cctx, ConsumerConfig{
			Brokers: []string{"localhost:9092"},
			Group:   topic + ".group",
			Topics:  []string{topic},
		}, func(_ context.Context, e Event) error {
			got <- e
			return nil
		}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	}()
	// same key, same partition, so they must arrive in the order sent.
	for i := range 3 {
		select {
		case e := <-got:
			if e.ID != sent[i].ID {
				t.Fatalf("event %d out of order: got version %d", i, e.Version)
			}
		case <-ctx.Done():
			t.Fatal("timed out waiting for events")
		}
	}
	stop()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

// a handler that always fails sends the message to the dead-letter topic with
// the reason, then moves on instead of blocking the partition.
func TestDeadLetter(t *testing.T) {
	conn, err := net.DialTimeout("tcp", "localhost:9092", 300*time.Millisecond)
	if err != nil {
		t.Skip("kafka is not running on :9092")
	}
	conn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	stamp := time.Now().UnixNano()
	topic, dlq := fmt.Sprintf("test.in.%d", stamp), fmt.Sprintf("test.dlq.%d", stamp)
	if err := EnsureTopics(ctx, "localhost:9092", topic, dlq); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if cc, err := controllerConn(context.Background(), "localhost:9092"); err == nil {
			_ = cc.DeleteTopics(topic, dlq)
			cc.Close()
		}
	})
	p := NewProducer([]string{"localhost:9092"})
	defer p.Close()
	bad, _ := New(topic, "job-1", 1, map[string]string{"x": "y"})
	good, _ := New(topic, "job-1", 2, map[string]string{"x": "y"})
	// a just-created topic takes a moment to show up in broker metadata.
	if err := retry(ctx, 10, func() error { return p.Publish(ctx, bad, good) }); err != nil {
		t.Fatal(err)
	}

	handled := make(chan string, 2)
	cctx, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() {
		done <- Consume(cctx, ConsumerConfig{
			Brokers: []string{"localhost:9092"}, Group: topic + ".g", Topics: []string{topic},
			DeadLetter: p, DeadLetterTopic: dlq,
		}, func(_ context.Context, e Event) error {
			if e.ID == bad.ID {
				return Permanent(errors.New("cannot handle"))
			}
			handled <- e.ID
			return nil
		}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	}()
	select {
	case id := <-handled:
		if id != good.ID {
			t.Fatalf("handled %s, want the good event", id)
		}
	case <-ctx.Done():
		t.Fatal("the bad event blocked the partition")
	}
	stop()
	<-done

	r := kafka.NewReader(kafka.ReaderConfig{Brokers: []string{"localhost:9092"}, Topic: dlq, Partition: partitionOf(t, dlq), MaxWait: 500 * time.Millisecond})
	defer r.Close()
	m, err := r.ReadMessage(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var reason, from string
	for _, h := range m.Headers {
		switch h.Key {
		case "dlq-error":
			reason = string(h.Value)
		case "dlq-topic":
			from = string(h.Value)
		}
	}
	if reason != "cannot handle" || from != topic {
		t.Fatalf("dlq headers error=%q topic=%q", reason, from)
	}
}

// partitionOf finds the partition holding key "job-1" by checking which has data.
func partitionOf(t *testing.T, topic string) int {
	t.Helper()
	for p := range partitions {
		c, err := kafka.DialLeader(context.Background(), "tcp", "localhost:9092", topic, p)
		if err != nil {
			t.Fatal(err)
		}
		last, _ := c.ReadLastOffset()
		c.Close()
		if last > 0 {
			return p
		}
	}
	t.Fatal("no partition has the dead letter")
	return 0
}
