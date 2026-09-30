"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Asterisk,
  ArrowUpRight,
  ArrowLeft,
  Plus,
  GitBranch,
  Globe,
  GitPullRequest,
  Check,
  Search,
  ShieldCheck,
  RefreshCw,
  CircleDot,
  Users,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace, request } from "./workspace";
import {
  Field,
  Modal,
  Empty,
  CompanyIcon,
  External,
  localDate,
} from "./shared";
import { LiveCompanyFinder, EmptyCompanyCards } from "./company-finder";
import { CompanyDiscovery } from "./company-discovery";
import type { Company, Workspace } from "@/lib/model";
type Research = {
  repo: {
    name: string;
    description: string;
    html_url: string;
    language: string;
    stargazers_count: number;
  };
  contributors: { login: string; html_url: string; avatar_url: string }[];
  checkedAt: string;
  vouch: boolean;
  treeTruncated: boolean;
  rules: { path: string; url: string; text: string }[];
  merged: {
    number: number;
    title: string;
    url: string;
    author: string;
    mergedAt: string;
  }[];
  issues: {
    number: number;
    title: string;
    url: string;
    labels: string[];
    assigned: boolean;
    tested: false;
  }[];
  caution: string;
};
export function Companies({
  companyId,
  embedded = false,
}: {
  companyId?: string;
  embedded?: boolean;
}) {
  const { data } = useWorkspace();
  const [edit, setEdit] = useState<Company | null | "new">(null);
  const [search, setSearch] = useState("");
  const [importYC, setImportYC] = useState(false);
  if (!data) return null;
  const company = data.companies.find((c) => c.id === companyId);
  if (companyId && !company)
    return (
      <Empty
        title="Company not found."
        text="Return to your notebook and choose a team."
        action={
          <Button asChild>
            <Link href="/dashboard/companies">Your companies</Link>
          </Button>
        }
      />
    );
  return (
    <>
      {company ? (
        <>
          {!embedded && (
            <Link href="/dashboard/companies" className="back-link">
              <ArrowLeft size={14} />
              Your companies
            </Link>
          )}
          <div className="company-detail-hero">
            <CompanyIcon large name={company.name} color={company.color} />
            <div>
              <span className="tiny-kicker">{company.category}</span>
              <h2>{company.name}</h2>
              <p>{company.description}</p>
            </div>
            <Button variant="outline" onClick={() => setEdit(company)}>
              Edit notebook
            </Button>
          </div>
          <div className="company-detail-links">
            <External href={company.website}>
              <Globe size={14} />
              Website
            </External>
            {company.repo && (
              <External href={`https://github.com/${company.repo}`}>
                <GitBranch size={14} />
                Repository
              </External>
            )}
            <External
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.name + " founder")}`}
            >
              Research on LinkedIn
            </External>
            <External
              href={`https://x.com/search?q=${encodeURIComponent(company.name + " founder")}`}
            >
              Research on X
            </External>
          </div>
          <div className="company-detail-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>The people behind the work</h2>
                <Users size={17} />
              </div>
              {company.people.length ? (
                company.people.map((p, i) => (
                  <div className="person-row" key={i}>
                    <span className="person-avatar">{p.name.slice(0, 1)}</span>
                    <div>
                      <b>{p.name}</b>
                      <p>{p.role}</p>
                      <div className="person-links">
                        {p.linkedin && (
                          <External href={p.linkedin}>LinkedIn</External>
                        )}
                        {p.x && <External href={p.x}>X</External>}
                        {p.evidence && (
                          <External href={p.evidence}>Evidence</External>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="A connection starts with context."
                  text="Research the team using the source links above. Save verified founder and team profiles with their evidence."
                  action={
                    <Button variant="outline" onClick={() => setEdit(company)}>
                      Add a person <Plus size={14} />
                    </Button>
                  }
                />
              )}
            </section>
            <section className="panel company-notes">
              <div className="panel-heading">
                <h2>Your company notebook</h2>
                <FileText size={16} />
              </div>
              <p>
                {company.notes ||
                  "What interests you about their product? Where could your work be useful? Keep the specifics here."}
              </p>
              <div className="company-facts">
                <div>
                  <span>FOCUS</span>
                  <b>{company.category}</b>
                </div>
                <div>
                  <span>REPOSITORY</span>
                  <b>{company.repo || "Not added yet"}</b>
                </div>
                <div>
                  <span>RESEARCH</span>
                  <b>Source-backed, reviewed by you</b>
                </div>
              </div>
            </section>
          </div>
          <CompanyDiscovery key={company.id} company={company} />
          {company.repo ? (
            <RepositoryResearch key={company.repo} repo={company.repo} />
          ) : (
            <div className="soft-notice">
              <Asterisk size={23} />
              <p>
                Add the company’s repository to review contributor rules, merged
                PRs, and open issues.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <LiveCompanyFinder />
          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                placeholder="Find a team you’re curious about…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button variant="outline" onClick={() => setEdit("new")}>
              <Plus size={14} />
              Add a company
            </Button>
          </div>
          <div className="soft-notice">
            <span>Y</span>
            <p>
              Find founders and verified social links from a company’s public YC
              profile.
            </p>
            <Button variant="outline" onClick={() => setImportYC(true)}>
              Research a YC company <ArrowUpRight size={14} />
            </Button>
          </div>
          {!data.companies.length && <EmptyCompanyCards />}
          {data.companies.length > 0 &&
            !data.companies.some((c) =>
              `${c.name} ${c.category}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && (
              <Empty
                title="No saved company matches."
                text="Try a different name or discover a new team above."
              />
            )}
          <div className="company-grid">
            {data.companies
              .filter((c) =>
                `${c.name} ${c.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((c) => (
                <article key={c.id} className="panel company-card">
                  <div className="company-card-top">
                    <CompanyIcon large name={c.name} color={c.color} />
                    <span className="notebook-label">COMPANY NOTEBOOK</span>
                  </div>
                  <span className="tiny-kicker">{c.category}</span>
                  <h2>{c.name}</h2>
                  <p>{c.description}</p>
                  <div className="company-card-meta">
                    <span>
                      <Users size={13} />
                      {c.people.length
                        ? `${c.people.length} saved people`
                        : "People to discover"}
                    </span>
                    <span>
                      <GitPullRequest size={13} />
                      {c.repo ? "Repository added" : "Add a repository"}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/companies/${c.id}`}
                    className="company-card-link"
                  >
                    Get to know the team <ArrowUpRight size={15} />
                  </Link>
                </article>
              ))}
          </div>
        </>
      )}
      {importYC && <YCCompanyImport onClose={() => setImportYC(false)} />}
      {edit && (
        <CompanyEditor
          key={typeof edit === "string" ? edit : edit.id}
          company={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
function CompanyEditor({
  company,
  onClose,
}: {
  company?: Company;
  onClose: () => void;
}) {
  const { busy, run, replace, setMessage } = useWorkspace();
  const [form, setForm] = useState<Company>(
    company || {
      id: "",
      name: "",
      category: "",
      description: "",
      website: "",
      repo: "",
      color: "#eef1e9",
      initials: "",
      notes: "",
      people: [],
    },
  );
  function field(key: keyof Company, value: string) {
    setForm({ ...form, [key]: value });
  }
  return (
    <Modal
      title={
        company ? `Your ${company.name} notebook` : "A company worth knowing"
      }
      description="Save verified sources and your own observations. Founder links should point to people you have confirmed."
      open={true}
      onOpenChange={(v) => !v && onClose()}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const w = await request<Workspace>("/api/workspace", {
              method: "PATCH",
              body: JSON.stringify({
                action: "company",
                id: company?.id,
                company: form,
              }),
            });
            replace(w);
            setMessage("Company notebook saved.");
            onClose();
          });
        }}
      >
        <div className="form-grid">
          <Field label="Company name">
            <input
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </Field>
          <Field label="Focus / category">
            <input
              value={form.category}
              onChange={(e) => field("category", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Website">
          <input
            type="url"
            value={form.website}
            onChange={(e) => field("website", e.target.value)}
          />
        </Field>
        <Field label="GitHub repository">
          <input
            value={form.repo}
            onChange={(e) =>
              field(
                "repo",
                e.target.value.replace(/^https:\/\/github.com\//, ""),
              )
            }
            placeholder="owner/repository"
          />
        </Field>
        <Field label="What they’re building">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </Field>
        <Field label="Your research notes">
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => field("notes", e.target.value)}
          />
        </Field>
        <div className="people-edit-heading">
          <h3>Verified people & founder links</h3>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              setForm({
                ...form,
                people: [
                  ...form.people,
                  { name: "", role: "", linkedin: "", x: "", evidence: "" },
                ],
              })
            }
          >
            <Plus size={13} />
            Add person
          </Button>
        </div>
        {form.people.map((p, i) => (
          <div className="project-editor" key={i}>
            <div className="form-grid">
              {(["name", "role", "linkedin", "x", "evidence"] as const).map(
                (key) => (
                  <Field
                    key={key}
                    label={
                      key === "x"
                        ? "X profile"
                        : key === "evidence"
                          ? "Verification source"
                          : key === "linkedin"
                            ? "LinkedIn profile"
                            : key
                    }
                  >
                    <input
                      type={
                        ["linkedin", "x", "evidence"].includes(key)
                          ? "url"
                          : "text"
                      }
                      required={key === "name" || key === "evidence"}
                      value={p[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          people: form.people.map((j, index) =>
                            index === i ? { ...j, [key]: e.target.value } : j,
                          ),
                        })
                      }
                    />
                  </Field>
                ),
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setForm({
                  ...form,
                  people: form.people.filter((_, index) => index !== i),
                })
              }
            >
              Remove person
            </Button>
          </div>
        ))}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className="orange-button">
            Save notebook
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Contributions() {
  const { data } = useWorkspace();
  const [repo, setRepo] = useState(
    data?.companies.find((c) => c.repo)?.repo || "",
  );
  const [input, setInput] = useState(repo);
  return (
    <>
      <div className="contribution-intro">
        <ShieldCheck size={24} />
        <div>
          <b>The process comes before the pull request.</b>
          <p>
            Check contributor eligibility, read the rules, and learn from
            accepted work. An open issue is a starting point, not a verified
            bug.
          </p>
        </div>
      </div>
      <form
        className="repo-selector"
        onSubmit={(e) => {
          e.preventDefault();
          setRepo(input.replace(/^https:\/\/github.com\//, ""));
        }}
      >
        <Field label="Repository to research">
          <input
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="owner/repository"
          />
        </Field>
        <Button type="submit" className="orange-button">
          Research repository <ArrowUpRight size={14} />
        </Button>
      </form>
      <div className="saved-repos">
        {data?.companies
          .filter((c) => c.repo)
          .map((c) => (
            <button
              className={repo === c.repo ? "active" : ""}
              key={c.id}
              onClick={() => {
                setRepo(c.repo);
                setInput(c.repo);
              }}
            >
              <CompanyIcon name={c.name} />
              {c.name}
            </button>
          ))}
      </div>
      {repo && <RepositoryResearch key={repo} repo={repo} />}
    </>
  );
}
function RepositoryResearch({ repo }: { repo: string }) {
  const [research, setResearch] = useState<Research | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Process");
  const [checked, setChecked] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ]);
  async function refresh() {
    setLoading(true);
    setError("");
    setChecked([false, false, false, false]);
    try {
      setResearch(
        await request<Research>(
          `/api/research?repo=${encodeURIComponent(repo)}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [repo]);
  const ready = checked.every(Boolean);
  return (
    <section className="research-section">
      <div className="research-heading">
        <div>
          <span className="tiny-kicker">REPOSITORY RESEARCH</span>
          <h2>{repo}</h2>
          <p>
            {research
              ? `Checked ${localDate(research.checkedAt)} · public GitHub evidence`
              : "Reading the project, before writing the code."}
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={refresh}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Refresh research
        </Button>
      </div>
      {error && (
        <div role="alert" className="status-message error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="workspace-loading">
          Reading rules, recent merged PRs, and open issues…
        </div>
      ) : (
        research && (
          <>
            {research.contributors.length > 0 && (
              <div className="contributor-strip">
                <span>PUBLIC CONTRIBUTORS</span>
                {research.contributors.map((p) => (
                  <External key={p.login} href={p.html_url}>
                    @{p.login}
                  </External>
                ))}
                <small>
                  Repository contributors; employment and founder roles are not
                  inferred.
                </small>
              </div>
            )}
            <div
              className={`research-policy ${research.vouch ? "attention" : ""}`}
            >
              <ShieldCheck size={19} />
              <div>
                <b>
                  {research.vouch
                    ? "Contributor gating language found — verify your eligibility"
                    : "Contributor eligibility still needs your review"}
                </b>
                <p>
                  {research.vouch
                    ? "A policy file mentions vouching or trusted contributors. Read the source and check with the maintainer before preparing a PR."
                    : "No vouch keyword was detected in the sampled files. That does not confirm unrestricted access. Review the rules and workflows."}
                </p>
              </div>
            </div>
            <div
              className="source-tabs research-tabs"
              role="tablist"
              aria-label="Repository research"
            >
              {["Process", "Accepted PRs", "Open issues"].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  {t}
                  {t === "Accepted PRs" && (
                    <span>{research.merged.length}</span>
                  )}
                  {t === "Open issues" && <span>{research.issues.length}</span>}
                </button>
              ))}
            </div>
            {tab === "Process" ? (
              <div className="research-process-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Read the primary sources</h2>
                    <FileText size={16} />
                  </div>
                  {research.rules.map((r) => (
                    <details key={r.path} className="rule-file">
                      <summary>
                        {r.path}
                        <span>
                          READ SOURCE <ArrowUpRight size={13} />
                        </span>
                      </summary>
                      <External href={r.url}>Open on GitHub</External>
                      <pre>{r.text}</pre>
                    </details>
                  ))}
                  {!research.rules.length && (
                    <div className="inline-empty">
                      <p>
                        No contribution files found in this sample. Check the
                        repository manually.
                      </p>
                    </div>
                  )}
                  {research.treeTruncated && (
                    <p className="muted">
                      GitHub truncated the file tree. Additional policies may
                      exist.
                    </p>
                  )}
                </section>
                <section className="panel readiness-panel">
                  <div className="panel-heading">
                    <h2>Before you start</h2>
                    <ShieldCheck size={16} />
                  </div>
                  <p>Confirm each step from the linked evidence.</p>
                  {[
                    "I’ve read the current contribution rules.",
                    "I’ve checked vouch / eligibility requirements.",
                    "I’ve reviewed accepted PRs and their review threads.",
                    "I know how to reproduce and test the issue.",
                  ].map((text, i) => (
                    <label key={text}>
                      <input
                        type="checkbox"
                        checked={checked[i]}
                        onChange={(e) =>
                          setChecked(
                            checked.map((v, j) =>
                              i === j ? e.target.checked : v,
                            ),
                          )
                        }
                      />
                      <span>{text}</span>
                    </label>
                  ))}
                  <div className={`readiness-status ${ready ? "ready" : ""}`}>
                    <span className={ready ? "green-dot" : "orange-dot"} />
                    {ready
                      ? "Ready to investigate locally"
                      : "Context review in progress"}
                  </div>
                  <p className="form-hint">
                    These are your acknowledgements. Trail has not run or
                    validated repository tests.
                  </p>
                </section>
              </div>
            ) : tab === "Accepted PRs" ? (
              <section className="panel accepted-prs">
                <div className="panel-heading">
                  <div>
                    <h2>Learn from work that landed</h2>
                    <p>
                      Merged PRs from a sample of the 60 most recently updated
                      closed PRs. Open each to review conventions and feedback.
                    </p>
                  </div>
                  <GitPullRequest size={17} />
                </div>
                {research.merged.map((p) => (
                  <a
                    key={p.number}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="pr-row"
                  >
                    <GitPullRequest size={17} />
                    <div>
                      <b>{p.title}</b>
                      <p>
                        #{p.number} · {p.author} · merged{" "}
                        {localDate(p.mergedAt)}
                      </p>
                    </div>
                    <span className="merged-pill">MERGED</span>
                    <ArrowUpRight size={15} />
                  </a>
                ))}
                {!research.merged.length && (
                  <Empty
                    title="No merged PRs in this sample."
                    text="Explore the full closed PR history directly on GitHub."
                    action={
                      <External
                        href={`https://github.com/${repo}/pulls?q=is%3Apr+is%3Amerged`}
                      >
                        Open merged PR history
                      </External>
                    }
                  />
                )}
              </section>
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Possible places to contribute</h2>
                    <p>
                      Public issues, not yet reproduced. Check assignments,
                      existing PRs, and maintainer guidance.
                    </p>
                  </div>
                  <CircleDot size={17} />
                </div>
                {research.issues.map((issue) => (
                  <div className="issue-row" key={issue.number}>
                    <span className="issue-dot" />
                    <div>
                      <External href={issue.url}>{issue.title}</External>
                      <p>
                        #{issue.number} ·{" "}
                        {issue.assigned
                          ? "Already assigned"
                          : "No assignee in this snapshot"}{" "}
                        · Not tested
                      </p>
                      <div className="tag-row">
                        {issue.labels.slice(0, 4).map((l) => (
                          <span key={l}>{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!research.issues.length && (
                  <Empty
                    title="No open issues in this sample."
                    text="Check the repository for current contribution opportunities."
                  />
                )}
              </section>
            )}
            <p className="research-caution">{research.caution}</p>
          </>
        )
      )}
    </section>
  );
}

function YCCompanyImport({ onClose }: { onClose: () => void }) {
  const { run, replace, setMessage, busy } = useWorkspace();
  return (
    <Modal
      title="Know the people behind the company"
      description="Import the product, founders, and verified LinkedIn/X links directly from a public YC company page."
      open={true}
      onOpenChange={(v) => !v && onClose()}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const url = new FormData(e.currentTarget).get("url");
          void run(async () => {
            const r = await request<{ workspace: Workspace; people: number }>(
              "/api/company",
              { method: "POST", body: JSON.stringify({ url }) },
            );
            replace(r.workspace);
            setMessage(
              `Company researched. ${r.people} founder profiles saved with their YC evidence.`,
            );
            onClose();
          });
        }}
      >
        <Field label="YC company or job link">
          <input
            name="url"
            required
            type="url"
            placeholder="https://www.ycombinator.com/companies/…"
          />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="orange-button" disabled={busy}>
            Research company <ArrowUpRight size={14} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
