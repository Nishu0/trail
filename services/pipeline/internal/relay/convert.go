// Package relay turns dynamodb stream records into kafka events.
//
// this replaces the dual write from step 3. the api only writes dynamodb. the
// stream is dynamodb's own change log, so a change can not be saved without
// also showing up here. the relay reads it and publishes.
package relay

import (
	"strings"

	streamav "github.com/aws/aws-sdk-go-v2/feature/dynamodbstreams/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodbstreams/types"

	"trail/pipeline/internal/events"
	"trail/pipeline/internal/pipeline"
)

// jobImage is a Job item as it appears in a stream record.
type jobImage struct {
	Type        string `dynamodbav:"Type"`
	Version     int    `dynamodbav:"Version"`
	FollowUpDue string `dynamodbav:"followUpDue"`
	pipeline.Job
}

type draftImage struct {
	Type string `dynamodbav:"Type"`
	pipeline.Draft
}

// Convert maps one stream record to zero or more events. it compares the old
// and new images to work out what actually changed.
func Convert(r types.Record) ([]events.Event, error) {
	if r.Dynamodb == nil || r.EventName == types.OperationTypeRemove {
		return nil, nil
	}
	img := r.Dynamodb.NewImage
	kind, _ := img["Type"].(*types.AttributeValueMemberS)
	if kind == nil {
		return nil, nil // not a job or draft, for example a future item type
	}
	var out []events.Event
	// same record, same id: a replayed record yields the same event id.
	add := func(typ, jobID string, version int, data any) error {
		e, err := events.New(typ, jobID, version, data)
		if err != nil {
			return err
		}
		e = e.WithID(str(r.EventID) + "#" + typ)
		if t := r.Dynamodb.ApproximateCreationDateTime; t != nil {
			e.OccurredAt = t.UTC()
		}
		out = append(out, e)
		return nil
	}

	switch kind.Value {
	case "Job":
		var now jobImage
		if err := streamav.UnmarshalMap(img, &now); err != nil {
			return nil, err
		}
		if r.EventName == types.OperationTypeInsert {
			return out, add(events.JobSaved, now.ID, now.Version, events.JobSavedData{Job: now.Job})
		}
		var before jobImage
		if err := streamav.UnmarshalMap(r.Dynamodb.OldImage, &before); err != nil {
			return nil, err
		}
		if before.Stage != now.Stage {
			if err := add(events.JobStageChanged, now.ID, now.Version, events.StageChangedData{
				From: before.Stage, To: now.Stage, Channel: now.Channel, FollowUp: now.FollowUp, URL: now.URL,
			}); err != nil {
				return nil, err
			}
		}
		if now.FollowUpDue != "" && now.FollowUpDue != before.FollowUpDue {
			if err := add(events.FollowUpDue, now.ID, now.Version, events.FollowUpDueData{
				Date: now.FollowUpDue, Company: now.Company, Role: now.Role, Stage: string(now.Stage),
			}); err != nil {
				return nil, err
			}
		}
		// health or note edits change the item but are not events.
	case "Draft":
		if r.EventName != types.OperationTypeInsert {
			return nil, nil
		}
		var d draftImage
		if err := streamav.UnmarshalMap(img, &d); err != nil {
			return nil, err
		}
		return out, add(events.DraftCreated, d.JobID, 0, events.DraftCreatedData{DraftID: d.ID, Mode: d.Mode})
	}
	return out, nil
}

func str(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}
