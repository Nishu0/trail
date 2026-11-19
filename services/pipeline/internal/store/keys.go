package store

// single-table design. all items for a user share PK = USER#<user>,
// so one query returns the whole pipeline (an item collection).
//
//	PK            SK                                   Type   what
//	USER#me       JOB#<jobId>                          Job    a company/role
//	USER#me       JOB#<jobId>#DRAFT#<createdAt>#<id>   Draft  an email for that job
//
// drafts sort right after their job, so a job plus drafts is one query
// with begins_with(SK, "JOB#<jobId>").
//
//	GSI1 (sparse)  GSI1PK = FOLLOWUP#<user>             GSI1SK = <followUp>#<jobId>
//	               only jobs awaiting a reply with a date get these keys,
//	               so the index is the follow-up queue. due by D: GSI1SK <= "D#~"
//	GSI2           GSI2PK = USER#<user>#STAGE#<stage>   GSI2SK = <addedAt>#<jobId>
//	               all jobs in a stage, oldest first

import (
	"strings"

	"trail/pipeline/internal/pipeline"
)

const (
	typeJob   = "Job"
	typeDraft = "Draft"
	gsi1      = "GSI1"
	gsi2      = "GSI2"
	// '~' sorts after digits, letters and '-', so "<date>#~" bounds every key on that date.
	upperBound = "~"
)

func userPK(user string) string     { return "USER#" + user }
func jobSK(jobID string) string     { return "JOB#" + jobID }
func followUpPK(user string) string { return "FOLLOWUP#" + user }
func stagePK(user string, s pipeline.Stage) string {
	return userPK(user) + "#STAGE#" + string(s)
}
func draftSK(d pipeline.Draft) string {
	return jobSK(d.JobID) + "#DRAFT#" + d.CreatedAt + "#" + d.ID
}

// jobItem is a stored Job: domain fields plus keys and version.
// the embedded Job is flattened into top-level attributes.
type jobItem struct {
	PK      string `dynamodbav:"PK"`
	SK      string `dynamodbav:"SK"`
	Type    string `dynamodbav:"Type"`
	Version int    `dynamodbav:"Version"`
	GSI1PK  string `dynamodbav:"GSI1PK,omitempty"`
	GSI1SK  string `dynamodbav:"GSI1SK,omitempty"`
	GSI2PK  string `dynamodbav:"GSI2PK"`
	GSI2SK  string `dynamodbav:"GSI2SK"`
	pipeline.Job
}

type draftItem struct {
	PK   string `dynamodbav:"PK"`
	SK   string `dynamodbav:"SK"`
	Type string `dynamodbav:"Type"`
	pipeline.Draft
}

func newJobItem(user string, j pipeline.Job, version int) jobItem {
	item := jobItem{
		PK:      userPK(user),
		SK:      jobSK(j.ID),
		Type:    typeJob,
		Version: version,
		GSI2PK:  stagePK(user, j.Stage),
		GSI2SK:  j.AddedAt + "#" + j.ID,
		Job:     j,
	}
	if j.Stage.AwaitingReply() && j.FollowUp != "" {
		item.GSI1PK = followUpPK(user)
		item.GSI1SK = j.FollowUp + "#" + j.ID
	}
	return item
}

func newDraftItem(user string, d pipeline.Draft) draftItem {
	return draftItem{PK: userPK(user), SK: draftSK(d), Type: typeDraft, Draft: d}
}

// belongsTo filters begins_with matches: "JOB#ab" also prefixes "JOB#abc".
func belongsTo(sk, jobID string) bool {
	base := jobSK(jobID)
	return sk == base || strings.HasPrefix(sk, base+"#")
}
