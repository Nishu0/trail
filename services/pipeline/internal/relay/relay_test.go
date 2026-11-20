package relay

// end to end on dynamodb local: write items, let the relay read the stream,
// check the events it would publish. skipped when dynamodb local is not running.

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"sync"
	"testing"
	"time"

	"trail/pipeline/internal/config"
	"trail/pipeline/internal/events"
	"trail/pipeline/internal/pipeline"
	"trail/pipeline/internal/store"
)

type capture struct {
	mu  sync.Mutex
	got []events.Event
}

func (c *capture) Publish(_ context.Context, evs ...events.Event) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.got = append(c.got, evs...)
	return nil
}
func (c *capture) Close() error { return nil }
func (c *capture) types() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return typeNames(c.got)
}

func TestRelayReadsStream(t *testing.T) {
	conn, err := net.DialTimeout("tcp", "localhost:8000", 300*time.Millisecond)
	if err != nil {
		t.Skip("DynamoDB Local is not running on :8000")
	}
	conn.Close()
	ctx := context.Background()
	cfg := config.FromEnv()
	db, _ := cfg.Dynamo(ctx)
	streams, _ := cfg.Streams(ctx)
	table := fmt.Sprintf("relay-test-%d", time.Now().UnixNano())
	st := store.New(db, table, "me")
	if err := st.EnsureTable(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.DeleteTable(context.Background()) })

	j := pipeline.Job{ID: "j1", Company: "Acme", Role: "Backend", Source: "YC", Stage: pipeline.Saved}
	if _, err := st.CreateJob(ctx, j); err != nil {
		t.Fatal(err)
	}
	date := "2026-11-20"
	if _, _, err := st.ChangeStage(ctx, "j1", pipeline.StageChange{Stage: pipeline.Applied, FollowUp: &date}); err != nil {
		t.Fatal(err)
	}
	if err := st.SetHealth(ctx, "j1", map[string]any{"status": "open"}); err != nil {
		t.Fatal(err)
	}
	if ok, err := st.MarkFollowUpDue(ctx, "j1", date); !ok || err != nil {
		t.Fatalf("mark = %v, %v", ok, err)
	}

	arn, err := st.StreamARN(ctx)
	if err != nil {
		t.Fatal(err)
	}
	pub := &capture{}
	r := &Relay{
		Streams: streams, DB: db, StreamARN: arn, Table: table + "-cp", Pub: pub,
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)), Poll: 100 * time.Millisecond,
	}
	if err := r.EnsureCheckpointTable(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.New(db, table+"-cp", "me").DeleteTable(context.Background()) })
	run, stop := context.WithCancel(ctx)
	go r.Run(run)
	defer stop()

	want := []string{events.JobSaved, events.JobStageChanged, events.FollowUpDue}
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) && len(pub.types()) < len(want) {
		time.Sleep(100 * time.Millisecond)
	}
	got := pub.types()
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("relayed %v, want %v (the health write is not an event)", got, want)
	}
}
