package events

import "trail/pipeline/internal/pipeline"

// payloads carried in Event.Data, one per topic.

type JobSavedData struct {
	Job pipeline.Job `json:"job"`
}

type StageChangedData struct {
	From     pipeline.Stage `json:"from"`
	To       pipeline.Stage `json:"to"`
	Channel  string         `json:"channel,omitempty"`
	FollowUp string         `json:"followUp,omitempty"`
	URL      string         `json:"url,omitempty"`
}

type DraftCreatedData struct {
	DraftID string `json:"draftId"`
	Mode    string `json:"mode"`
}

type HealthCheckedData struct {
	Status string `json:"status"` // open, closed or unverified
	Reason string `json:"reason"`
	URL    string `json:"url"`
	Code   int    `json:"code,omitempty"`
}

type FollowUpDueData struct {
	Date    string `json:"date"`
	Company string `json:"company"`
	Role    string `json:"role"`
	Stage   string `json:"stage"`
}
