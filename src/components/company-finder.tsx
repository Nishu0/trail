"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Building2,
  Search,
  LoaderCircle,
  BookmarkPlus,
  Users,
  GitPullRequest,
} from "lucide-react";
import { Button } from "./ui/button";
import { CompanyIcon, External } from "./shared";
import { request, useWorkspace } from "./workspace";
import type { CompanyFinding } from "@/lib/company-finder";
import type { Workspace } from "@/lib/model";
export function LiveCompanyFinder() {
  const { data, replace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState<CompanyFinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function find() {
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    setFinding(null);
    try {
      setFinding(
        await request<CompanyFinding>("/api/companies/discover", {
          method: "POST",
          body: JSON.stringify({ query }),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
        }),
      );
    } catch (error) {
      if (!abort.signal.aborted) setError((error as Error).message);
    } finally {
      setLoading(false);
      controller.current = null;
    }
  }
  async function save(url: string) {
    setSaving(url);
    setSaveError((previous) => ({ ...previous, [url]: "" }));
    try {
      const result = await request<{ workspace: Workspace; companyId: string }>(
        "/api/company",
        {
          method: "POST",
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(35000),
        },
      );
      replace(result.workspace);
      setSaved((previous) => ({ ...previous, [url]: result.companyId }));
    } catch (error) {
      setSaveError((previous) => ({
        ...previous,
        [url]: (error as Error).message,
      }));
    } finally {
      setSaving(null);
    }
  }
  return (
    <section
      className="live-company-finder"
      aria-labelledby="company-finder-title"
    >
      <div className="finder-heading">
        <div>
          <span className="tiny-kicker">LIVE DISCOVERY / BUILT AROUND YOU</span>
          <h2 id="company-finder-title">Find a team worth knowing.</h2>
          <p>
            Start with your skills. Follow the source. Keep the companies that
            feel right.
          </p>
        </div>
        <span className="finder-live">
          <span className="green-dot" /> Live sources
        </span>
      </div>
      <form
        className="finder-form"
        onSubmit={(event) => {
          event.preventDefault();
          void find();
        }}
      >
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Company discovery focus"
            maxLength={500}
            placeholder={
              data?.profile.skills
                ? `Use my profile · ${data.profile.skills.slice(0, 85)}`
                : "e.g. Rust, developer tools, databases"
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
          />
        </label>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Search size={16} />
          )}
          {loading ? "Finding companies…" : "Find companies"}
        </Button>
      </form>
      <p className="finder-context">
        {query.trim()
          ? "Searching the focus you entered."
          : "Uses your saved target roles and skills. You can enter a different focus above."}{" "}
        Results stay here until you save a company.
      </p>
      {error && (
        <p className="status-message error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <div className="finder-loading" role="status">
          <LoaderCircle size={22} className="spin" />
          <div>
            <b>Reading live company sources</b>
            <p>
              Checking company websites and YC’s current job index for your
              focus.
            </p>
          </div>
          <div className="finder-skeletons" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        </div>
      )}
      {finding && (
        <>
          <div className="finder-result-meta" aria-live="polite">
            <b>{finding.companies.length} companies to explore</b>
            <span>
              Checked{" "}
              {new Date(finding.checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ·{" "}
              {finding.sources
                .map(
                  (source) =>
                    `${source.name}: ${source.error ? "unavailable" : source.checked + " checked"}`,
                )
                .join(" · ")}
            </span>
          </div>
          {finding.sources
            .filter((source) => source.error)
            .map((source) => (
              <p key={source.name} role="status" className="finder-context">
                {source.error} Other available sources are shown below.
              </p>
            ))}
          {!finding.companies.length && (
            <div className="finder-no-results">
              <Search size={24} />
              <h3>No companies matched this search.</h3>
              <p>
                Try a technology or product area, such as your strongest skill.
                No sample results have been added.
              </p>
            </div>
          )}
          <div className="finder-results">
            {finding.companies.map((company) => {
              const id = saved[company.url];
              return (
                <article
                  className="panel finder-company-card"
                  key={company.url}
                >
                  <div className="finder-company-top">
                    <CompanyIcon name={company.name} />
                    <span className="tiny-kicker">{company.provider}</span>
                  </div>
                  <h3>{company.name}</h3>
                  <p className="finder-description">
                    {company.description ||
                      "Open the source to learn about this company."}
                  </p>
                  <div className="finder-match">
                    {company.reasons.length ? (
                      <>Mentions {company.reasons.join(" · ")}</>
                    ) : (
                      "Search relevance from Exa · review at the source"
                    )}
                  </div>
                  {company.jobs.length > 0 && (
                    <div className="finder-jobs">
                      <b>
                        {company.jobs.length} listing
                        {company.jobs.length === 1 ? "" : "s"} in YC’s index
                      </b>
                      {company.jobs.slice(0, 2).map((job) => (
                        <External key={job.url} href={job.url}>
                          {job.title}
                        </External>
                      ))}
                    </div>
                  )}
                  {saveError[company.url] && (
                    <p className="status-message error" role="alert">
                      {saveError[company.url]}
                    </p>
                  )}
                  <div className="finder-card-actions">
                    <External href={company.url}>Source</External>
                    {id ? (
                      <Button asChild variant="outline">
                        <Link href={`/dashboard/companies/${id}`}>
                          <Check size={15} />
                          Open notebook
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={!!saving}
                        onClick={() => void save(company.url)}
                      >
                        {saving === company.url ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <BookmarkPlus size={15} />
                        )}
                        {saving === company.url
                          ? "Reading source…"
                          : "Save & research"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
export function EmptyCompanyCards() {
  return (
    <div className="company-empty-grid">
      {[
        {
          icon: Building2,
          title: "Your company shortlist",
          text: "Save a live result to build a notebook with its product, website and sources.",
        },
        {
          icon: Users,
          title: "The people behind it",
          text: "Find founders and team profiles. Keep the evidence for each connection.",
        },
        {
          icon: GitPullRequest,
          title: "A thoughtful first contribution",
          text: "Link a repository to read contribution rules, accepted PRs and open issues.",
        },
      ].map(({ icon: Icon, title, text }) => (
        <article key={title} className="company-empty-card">
          <Icon size={22} strokeWidth={1.7} />
          <h3>{title}</h3>
          <p>{text}</p>
          <span className="tiny-kicker">WAITING FOR YOUR FIRST COMPANY</span>
        </article>
      ))}
    </div>
  );
}
