// dlq lists events consumers gave up on, and can send them back for another try.
//
//	go run ./cmd/dlq            list
//	go run ./cmd/dlq -replay    republish each to its original topic
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/segmentio/kafka-go"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
)

func main() {
	replay := flag.Bool("replay", false, "republish dead letters to their original topic")
	flag.Parse()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(*replay, log); err != nil {
		log.Error("dlq failed", "err", err)
		os.Exit(1)
	}
}

func run(replay bool, log *slog.Logger) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	cfg := config.FromEnv()
	if err := events.EnsureTopics(ctx, cfg.Brokers[0], events.Topics...); err != nil {
		return err
	}
	if !replay {
		return list(ctx, cfg.Brokers)
	}
	// a consumer group remembers what was replayed, so running this twice
	// does not send the same dead letter back twice.
	pub := events.NewProducer(cfg.Brokers)
	defer pub.Close()
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: cfg.Brokers, GroupID: "dlq-replay", Topic: events.DeadLetter,
		StartOffset: kafka.FirstOffset, MaxWait: 500 * time.Millisecond,
	})
	defer r.Close()
	n := 0
	for {
		wait, stop := context.WithTimeout(ctx, 3*time.Second)
		m, err := r.FetchMessage(wait)
		stop()
		if err != nil {
			log.Info("replay finished", "republished", n)
			return nil // no new dead letters within 3s
		}
		topic := header(m, "dlq-topic")
		if err := pub.WriteRaw(ctx, kafka.Message{Topic: topic, Key: m.Key, Value: m.Value}); err != nil {
			return err
		}
		if err := r.CommitMessages(ctx, m); err != nil {
			return err
		}
		n++
		log.Info("republished", "to", topic, "key", string(m.Key))
	}
}

// list reads every partition from the start without a consumer group, so it
// changes nothing.
func list(ctx context.Context, brokers []string) error {
	total := 0
	for p := range 3 {
		conn, err := kafka.DialLeader(ctx, "tcp", brokers[0], events.DeadLetter, p)
		if err != nil {
			return err
		}
		first, last, err := conn.ReadOffsets()
		if err != nil {
			conn.Close()
			return err
		}
		if _, err := conn.Seek(first, kafka.SeekAbsolute); err != nil {
			conn.Close()
			return err
		}
		for off := first; off < last; off++ {
			m, err := conn.ReadMessage(1 << 20)
			if err != nil {
				break
			}
			total++
			fmt.Printf("%s  from %s (group %s) job %s\n  error: %s\n",
				header(m, "dlq-at"), header(m, "dlq-topic"), header(m, "dlq-group"), m.Key, header(m, "dlq-error"))
		}
		conn.Close()
	}
	fmt.Printf("%d dead letter(s)\n", total)
	return nil
}

func header(m kafka.Message, key string) string {
	for _, h := range m.Headers {
		if h.Key == key {
			return string(h.Value)
		}
	}
	return ""
}
