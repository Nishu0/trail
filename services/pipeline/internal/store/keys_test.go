package store

import (
	"testing"

	"trail/pipeline/internal/pipeline"
)

func TestJobItemKeys(t *testing.T) {
	j := pipeline.Job{ID: "j1", Stage: pipeline.Applied, FollowUp: "2026-12-01", AddedAt: "2026-11-01T00:00:00Z"}
	it := newJobItem("me", j, 3)
	checks := map[string][2]string{
		"PK":     {it.PK, "USER#me"},
		"SK":     {it.SK, "JOB#j1"},
		"GSI1PK": {it.GSI1PK, "FOLLOWUP#me"},
		"GSI1SK": {it.GSI1SK, "2026-12-01#j1"},
		"GSI2PK": {it.GSI2PK, "USER#me#STAGE#Applied"},
		"GSI2SK": {it.GSI2SK, "2026-11-01T00:00:00Z#j1"},
	}
	for name, c := range checks {
		if c[0] != c[1] {
			t.Errorf("%s = %q, want %q", name, c[0], c[1])
		}
	}
	if it.Version != 3 {
		t.Errorf("Version = %d, want 3", it.Version)
	}
}

// the follow-up index is sparse: no reply pending or no date means no GSI1 keys.
func TestFollowUpIndexIsSparse(t *testing.T) {
	cases := []pipeline.Job{
		{ID: "a", Stage: pipeline.Saved, FollowUp: "2026-12-01"},
		{ID: "b", Stage: pipeline.Archived, FollowUp: "2026-12-01"},
		{ID: "c", Stage: pipeline.Applied},
	}
	for _, j := range cases {
		if it := newJobItem("me", j, 1); it.GSI1PK != "" || it.GSI1SK != "" {
			t.Errorf("job %s (%s) should not be in the follow-up index", j.ID, j.Stage)
		}
	}
}

func TestDraftSortsAfterItsJob(t *testing.T) {
	d := pipeline.Draft{ID: "d1", JobID: "j1", CreatedAt: "2026-11-02T10:00:00Z"}
	sk := newDraftItem("me", d).SK
	if sk != "JOB#j1#DRAFT#2026-11-02T10:00:00Z#d1" {
		t.Fatalf("draft SK = %q", sk)
	}
	if !(jobSK("j1") < sk) {
		t.Fatal("draft must sort after its job so one Query returns both")
	}
}

func TestBelongsTo(t *testing.T) {
	if !belongsTo("JOB#ab", "ab") || !belongsTo("JOB#ab#DRAFT#x", "ab") {
		t.Fatal("job and its drafts belong to it")
	}
	if belongsTo("JOB#abc", "ab") {
		t.Fatal("a longer job id that shares the prefix must be excluded")
	}
}

func TestUpperBoundCoversDateKeys(t *testing.T) {
	key := "2026-12-01#zz-9f3e"
	if !(key <= "2026-12-01#"+upperBound) {
		t.Fatal("upper bound must include every job id on that date")
	}
	if "2026-12-02#a" <= "2026-12-01#"+upperBound {
		t.Fatal("upper bound must exclude the next day")
	}
}
