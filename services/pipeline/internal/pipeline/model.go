// Package pipeline holds domain types shared by the api, store and kafka workers.
// json names match the next.js Job and Draft.
package pipeline

import (
	"errors"
	"fmt"
	"regexp"
	"time"
)

type Stage string

const (
	Saved     Stage = "Saved"
	Applied   Stage = "Applied"
	Interview Stage = "Interview"
	Offer     Stage = "Offer"
	Archived  Stage = "Archived"
)

func (s Stage) Valid() bool {
	switch s {
	case Saved, Applied, Interview, Offer, Archived:
		return true
	}
	return false
}

// AwaitingReply is true for stages where a follow-up date matters.
func (s Stage) AwaitingReply() bool { return s == Applied || s == Interview }

type Job struct {
	ID             string         `json:"id" dynamodbav:"id"`
	Company        string         `json:"company" dynamodbav:"company"`
	CompanyID      string         `json:"companyId,omitempty" dynamodbav:"companyId,omitempty"`
	CompanyWebsite string         `json:"companyWebsite,omitempty" dynamodbav:"companyWebsite,omitempty"`
	LogoURL        string         `json:"logoUrl,omitempty" dynamodbav:"logoUrl,omitempty"`
	Role           string         `json:"role" dynamodbav:"role"`
	Source         string         `json:"source" dynamodbav:"source"`
	URL            string         `json:"url" dynamodbav:"url"`
	Description    string         `json:"description" dynamodbav:"description"`
	Location       string         `json:"location" dynamodbav:"location"`
	Tags           []string       `json:"tags" dynamodbav:"tags"`
	Stage          Stage          `json:"stage" dynamodbav:"stage"`
	Channel        string         `json:"channel,omitempty" dynamodbav:"channel,omitempty"`
	AppliedAt      string         `json:"appliedAt,omitempty" dynamodbav:"appliedAt,omitempty"`
	FollowUp       string         `json:"followUp,omitempty" dynamodbav:"followUp,omitempty"`
	Notes          string         `json:"notes" dynamodbav:"notes"`
	Health         map[string]any `json:"health,omitempty" dynamodbav:"health,omitempty"`
	AddedAt        string         `json:"addedAt" dynamodbav:"addedAt"`
}

type Draft struct {
	ID        string `json:"id" dynamodbav:"id"`
	JobID     string `json:"jobId" dynamodbav:"jobId"`
	Subject   string `json:"subject" dynamodbav:"subject"`
	Body      string `json:"body" dynamodbav:"body"`
	Mode      string `json:"mode" dynamodbav:"mode"`
	CreatedAt string `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt string `json:"updatedAt,omitempty" dynamodbav:"updatedAt,omitempty"`
}

// JobView is a job with its version (for locking) and drafts, newest first.
type JobView struct {
	Job
	Version int     `json:"version"`
	Drafts  []Draft `json:"drafts"`
}

// StageChange moves a job to another stage.
type StageChange struct {
	Stage    Stage   `json:"stage"`
	Channel  string  `json:"channel,omitempty"`
	FollowUp *string `json:"followUp,omitempty"` // nil keeps it, "" clears it
	Notes    *string `json:"notes,omitempty"`
	// ExpectedVersion prevents lost updates. 0 means use the current version.
	ExpectedVersion int `json:"expectedVersion,omitempty"`
}

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("changed by someone else; reload and try again")
	ErrExists   = errors.New("already exists")
	dateOnly    = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

// InvalidError marks bad input so the api answers 400, not 500.
type InvalidError struct{ Msg string }

func (e *InvalidError) Error() string { return e.Msg }

func Invalid(format string, args ...any) error {
	return &InvalidError{Msg: fmt.Sprintf(format, args...)}
}

func (j Job) Validate() error {
	switch {
	case j.ID == "":
		return Invalid("id is required")
	case j.Company == "" || j.Role == "":
		return Invalid("company and role are required")
	case !j.Stage.Valid():
		return Invalid("unknown stage %q", j.Stage)
	case j.FollowUp != "" && !dateOnly.MatchString(j.FollowUp):
		return Invalid("followUp must be YYYY-MM-DD")
	}
	return nil
}

// Apply returns the job after a stage change. first move to Applied sets appliedAt.
func (j Job) Apply(c StageChange, now time.Time) (Job, error) {
	if !c.Stage.Valid() {
		return j, Invalid("unknown stage %q", c.Stage)
	}
	if c.FollowUp != nil && *c.FollowUp != "" && !dateOnly.MatchString(*c.FollowUp) {
		return j, Invalid("followUp must be YYYY-MM-DD")
	}
	j.Stage = c.Stage
	if c.Channel != "" {
		j.Channel = c.Channel
	}
	if c.FollowUp != nil {
		j.FollowUp = *c.FollowUp
	}
	if c.Notes != nil {
		j.Notes = *c.Notes
	}
	if c.Stage == Applied && j.AppliedAt == "" {
		j.AppliedAt = now.UTC().Format(time.RFC3339)
	}
	return j, nil
}
