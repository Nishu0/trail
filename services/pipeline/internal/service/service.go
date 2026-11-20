// Package service writes to dynamodb, then publishes the matching kafka event.
//
// this is a dual write: the db write can succeed and the publish fail. it only
// runs with EVENT_SOURCE=direct. the default, streams, leaves publishing to the
// relay, which reads dynamodb's change log and cannot miss a write.
package service

import (
	"context"
	"log/slog"
	"time"

	"trail/pipeline/internal/events"
	"trail/pipeline/internal/pipeline"
	"trail/pipeline/internal/store"
)

type Service struct {
	*store.Store
	pub events.Publisher
	log *slog.Logger
}

func New(s *store.Store, pub events.Publisher, log *slog.Logger) *Service {
	return &Service{Store: s, pub: pub, log: log}
}

func (s *Service) CreateJob(ctx context.Context, j pipeline.Job) (pipeline.JobView, error) {
	view, err := s.Store.CreateJob(ctx, j)
	if err != nil {
		return view, err
	}
	s.emit(events.JobSaved, view.ID, view.Version, events.JobSavedData{Job: view.Job})
	return view, nil
}

func (s *Service) ChangeStage(ctx context.Context, id string, c pipeline.StageChange) (pipeline.JobView, error) {
	view, from, err := s.Store.ChangeStage(ctx, id, c)
	if err != nil {
		return view, err
	}
	s.emit(events.JobStageChanged, id, view.Version, events.StageChangedData{
		From: from, To: view.Stage, Channel: view.Channel, FollowUp: view.FollowUp, URL: view.URL,
	})
	return view, nil
}

func (s *Service) AddDraft(ctx context.Context, d pipeline.Draft) (pipeline.Draft, error) {
	draft, err := s.Store.AddDraft(ctx, d)
	if err != nil {
		return draft, err
	}
	s.emit(events.DraftCreated, draft.JobID, 0, events.DraftCreatedData{DraftID: draft.ID, Mode: draft.Mode})
	return draft, nil
}

// emit publishes with its own timeout, so a slow broker cannot hang the request
// and a cancelled request does not drop the event mid-write.
func (s *Service) emit(typ, jobID string, version int, data any) {
	if _, off := s.pub.(events.Nop); off {
		return // streams mode: the relay publishes
	}
	e, err := events.New(typ, jobID, version, data)
	if err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		err = s.pub.Publish(ctx, e)
	}
	if err != nil {
		s.log.Error("event not published", "type", typ, "job", jobID, "err", err)
		return
	}
	s.log.Info("event published", "type", typ, "job", jobID, "id", e.ID)
}
