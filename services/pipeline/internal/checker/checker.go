// Package checker decides if a job listing is still open.
package checker

import (
	"context"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"trail/pipeline/internal/events"
)

// phrases that mean the role is gone even though the page loads.
var closedPhrases = []string{
	"no longer accepting applications",
	"no longer available",
	"position has been filled",
	"this job has expired",
	"job is closed",
	"posting has closed",
}

// sites that hide pages from logged-out bots: a 404 there proves nothing.
var botWalled = []string{"x.com", "twitter.com", "linkedin.com"}

func walled(raw string) bool {
	u, err := neturl.Parse(raw)
	if err != nil {
		return false
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	for _, h := range botWalled {
		if host == h || strings.HasSuffix(host, "."+h) {
			return true
		}
	}
	return false
}

type Checker struct {
	Client *http.Client
}

func New() *Checker {
	return &Checker{Client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Checker) Check(ctx context.Context, url string) events.HealthCheckedData {
	out := events.HealthCheckedData{URL: url, Status: "unverified"}
	if url == "" {
		out.Reason = "no listing url saved"
		return out
	}
	if walled(url) {
		out.Reason = "site blocks automated checks"
		return out
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		out.Reason = "invalid url"
		return out
	}
	req.Header.Set("User-Agent", "trail-job-checker/0.1 (personal job tracker)")
	res, err := c.Client.Do(req)
	if err != nil {
		out.Reason = "could not reach the page"
		return out
	}
	defer res.Body.Close()
	out.Code = res.StatusCode
	switch {
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
		out.Status, out.Reason = "closed", "listing page is gone"
	case res.StatusCode >= 200 && res.StatusCode < 300:
		// read at most 1 mb, enough for any job page text.
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		text := strings.ToLower(string(body))
		out.Status, out.Reason = "open", "listing page loads"
		for _, p := range closedPhrases {
			if strings.Contains(text, p) {
				out.Status, out.Reason = "closed", "page says: "+p
				break
			}
		}
	default:
		// 403, 429 and 5xx say nothing about the role itself.
		out.Reason = "page answered " + http.StatusText(res.StatusCode)
	}
	return out
}
