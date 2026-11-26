"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Flag,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  X,
  Gauge,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./workspace";
import { PageHeader } from "./app-shell";
import {
  usePipelineSource,
  PipelineSourceProvider,
  useSource,
} from "./pipeline-source";
import { CompanyIcon } from "./shared";
import { AddOpportunity } from "./opportunities";
import { JobChecks } from "./job-checks";
import { fit, type Draft, type Job, type Stage } from "@/lib/model";
import {
  GROUPS,
  TABS,
  STAGE_LABEL,
  MOVE_TARGETS,
  describe,
  inTab,
  matches,
  latestDraft,
  suggestedRecipient,
  companyFor,
  websiteHost,
  followUpIn,
  mailtoLink,
  type PipelineTab,
} from "@/lib/pipeline";

type Recipient = { name: string; email: string };
const RECIPIENTS_KEY = "trail.pipeline.recipients.v1";
const ROWS_SHOWN = 6;

function readRecipients(): Record<string, Recipient> {
  try {
    return JSON.parse(localStorage.getItem(RECIPIENTS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeRecipients(value: Record<string, Recipient>) {
  try {
    localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(value));
  } catch {
    // Private windows can block storage; the field still works for this visit.
  }
}

function ago(iso: string, now: Date) {
  const minutes = Math.max(
    0,
    (now.getTime() - new Date(iso).getTime()) / 60000,
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function lastTouched(job: Job, drafts: Draft[]) {
  const draft = latestDraft(drafts, job.id)?.createdAt;
  return [job.addedAt, job.appliedAt, draft]
    .filter(Boolean)
    .sort()
    .at(-1) as string;
}

export function Pipeline() {
  const { data, now } = useWorkspace();
  const source = usePipelineSource();
  const { jobs, drafts, reload } = source;
  const [tab, setTab] = useState<PipelineTab>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    closed: true,
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [add, setAdd] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => new Date().toISOString());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const job = new URL(window.location.href).searchParams.get("job");
    if (job) setSelected(job);
  }, []);
  useEffect(() => setLoadedAt(new Date().toISOString()), [jobs, drafts]);

  const rows = useMemo(() => {
    return jobs.map((job) => ({ job, ...describe(job, drafts, now) }));
  }, [jobs, drafts, now]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [
          t.id,
          rows.filter((r) => inTab(r.job, r.group, t.id)).length,
        ]),
      ) as Record<PipelineTab, number>,
    [rows],
  );

  const visible = rows.filter(
    (r) => inTab(r.job, r.group, tab) && matches(r.job, query),
  );
  const ordered = GROUPS.flatMap((g) =>
    visible.filter((r) => r.group === g.id),
  );
  const index = ordered.findIndex((r) => r.job.id === selected);
  const ready = rows.filter((r) => r.next === "Ready to send");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest(
        "input, textarea, select, [contenteditable]",
      );
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && !typing) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!data) return null;
  if (source.kind === "loading")
    return (
      <div className="workspace-loading" role="status">
        Loading your pipeline…
      </div>
    );

  const step = (delta: number) => {
    const next = ordered[index + delta];
    if (next) setSelected(next.job.id);
  };

  return (
    <PipelineSourceProvider value={source}>
      <PageHeader
        title="Pipeline"
        actions={
          <>
            <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <button
                aria-label="Refresh pipeline"
                onClick={reload}
                className="rounded p-1 hover:bg-accent hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
              </button>
              Updated {ago(loadedAt, now)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full px-3"
              onClick={() => setAdd(true)}
            >
              <Plus /> Add company
            </Button>
          </>
        }
      />
      <div className={`pipe ${selected ? "with-panel" : ""}`}>
        <div className="pipe-main">
          {source.error && (
            <div className="status-message error" role="alert">
              {source.error}
            </div>
          )}
          {source.kind === "postgres" && <JobChecks />}
          {ready.length > 0 && (
            <div className="pipe-ready">
              <b>{ready.length}</b>
              <span>email{ready.length > 1 ? "s" : ""} ready to send</span>
              <Button
                className="pipe-dark"
                onClick={() => {
                  setTab("needs");
                  setSelected(ready[0].job.id);
                }}
              >
                Review
              </Button>
            </div>
          )}
          <div className="pipe-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className={t.id === "needs" && counts.needs ? "hot" : ""}>
                  {counts[t.id]}
                </span>
              </button>
            ))}
            <label className="pipe-search">
              <Search size={15} />
              <input
                ref={searchRef}
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search pipeline"
              />
              <kbd>/</kbd>
            </label>
          </div>
          <div className="pipe-table">
            <div className="pipe-head">
              <span>
                <Building2 size={14} />
                Company
              </span>
              <span>
                <Flag size={14} />
                Stage
              </span>
              <span className="pipe-wide">
                <UserRound size={14} />
                Contact
              </span>
              <span className="pipe-wide">
                <Gauge size={14} />
                Fit
              </span>
              <span>
                <ArrowRight size={14} />
                Next
              </span>
              <span className="pipe-wide">
                <Clock3 size={14} />
                Updated
              </span>
            </div>
            {GROUPS.map((g) => {
              const list = visible.filter((r) => r.group === g.id);
              if (!list.length) return null;
              const open = !collapsed[g.id];
              const shown = expanded[g.id] ? list : list.slice(0, ROWS_SHOWN);
              return (
                <section key={g.id} className="pipe-group">
                  <button
                    className="pipe-group-title"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))
                    }
                  >
                    {open ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                    <span className={`pipe-chip group-${g.id}`}>{g.label}</span>
                    <i>{list.length}</i>
                  </button>
                  {open && (
                    <div className="pipe-rows">
                      {shown.map(({ job, next, tone }) => {
                        const person =
                          readRecipientName(job.id) ||
                          suggestedRecipient(job, data.companies)?.name;
                        const score = fit(job, data.profile).score;
                        return (
                          <button
                            key={job.id}
                            className={`pipe-row ${selected === job.id ? "active" : ""}`}
                            onClick={() =>
                              setSelected(selected === job.id ? null : job.id)
                            }
                          >
                            <span className="pipe-company">
                              <CompanyIcon
                                name={job.company}
                                logoUrl={job.logoUrl}
                              />
                              <span>
                                <b>{job.company}</b>
                                <small>{job.role}</small>
                              </span>
                            </span>
                            <span>
                              <span className={`pipe-chip stage-${job.stage}`}>
                                {STAGE_LABEL[job.stage]}
                              </span>
                            </span>
                            <span className="pipe-wide pipe-contact">
                              {person ? (
                                <>
                                  <i className="pipe-avatar">{person[0]}</i>
                                  {person}
                                </>
                              ) : (
                                <em>Not found yet</em>
                              )}
                            </span>
                            <span className="pipe-wide">
                              <FitBar score={score} />
                            </span>
                            <span>
                              {tone === "quiet" ? (
                                <span className="pipe-next">{next}</span>
                              ) : (
                                <span className={`pipe-chip next-${tone}`}>
                                  {next}
                                </span>
                              )}
                            </span>
                            <span className="pipe-wide pipe-muted">
                              {ago(lastTouched(job, drafts), now)}
                            </span>
                          </button>
                        );
                      })}
                      {list.length > ROWS_SHOWN && (
                        <button
                          className="pipe-more"
                          onClick={() =>
                            setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))
                          }
                        >
                          {expanded[g.id] ? (
                            <>
                              <ChevronUp size={14} /> Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> Show{" "}
                              {list.length - ROWS_SHOWN} more
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
            {!visible.length && (
              <div className="pipe-empty">
                {rows.length ? (
                  <p>Nothing matches here.</p>
                ) : (
                  <>
                    <p>Your pipeline is empty.</p>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/discover">
                        Find companies <ArrowUpRight size={14} />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {selected && jobs.some((j) => j.id === selected) && (
          <DetailPanel
            key={selected}
            job={jobs.find((j) => j.id === selected)!}
            onClose={() => setSelected(null)}
            onStep={step}
            canPrev={index > 0}
            canNext={index >= 0 && index < ordered.length - 1}
          />
        )}
        <AddOpportunity open={add} onOpenChange={setAdd} />
      </div>
    </PipelineSourceProvider>
  );
}

function readRecipientName(jobId: string) {
  if (typeof window === "undefined") return "";
  return readRecipients()[jobId]?.name || "";
}

function FitBar({ score }: { score: number | null }) {
  if (score === null) return <span className="pipe-muted">—</span>;
  const filled = Math.round(score / 20);
  const tone = score >= 70 ? "high" : score >= 45 ? "mid" : "low";
  return (
    <span className={`pipe-fit fit-${tone}`} aria-label={`Fit ${score} of 100`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
      <b>{score}</b>
    </span>
  );
}

function DetailPanel({
  job,
  onClose,
  onStep,
  canPrev,
  canNext,
}: {
  job: Job;
  onClose: () => void;
  onStep: (delta: number) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const { data, busy } = useWorkspace();
  const source = useSource();
  const [moveOpen, setMoveOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(true);
  if (!data) return null;
  const draft = latestDraft(source.drafts, job.id);
  const company = companyFor(job, data.companies);
  const host = websiteHost(job, data.companies);
  const suggested = suggestedRecipient(job, data.companies);
  const match = fit(job, data.profile);

  const move = (stage: Stage) => {
    setMoveOpen(false);
    void source.move(
      job,
      { stage },
      `${job.company} moved to ${STAGE_LABEL[stage].toLowerCase()}.`,
    );
  };

  return (
    <aside className="pipe-panel" aria-label={`${job.company} details`}>
      <div className="pipe-panel-bar">
        <button aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div>
          <button
            aria-label="Previous company"
            disabled={!canPrev}
            onClick={() => onStep(-1)}
          >
            <ChevronUp size={17} />
          </button>
          <button
            aria-label="Next company"
            disabled={!canNext}
            onClick={() => onStep(1)}
          >
            <ChevronDown size={17} />
          </button>
          <div className="pipe-move">
            <button
              aria-expanded={moveOpen}
              onClick={() => setMoveOpen((o) => !o)}
            >
              Move to <ChevronDown size={14} />
            </button>
            {moveOpen && (
              <div className="pipe-menu" role="menu">
                {MOVE_TARGETS.filter((s) => s !== job.stage).map((s) => (
                  <button
                    key={s}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => move(s)}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="pipe-panel-body">
        <header className="pipe-panel-head">
          <CompanyIcon name={job.company} logoUrl={job.logoUrl} large />
          <div>
            <h2>
              {job.company}
              <span className={`pipe-chip stage-${job.stage}`}>
                {STAGE_LABEL[job.stage]}
              </span>
            </h2>
            <p>
              {job.role}
              {host && (
                <>
                  {" · "}
                  <a
                    href={job.companyWebsite || company?.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {host} <ArrowUpRight size={12} />
                  </a>
                </>
              )}
            </p>
          </div>
        </header>
        <Composer
          key={draft?.id || "empty"}
          job={job}
          draft={draft}
          suggested={
            suggested
              ? { name: suggested.name, role: suggested.role }
              : undefined
          }
          onWrite={(recipient) => source.writeDraft(job.id, recipient)}
          onNotInterested={() =>
            source.move(
              job,
              { stage: "Archived" },
              `${job.company} closed. You can reopen it from Closed.`,
            )
          }
        />
        <section className="pipe-why">
          <button
            className="pipe-why-title"
            aria-expanded={whyOpen}
            onClick={() => setWhyOpen((o) => !o)}
          >
            <b>Why {job.company} fits</b>
            <FitBar score={match.score} />
            {whyOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {whyOpen && (
            <div className="pipe-why-body">
              {match.reasons.length ? (
                <p>
                  The role asks for {match.reasons.slice(0, 6).join(", ")}
                  {match.reasons.length > 6 ? " and more" : ""}, which you list
                  in your skills.
                </p>
              ) : (
                <p className="pipe-muted">
                  Add skills to your story to see how this role matches you.
                </p>
              )}
              {job.description && (
                <p className="pipe-desc">
                  {job.description.slice(0, 420)}
                  {job.description.length > 420 ? "…" : ""}
                </p>
              )}
              <ul className="pipe-facts">
                {job.location && <li>{job.location}</li>}
                <li>Source: {job.source}</li>
                {job.health && <li>Listing: {job.health.status}</li>}
              </ul>
              {company?.people.length ? (
                <div className="pipe-people">
                  {company.people.slice(0, 4).map((p) => (
                    <span key={p.name}>
                      {p.name}
                      {p.role && `, ${p.role}`}
                      {p.linkedin && (
                        <a href={p.linkedin} target="_blank" rel="noreferrer">
                          LinkedIn <ArrowUpRight size={11} />
                        </a>
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="pipe-links">
                {job.url && (
                  <a href={job.url} target="_blank" rel="noreferrer">
                    Job post <ArrowUpRight size={12} />
                  </a>
                )}
                <Link href={`/dashboard/companies/opportunities/${job.id}`}>
                  Full company page <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function Composer({
  job,
  draft,
  suggested,
  onWrite,
  onNotInterested,
}: {
  job: Job;
  draft?: Draft;
  suggested?: { name: string; role: string };
  onWrite: (recipient?: { name: string; role: string }) => Promise<void>;
  onNotInterested: () => void;
}) {
  const { data, busy, run, setMessage } = useWorkspace();
  const source = useSource();
  const [recipient, setRecipient] = useState<Recipient>(() => {
    const saved = readRecipients()[job.id];
    return {
      name: saved?.name || suggested?.name || "",
      email: saved?.email || "",
    };
  });
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");
  const [editing, setEditing] = useState(false);
  const dirty = !!draft && (subject !== draft.subject || body !== draft.body);

  const saveRecipient = (next: Recipient) => {
    setRecipient(next);
    writeRecipients({ ...readRecipients(), [job.id]: next });
  };
  const who = recipient.name
    ? {
        name: recipient.name,
        role: recipient.name === suggested?.name ? suggested.role : "",
      }
    : undefined;

  const send = async () => {
    if (dirty) await source.saveDraft(draft!, subject, body);
    window.location.href = mailtoLink(recipient.email, subject, body);
    await source.move(
      job,
      { stage: "Applied", channel: "Email", followUp: followUpIn(4) },
      `Opened in your email app. ${job.company} is now contacted; follow-up in 4 days.`,
    );
  };

  return (
    <section className="pipe-compose">
      <div className="pipe-compose-head">
        <b>New message</b>
        {draft && (
          <button
            aria-label="Copy email"
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(
                  `Subject: ${subject}\n\n${body}`,
                );
                setMessage("Email copied.");
              })
            }
          >
            <Copy size={14} />
          </button>
        )}
      </div>
      <div className="pipe-field">
        <span>From</span>
        <b>{data?.profile.name || "You"}</b>
        <small>via your email app</small>
      </div>
      <div className="pipe-field">
        <span>To</span>
        <input
          className="pipe-to-name"
          placeholder="Name"
          value={recipient.name}
          onChange={(e) =>
            saveRecipient({ ...recipient, name: e.target.value })
          }
          aria-label="Recipient name"
        />
        <input
          className="pipe-to-email"
          type="email"
          placeholder="email@company.com"
          value={recipient.email}
          onChange={(e) =>
            saveRecipient({ ...recipient, email: e.target.value })
          }
          aria-label="Recipient email"
        />
      </div>
      {draft ? (
        <>
          <div className="pipe-field">
            <span>Subject</span>
            <input
              className="pipe-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
            />
          </div>
          {editing ? (
            <textarea
              className="pipe-body editing"
              value={body}
              autoFocus
              onChange={(e) => setBody(e.target.value)}
              aria-label="Email body"
            />
          ) : (
            <div className="pipe-body" onDoubleClick={() => setEditing(true)}>
              {body}
            </div>
          )}
          <div className="pipe-actions">
            <Button
              className="pipe-dark"
              disabled={busy || !recipient.email.includes("@")}
              title={
                recipient.email.includes("@")
                  ? ""
                  : "Add the recipient's email first"
              }
              onClick={send}
            >
              Send
            </Button>
            {editing ? (
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  if (dirty)
                    void source.saveDraft(
                      draft,
                      subject,
                      body,
                      "Your edits are saved.",
                    );
                }}
              >
                Done
              </button>
            ) : (
              <button onClick={() => setEditing(true)}>Edit</button>
            )}
            <button disabled={busy} onClick={() => onWrite(who)}>
              Rewrite
            </button>
            <button disabled={busy} onClick={onNotInterested}>
              Not interested
            </button>
          </div>
          {draft.mode === "starter" && (
            <p className="pipe-hint">
              This is a starter template. Use Rewrite to write it from your
              résumé and LinkedIn.
            </p>
          )}
        </>
      ) : (
        <div className="pipe-write">
          <p>
            Written from your résumé, LinkedIn experience and this role. Nothing
            is sent until you press Send in your email app.
          </p>
          <Button
            className="pipe-dark"
            disabled={busy}
            onClick={() => onWrite(who)}
          >
            <Sparkles size={14} />
            {busy ? "Writing…" : "Write it for me"}
          </Button>
        </div>
      )}
    </section>
  );
}
