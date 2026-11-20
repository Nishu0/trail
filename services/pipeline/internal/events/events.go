// Package events defines the kafka topics, the event envelope and a producer.
//
// every event is keyed by job id, so all events for one job land on the same
// partition and are read in the order they were written.
package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

const (
	JobSaved        = "job.saved"
	JobStageChanged = "job.stage_changed"
	DraftCreated    = "draft.created"
	JobHealthCheck  = "job.health_checked"
	FollowUpDue     = "followup.due"
	// DeadLetter holds events a consumer gave up on, with the reason in headers.
	DeadLetter = "events.dlq"
	// partitions set the max number of consumers in one group that can work in parallel.
	partitions = 3
)

var Topics = []string{JobSaved, JobStageChanged, DraftCreated, JobHealthCheck, FollowUpDue, DeadLetter}

// Event is the envelope on every topic. data holds the payload for that type.
type Event struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	JobID      string          `json:"jobId"`
	Version    int             `json:"version,omitempty"`
	OccurredAt time.Time       `json:"occurredAt"`
	Data       json.RawMessage `json:"data"`
	// Partition is where the event was read from. not part of the message.
	Partition int `json:"-"`
}

// New builds an event. the id lets consumers drop duplicates.
func New(typ, jobID string, version int, data any) (Event, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return Event{}, err
	}
	return Event{
		ID:         uuid.NewString(),
		Type:       typ,
		JobID:      jobID,
		Version:    version,
		OccurredAt: time.Now().UTC(),
		Data:       raw,
	}, nil
}

func Decode(m kafka.Message) (Event, error) {
	var e Event
	if err := json.Unmarshal(m.Value, &e); err != nil {
		return Event{}, fmt.Errorf("decode %s offset %d: %w", m.Topic, m.Offset, err)
	}
	e.Partition = m.Partition
	return e, nil
}

// WithID replaces the random id, so the same source change always gives the
// same event id and consumers can spot a replayed duplicate.
func (e Event) WithID(id string) Event {
	e.ID = id
	return e
}

// Publisher is what the api needs. Producer implements it, Nop disables kafka.
type Publisher interface {
	Publish(ctx context.Context, events ...Event) error
	Close() error
}

type Producer struct{ w *kafka.Writer }

func NewProducer(brokers []string) *Producer {
	return &Producer{w: &kafka.Writer{
		Addr: kafka.TCP(brokers...),
		// hash on the key: same job id, same partition, ordered.
		Balancer:     &kafka.Hash{},
		RequiredAcks: kafka.RequireAll,
		BatchTimeout: 10 * time.Millisecond,
	}}
}

func (p *Producer) Publish(ctx context.Context, events ...Event) error {
	msgs := make([]kafka.Message, 0, len(events))
	for _, e := range events {
		value, err := json.Marshal(e)
		if err != nil {
			return err
		}
		msgs = append(msgs, kafka.Message{
			Topic: e.Type,
			Key:   []byte(e.JobID),
			Value: value,
			Headers: []kafka.Header{
				{Key: "event-id", Value: []byte(e.ID)},
			},
		})
	}
	return p.w.WriteMessages(ctx, msgs...)
}

// WriteRaw sends messages as they are. used to move a message to the dlq untouched.
func (p *Producer) WriteRaw(ctx context.Context, msgs ...kafka.Message) error {
	return p.w.WriteMessages(ctx, msgs...)
}

func (p *Producer) Close() error { return p.w.Close() }

// Nop drops events. used when KAFKA_BROKERS is empty.
type Nop struct{}

func (Nop) Publish(context.Context, ...Event) error { return nil }
func (Nop) Close() error                            { return nil }

// controllerConn opens a connection to the controller broker, which handles topic admin.
func controllerConn(ctx context.Context, broker string) (*kafka.Conn, error) {
	conn, err := (&kafka.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "tcp", broker)
	if err != nil {
		return nil, fmt.Errorf("dial kafka: %w", err)
	}
	defer conn.Close()
	controller, err := conn.Controller()
	if err != nil {
		return nil, err
	}
	return kafka.DialContext(ctx, "tcp", net.JoinHostPort(controller.Host, strconv.Itoa(controller.Port)))
}

// EnsureTopics creates any missing topic.
func EnsureTopics(ctx context.Context, broker string, topics ...string) error {
	cc, err := controllerConn(ctx, broker)
	if err != nil {
		return err
	}
	defer cc.Close()
	configs := make([]kafka.TopicConfig, 0, len(topics))
	for _, t := range topics {
		configs = append(configs, kafka.TopicConfig{Topic: t, NumPartitions: partitions, ReplicationFactor: 1})
	}
	err = cc.CreateTopics(configs...)
	if errors.Is(err, kafka.TopicAlreadyExists) {
		return nil
	}
	return err
}
