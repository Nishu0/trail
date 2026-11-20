package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheck(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/open":
			w.Write([]byte("<h1>Backend Engineer</h1><button>Apply</button>"))
		case "/filled":
			w.Write([]byte("<p>This Position Has Been Filled.</p>"))
		case "/gone":
			w.WriteHeader(http.StatusGone)
		case "/blocked":
			w.WriteHeader(http.StatusForbidden)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	cases := map[string]string{
		"/open":    "open",
		"/filled":  "closed",
		"/gone":    "closed",
		"/missing": "closed",
		"/blocked": "unverified",
	}
	c := New()
	for path, want := range cases {
		if got := c.Check(context.Background(), srv.URL+path); got.Status != want {
			t.Errorf("%s: status %q (%s), want %q", path, got.Status, got.Reason, want)
		}
	}
	if got := c.Check(context.Background(), "https://x.com/someone/status/1"); got.Status != "unverified" {
		t.Errorf("x.com: %q, want unverified", got.Status)
	}
	if got := c.Check(context.Background(), ""); got.Status != "unverified" {
		t.Errorf("empty url: %q, want unverified", got.Status)
	}
}
