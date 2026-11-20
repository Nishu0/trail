package relay

import (
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodbstreams/types"

	"trail/pipeline/internal/events"
)

func s(v string) types.AttributeValue { return &types.AttributeValueMemberS{Value: v} }

func job(stage, due string) map[string]types.AttributeValue {
	img := map[string]types.AttributeValue{
		"Type": s("Job"), "id": s("j1"), "company": s("Acme"), "role": s("Backend"),
		"stage": s(stage), "Version": &types.AttributeValueMemberN{Value: "2"},
	}
	if due != "" {
		img["followUpDue"] = s(due)
	}
	return img
}

func record(op types.OperationType, old, now map[string]types.AttributeValue) types.Record {
	return types.Record{
		EventID:   aws.String("rec-1"),
		EventName: op,
		Dynamodb:  &types.StreamRecord{OldImage: old, NewImage: now},
	}
}

func typeNames(evs []events.Event) []string {
	out := []string{}
	for _, e := range evs {
		out = append(out, e.Type)
	}
	return out
}

func TestConvert(t *testing.T) {
	cases := []struct {
		name string
		rec  types.Record
		want []string
	}{
		{"insert job", record(types.OperationTypeInsert, nil, job("Saved", "")), []string{events.JobSaved}},
		{"stage change", record(types.OperationTypeModify, job("Saved", ""), job("Applied", "")), []string{events.JobStageChanged}},
		{"follow-up flagged", record(types.OperationTypeModify, job("Applied", ""), job("Applied", "2026-12-01")), []string{events.FollowUpDue}},
		{"health only", record(types.OperationTypeModify, job("Saved", ""), job("Saved", "")), []string{}},
		{"remove", record(types.OperationTypeRemove, job("Saved", ""), nil), []string{}},
		{"draft", record(types.OperationTypeInsert, nil, map[string]types.AttributeValue{
			"Type": s("Draft"), "id": s("d1"), "jobId": s("j1"), "mode": s("ai"),
		}), []string{events.DraftCreated}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			evs, err := Convert(c.rec)
			if err != nil {
				t.Fatal(err)
			}
			got := typeNames(evs)
			if len(got) != len(c.want) || (len(got) > 0 && got[0] != c.want[0]) {
				t.Fatalf("got %v, want %v", got, c.want)
			}
		})
	}
}

// the event id comes from the stream record, so a replay gives the same id.
func TestEventIDIsStable(t *testing.T) {
	rec := record(types.OperationTypeInsert, nil, job("Saved", ""))
	a, _ := Convert(rec)
	b, _ := Convert(rec)
	if a[0].ID != b[0].ID || a[0].ID != "rec-1#job.saved" {
		t.Fatalf("ids %q and %q, want both rec-1#job.saved", a[0].ID, b[0].ID)
	}
}
