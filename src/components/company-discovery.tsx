"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Users, Plus, ArrowUpRight } from "lucide-react";
import { Button } from "./ui/button";
import { WorkspaceSelect } from "./ui/select";
import { External, Field, Modal, localDate } from "./shared";
import { request, useWorkspace } from "./workspace";
import type { Company, Workspace } from "@/lib/model";
import type {
  CompanySearch,
  ResearchCandidate,
  ResearchProvider,
} from "@/lib/company-search";
const providers: { value: ResearchProvider; label: string; hint: string }[] = [
  {
    value: "x-users",
    label: "X · people",
    hint: "Public profile search. No key needed for small searches; provider limits apply.",
  },
  {
    value: "x-posts",
    label: "X · live posts",
    hint: "Look for hiring posts or team context. Results must be available from the live source.",
  },
  {
    value: "exa-company",
    label: "Exa · company",
    hint: "Company research with source excerpts. Requires EXA_API_KEY.",
  },
  {
    value: "exa-people",
    label: "Exa · people",
    hint: "People research with source excerpts. Requires EXA_API_KEY.",
  },
  {
    value: "linkedin",
    label: "LinkedIn · public web",
    hint: "Brave searches indexed public profiles. Requires BRAVE_SEARCH_API_KEY; monthly free credits are available, with a card required at signup.",
  },
];
export function CompanyDiscovery({ company }: { company: Company }) {
  const { data, replace, setMessage } = useWorkspace();
  const [provider, setProvider] = useState<ResearchProvider>("x-users");
  const [query, setQuery] = useState(company.name);
  const [result, setResult] = useState<CompanySearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<ResearchCandidate | null>(null);
  const [person, setPerson] = useState({
    name: "",
    role: "",
    linkedin: "",
    x: "",
    evidence: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const current = data?.companies.find((c) => c.id === company.id) || company;
  function choose(value: ResearchProvider) {
    setProvider(value);
    setResult(null);
    setError("");
    setQuery(
      value === "x-users"
        ? company.name
        : value === "x-posts"
          ? `"${company.name}" (hiring OR engineer OR founder)`
          : `${company.name} ${value === "exa-company" ? "company product about" : "founder engineering team"}`,
    );
  }
  async function search() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await request<CompanySearch>("/api/company-research", {
          method: "POST",
          body: JSON.stringify({ companyId: company.id, provider, query }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function openReview(candidate: ResearchCandidate) {
    setReview(candidate);
    setConfirmed(false);
    setReviewError("");
    const host = new URL(candidate.url).hostname;
    setPerson({
      name: candidate.title.split(/\s+[|–—]\s+/)[0],
      role: "",
      linkedin: host.endsWith("linkedin.com") ? candidate.url : "",
      x: ["x.com", "twitter.com", "www.x.com"].includes(host)
        ? candidate.url
        : "",
      evidence: candidate.url,
    });
  }
  async function saveNote(candidate: ResearchCandidate) {
    setSaving(true);
    setError("");
    try {
      const note = `${candidate.title}\n${candidate.summary}\nSource: ${candidate.url}\nFound with ${candidate.provider} · ${result?.checkedAt || new Date().toISOString()}`;
      if (current.notes.includes(candidate.url))
        throw new Error("This source is already in your company notebook.");
      replace(
        await request<Workspace>("/api/workspace", {
          method: "PATCH",
          body: JSON.stringify({
            action: "company",
            id: current.id,
            company: {
              ...current,
              notes: [current.notes, note]
                .filter(Boolean)
                .join("\n\n")
                .slice(0, 20000),
            },
          }),
        }),
      );
      setMessage("Source added to your company notebook.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function savePerson() {
    setSaving(true);
    setReviewError("");
    try {
      if (!confirmed || !person.name.trim() || !person.role.trim())
        throw new Error(
          "Add their name and current role, then confirm the source.",
        );
      if (
        current.people.some(
          (p) =>
            p.evidence === person.evidence ||
            (person.linkedin && p.linkedin === person.linkedin) ||
            (person.x && p.x === person.x),
        )
      )
        throw new Error(
          "This person is already saved. Edit their details in the notebook.",
        );
      replace(
        await request<Workspace>("/api/workspace", {
          method: "PATCH",
          body: JSON.stringify({
            action: "company",
            id: current.id,
            company: { ...current, people: [...current.people, person] },
          }),
        }),
      );
      setMessage("Person and evidence saved to your notebook.");
      setReview(null);
    } catch (e) {
      setReviewError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel company-discovery">
      <div className="panel-heading">
        <div>
          <span className="tiny-kicker">FOLLOW THE SOURCE</span>
          <h2>Get to know the company</h2>
          <p>Find the product, the founders, and the people building it.</p>
        </div>
        <Users size={20} />
      </div>
      <div className="research-controls">
        <Field label="Where to look">
          <WorkspaceSelect
            label="Where to look"
            value={provider}
            disabled={loading}
            onValueChange={(value) => choose(value as ResearchProvider)}
            options={providers}
          />
        </Field>
        <Field label="Search for">
          <input
            value={query}
            disabled={loading}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${company.name} founder`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim().length > 1 && !loading) void search();
              }
            }}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={loading || query.trim().length < 2}
          onClick={search}
        >
          <Search size={15} />
          {loading ? "Following the trail…" : "Search sources"}
        </Button>
      </div>
      <p className="research-provider-hint">
        {providers.find((p) => p.value === provider)?.hint}{" "}
        <Link href="/dashboard/connections">
          Connection details <ArrowUpRight size={12} />
        </Link>
      </p>
      {error && (
        <p className="status-message error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="research-results">
          <div className="research-results-heading">
            <span>
              {result.results.length} result
              {result.results.length === 1 ? "" : "s"} ·{" "}
              {localDate(result.checkedAt)}
              {result.cached ? " · cached" : ""}
            </span>
            <p>{result.note}</p>
          </div>
          {result.results.length ? (
            result.results.map((candidate, i) => (
              <article
                className="research-candidate"
                key={`${candidate.url}-${i}`}
              >
                <div>
                  <span className="tiny-kicker">{candidate.provider}</span>
                  <h3>
                    <External href={candidate.url}>{candidate.title}</External>
                  </h3>
                  <p>{candidate.summary}</p>
                  <small className="source-address">{candidate.url}</small>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    candidate.kind === "person"
                      ? openReview(candidate)
                      : void saveNote(candidate)
                  }
                >
                  <Plus size={14} />
                  {candidate.kind === "person"
                    ? "Review person"
                    : "Save source note"}
                </Button>
              </article>
            ))
          ) : (
            <p className="inline-empty">
              No public results for this query. Try the person’s name or another
              source.
            </p>
          )}
        </div>
      )}
      <div className="manual-research-links">
        <span>Keep looking</span>
        <External
          href={`https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in ${company.name} founder engineer`)}`}
        >
          Public LinkedIn search
        </External>
        <External href={`https://x.com/search?q=${encodeURIComponent(query)}`}>
          Open on X
        </External>
        <External href={company.website}>Company website</External>
      </div>
      {review && (
        <Modal
          open
          title="Is this the right person?"
          description={`Review the source before adding someone to ${company.name}. A matching search result doesn't confirm their current role.`}
          onOpenChange={(open) => {
            if (!open) setReview(null);
          }}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void savePerson();
            }}
          >
            <External href={review.url}>Read the source</External>
            <p className="review-source-summary">{review.summary}</p>
            <div className="form-grid">
              <Field label="Their name">
                <input
                  required
                  value={person.name}
                  onChange={(e) =>
                    setPerson({ ...person, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Current role at this company">
                <input
                  required
                  value={person.role}
                  onChange={(e) =>
                    setPerson({ ...person, role: e.target.value })
                  }
                  placeholder="Founder / product engineer…"
                />
              </Field>
            </div>
            <Field label="LinkedIn">
              <input
                type="url"
                value={person.linkedin}
                onChange={(e) =>
                  setPerson({ ...person, linkedin: e.target.value })
                }
              />
            </Field>
            <Field label="X">
              <input
                type="url"
                value={person.x}
                onChange={(e) => setPerson({ ...person, x: e.target.value })}
              />
            </Field>
            <Field label="Evidence of their current role">
              <input
                type="url"
                required
                value={person.evidence}
                onChange={(e) =>
                  setPerson({ ...person, evidence: e.target.value })
                }
              />
            </Field>
            <label className="check-line">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I checked the source and confirmed their current role at{" "}
                {company.name}.
              </span>
            </label>
            {reviewError && (
              <p role="alert" className="status-message error">
                {reviewError}
              </p>
            )}
            <Button type="submit" className="orange-button" disabled={saving}>
              {saving ? "Saving…" : "Save person"}
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
