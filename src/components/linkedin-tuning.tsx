"use client";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  FileText,
  History,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  ChevronDown,
  Info,
  ArrowUp,
  Pencil,
} from "lucide-react";
import { Button } from "./ui/button";
import { Mark } from "./mark";
import { WorkspaceSelect } from "./ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Field, Empty, External } from "./shared";
import { request } from "./workspace";
import { wordChanges } from "@/lib/linkedin-diff";
import type {
  LinkedInSection,
  LinkedInTuningState,
  ProfileReview,
  ResearchRun,
  Revision,
} from "@/lib/linkedin-types";
export function LinkedInTuning({ research = false }: { research?: boolean }) {
  const [state, setState] = useState<LinkedInTuningState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [snapshot, setSnapshot] = useState<{
    text: string;
    note: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mode, setMode] = useState("proposal");
  const [panel, setPanel] = useState("document");
  const chatScroll = useRef<HTMLDivElement>(null);
  const [researchData, setResearchData] = useState<{
    run: ResearchRun | null;
    profiles: ProfileReview[];
  } | null>(null);
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("All cohorts");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      request<LinkedInTuningState>("/api/linkedin", {
        signal: controller.signal,
      }),
      request<{ run: ResearchRun | null; profiles: ProfileReview[] }>(
        "/api/linkedin/research",
        { signal: controller.signal },
      ),
    ])
      .then(([state, benchmark]) => {
        setState(state);
        setUrl(state.profileUrl);
        setSelected(state.sections[0]?.id || "");
        setResearchData(benchmark);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const section =
    state?.sections.find((section) => section.id === selected) ||
    state?.sections[0];
  const sectionMessages =
    state?.messages.filter(
      (message) =>
        message.sectionId === section?.id || message.sectionId === null,
    ) || [];
  const revisions = sectionMessages
    .flatMap((item) => item.revisions)
    .filter((revision) => revision.sectionId === section?.id);
  const latestRevision = revisions.at(-1);
  const recentMessages = sectionMessages.slice(-2);
  const olderMessages = sectionMessages.slice(0, -2);
  useEffect(() => {
    const container = chatScroll.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [state?.messages.length, selected, busy]);
  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setSyncing(true);
    try {
      await work(async () => {
        if (url !== state?.profileUrl)
          setState(
            await request<LinkedInTuningState>("/api/linkedin", {
              method: "PATCH",
              body: JSON.stringify({ action: "url", url }),
            }),
          );
        const result = await request<{
          state: LinkedInTuningState;
          snapshot: { text: string; note: string };
        }>("/api/linkedin/sync", {
          method: "POST",
          signal: AbortSignal.timeout(35000),
        });
        setState(result.state);
        setSnapshot(result.snapshot);
        setNotice(result.state.syncNote);
      });
    } finally {
      setSyncing(false);
    }
  }
  async function chat(text: string) {
    if (!section || draftDirty) return;
    await work(async () => {
      const response = await request<LinkedInTuningState>(
        "/api/linkedin/chat",
        {
          method: "POST",
          body: JSON.stringify({ message: text, sectionId: section.id }),
          signal: AbortSignal.timeout(65000),
        },
      );
      setState(response);
      setMessage("");
      setMode("proposal");
    });
  }
  if (!state)
    return (
      <div className="workspace-loading" role="status">
        {error || "Loading LinkedIn tuning…"}
      </div>
    );
  const researchRun = researchData?.run;
  return (
    <div
      className={`linkedin-tuning-page ${research ? "research-page" : "studio-page"}`}
    >
      <div className="linkedin-page-nav">
        <Link
          href={research ? "/dashboard/linkedin" : "/dashboard/profile"}
          className="back-link"
        >
          <ArrowLeft size={14} />
          {research ? "LinkedIn tuning" : "Your story"}
        </Link>
        <div>
          <Link
            className={!research ? "active" : ""}
            href="/dashboard/linkedin"
          >
            <MessageSquare size={14} />
            Studio
          </Link>
          <Link
            className={research ? "active" : ""}
            href="/dashboard/linkedin/research"
          >
            <BookOpen size={14} />
            Research
            <Badge variant="secondary">{researchRun?.reviewedCount || 0}</Badge>
          </Link>
        </div>
      </div>
      {error && (
        <div className="status-message error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="status-message success" role="status">
          <Check size={15} />
          {notice}
          <button aria-label="Dismiss update" onClick={() => setNotice("")}>
            <Check size={14} />
          </button>
        </div>
      )}
      {research ? (
        <>
          <Card className="linkedin-research-intro">
            <CardHeader>
              <span className="tiny-kicker">
                READ THE WORK, NOT THE FOLLOWER COUNT
              </span>
              <CardTitle>
                {researchRun
                  ? `${researchRun.reviewedCount} profile reviews`
                  : "Your research library is empty."}
              </CardTitle>
              <CardDescription>
                Engineering profiles reviewed for how they explain ownership,
                systems, and measurable outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="research-method-row">
                <span>
                  <ShieldCheck size={14} />
                  Quotes checked against source text
                </span>
                <span>
                  <History size={14} />
                  {researchRun
                    ? new Date(
                        researchRun.completedAt || researchRun.startedAt,
                      ).toLocaleDateString()
                    : "No benchmark yet"}
                </span>
                <span>Self-reported claims · indexed text</span>
              </div>
            </CardContent>
          </Card>
          {researchRun && (
            <details className="research-insights">
              <summary>
                <BookOpen size={15} />
                <strong>Writing patterns from the research</strong>
                <span>{researchRun.insights.length} insights</span>
                <ChevronDown size={15} />
              </summary>
              <div className="research-insights-grid">
                {researchRun.insights.map((insight) => (
                  <article key={insight.title}>
                    <div>
                      <h3>{insight.title}</h3>
                      <span>
                        {insight.count}/{researchRun.reviewedCount}
                      </span>
                    </div>
                    <p>{insight.detail}</p>
                    <div>
                      {insight.urls.slice(0, 2).map((url) => (
                        <External key={url} href={url}>
                          Example profile
                        </External>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          )}
          <div className="linkedin-library-toolbar">
            <label className="search-field">
              <BookOpen size={15} />
              <input
                aria-label="Search researched profiles"
                placeholder="Search systems, people, or writing lessons…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <WorkspaceSelect
              label="Research cohort"
              value={cohort}
              onValueChange={setCohort}
              options={[
                "All cohorts",
                ...new Set(researchData?.profiles.map((p) => p.cohort) || []),
              ].map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="research-profile-list">
            <div className="research-list-heading">
              <span>Profile & focus</span>
              <span>Cohort</span>
              <span>Review</span>
            </div>
            {researchData?.profiles
              .filter(
                (profile) =>
                  (cohort === "All cohorts" || profile.cohort === cohort) &&
                  `${profile.name} ${profile.summary} ${profile.takeaway}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((profile) => (
                <details className="research-profile-entry" key={profile.url}>
                  <summary>
                    <span className="research-person-symbol">
                      <UserRound size={17} />
                    </span>
                    <div>
                      <strong>{profile.name}</strong>
                      <p>{profile.summary}</p>
                    </div>
                    <span className="research-cohort">{profile.cohort}</span>
                    <ChevronDown size={15} />
                  </summary>
                  <div className="research-profile-detail">
                    <div>
                      <h3>Writing lesson</h3>
                      <p>{profile.takeaway}</p>
                      <div className="review-signal-tags">
                        {profile.signals.map((signal) => (
                          <Badge key={signal} variant="outline">
                            {signal.replaceAll("-", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Source evidence</h3>
                      <blockquote>{profile.evidence}</blockquote>
                      <External href={profile.url}>Read profile</External>
                      <small>{profile.caution}</small>
                    </div>
                  </div>
                </details>
              ))}
          </div>
          {researchRun && (
            <details className="research-methodology">
              <summary>
                <ShieldCheck size={14} />
                How these profiles were reviewed
              </summary>
              <p>{researchRun.methodology}</p>
            </details>
          )}
        </>
      ) : (
        <>
          <div className="studio-topbar">
            <div className="studio-context">
              <span className="linkedin-glyph">in</span>
              <div>
                <strong>LinkedIn tuning</strong>
                <span>Turn your work into a clear profile.</span>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="studio-profile-button">
                  <UserRound size={14} />
                  Profile connection
                  <ChevronDown size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="studio-connection">
                <h3>Your LinkedIn profile</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sync();
                  }}
                >
                  <Field label="Profile link">
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/in/your-name"
                    />
                  </Field>
                  <Button variant="outline" disabled={busy}>
                    <RefreshCw size={14} className={syncing ? "spin" : ""} />
                    {syncing ? "Checking…" : "Refresh public profile"}
                  </Button>
                </form>
                {state.profileUrl && (
                  <External href={state.profileUrl}>
                    Open LinkedIn profile
                  </External>
                )}
                <p>
                  {state.syncStatus === "unavailable"
                    ? "LinkedIn requires sign-in. Paste your current text in the editor to keep Trail up to date."
                    : "Public refreshes are reviewed here before they change your saved text."}
                </p>
                {state.lastCheckedAt && (
                  <small>
                    Last checked{" "}
                    {new Date(state.lastCheckedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                )}
                {snapshot?.text && (
                  <details>
                    <summary>Retrieved public text</summary>
                    <p>{snapshot.text}</p>
                  </details>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="studio-workspace">
            <div className="studio-workspace-toolbar">
              <div>
                <WorkspaceSelect
                  label="Profile section"
                  value={section?.id || ""}
                  onValueChange={(value) => {
                    setSelected(value);
                    setDraftDirty(false);
                  }}
                  options={state.sections.map((s) => ({
                    value: s.id,
                    label: s.label,
                  }))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add an experience section"
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      const id = crypto.randomUUID();
                      const next = await request<LinkedInTuningState>(
                        "/api/linkedin",
                        {
                          method: "PATCH",
                          body: JSON.stringify({
                            action: "section",
                            section: {
                              id,
                              label: "New experience",
                              kind: "experience",
                              company: "",
                              title: "",
                              dates: "",
                              currentText: "",
                              facts: "",
                            },
                          }),
                        },
                      );
                      setState(next);
                      setSelected(id);
                      setMode("facts");
                    })
                  }
                >
                  <Plus size={16} />
                </Button>
              </div>
              <Link href="/dashboard/linkedin/research">
                <BookOpen size={14} />
                <span>{researchRun?.reviewedCount || 0} profile reviews</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
            <div
              className="studio-mobile-switch"
              role="tablist"
              aria-label="Studio panels"
            >
              <button
                role="tab"
                aria-selected={panel === "document"}
                onClick={() => setPanel("document")}
              >
                <FileText size={14} />
                Editor
              </button>
              <button
                role="tab"
                aria-selected={panel === "chat"}
                onClick={() => setPanel("chat")}
              >
                <MessageSquare size={14} />
                Chat
              </button>
            </div>
            <div className={`studio-panels show-${panel}`}>
              <div className="studio-document">
                {section ? (
                  <SectionEditor
                    key={`${section.id}-${section.version}`}
                    section={section}
                    busy={busy}
                    mode={mode}
                    setMode={setMode}
                    onDirty={setDraftDirty}
                    revision={latestRevision}
                    onConfirmed={(revision) =>
                      void work(async () => {
                        setState(
                          await request<LinkedInTuningState>("/api/linkedin", {
                            method: "PATCH",
                            body: JSON.stringify({
                              action: "confirm-published",
                              revisionId: revision.id,
                              confirmed: true,
                            }),
                          }),
                        );
                        setNotice(
                          "LinkedIn update recorded. Future drafts will use this text.",
                        );
                      })
                    }
                    onSave={(next) =>
                      void work(async () => {
                        setState(
                          await request<LinkedInTuningState>("/api/linkedin", {
                            method: "PATCH",
                            body: JSON.stringify({
                              action: "section",
                              section: next,
                              expectedVersion: section.version,
                            }),
                          }),
                        );
                        setDraftDirty(false);
                        setNotice("Your text and supporting facts are saved.");
                      })
                    }
                  />
                ) : (
                  <Empty
                    title="Add a profile section"
                    text="Start with your current text and what you built."
                  />
                )}
              </div>
              <section
                className="studio-chat"
                aria-label="LinkedIn writing partner"
              >
                <header>
                  <span className="studio-assistant-mark">
                    <Mark />
                  </span>
                  <div>
                    <strong>Writing partner</strong>
                    <span>
                      {section?.company || section?.label || "Your profile"}
                    </span>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button aria-label="About the writing partner">
                        <Info size={15} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <h3>Built around your facts</h3>
                      <p>
                        Claude uses your saved text and contribution notes. The
                        research informs structure, never your accomplishments.
                        Missing metrics stay as questions.
                      </p>
                    </PopoverContent>
                  </Popover>
                </header>
                <div
                  className="studio-chat-scroll"
                  ref={chatScroll}
                  aria-live="polite"
                >
                  {!!olderMessages.length && (
                    <details className="studio-history">
                      <summary>
                        <History size={13} />
                        Earlier conversation <span>{olderMessages.length}</span>
                      </summary>
                      {olderMessages.map((item) => (
                        <article
                          key={item.id}
                          className={`studio-message ${item.role}`}
                        >
                          <small>
                            {item.role === "user" ? "You" : "Trail"}
                          </small>
                          <MessageBody text={item.content} />
                        </article>
                      ))}
                    </details>
                  )}
                  {!sectionMessages.length && (
                    <div className="studio-chat-welcome">
                      <span className="studio-welcome-symbol">
                        <Mark />
                      </span>
                      <h3>What should stand out?</h3>
                      <p>
                        Tell me what you built. We’ll make your contribution
                        clear and keep it sounding like you.
                      </p>
                    </div>
                  )}
                  {recentMessages.map((item) => (
                    <article
                      key={item.id}
                      className={`studio-message ${item.role}`}
                    >
                      {item.role === "assistant" && (
                        <span className="studio-message-author">
                          <Mark />
                          Trail
                        </span>
                      )}
                      {item.revisions.length ? (
                        <>
                          <p>
                            A draft is ready in the editor. It uses your saved
                            facts and keeps shared ownership clear.
                          </p>
                          <button
                            className="studio-show-draft"
                            onClick={() => {
                              setMode("proposal");
                              setPanel("document");
                            }}
                          >
                            <FileText size={14} />
                            Review draft
                            <ArrowUpRight size={13} />
                          </button>
                          <details className="studio-message-details">
                            <summary>Draft notes</summary>
                            <MessageBody text={item.content} />
                          </details>
                        </>
                      ) : (
                        <MessageBody text={item.content} />
                      )}
                    </article>
                  ))}
                  {busy && !syncing && (
                    <div className="studio-thinking" role="status">
                      <span />
                      <span />
                      <span />
                      <p>Checking your facts…</p>
                    </div>
                  )}
                  <div ref={end} />
                </div>
                <div className="studio-chat-bottom">
                  <div className="studio-prompt-chips">
                    <button
                      disabled={busy || draftDirty || !section}
                      onClick={() =>
                        void chat(
                          "Rewrite this section in concise, natural language. Preserve shared ownership and use only my saved facts. Ask for useful metrics separately.",
                        )
                      }
                    >
                      Rewrite section
                    </button>
                    <button
                      disabled={busy || draftDirty || !section}
                      onClick={() =>
                        void chat(
                          "What specific, verifiable metrics would make this section stronger? Do not invent numbers.",
                        )
                      }
                    >
                      Find useful metrics
                    </button>
                  </div>
                  <form
                    className="studio-chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (message.trim()) void chat(message.trim());
                    }}
                  >
                    {draftDirty && (
                      <p className="studio-unsaved">
                        Save your edits before asking for a draft.
                      </p>
                    )}
                    <textarea
                      aria-label="Message your LinkedIn writing partner"
                      rows={2}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell me what you want to improve…"
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey) &&
                          message.trim()
                        ) {
                          e.preventDefault();
                          void chat(message.trim());
                        }
                      }}
                    />
                    <div>
                      <span>⌘ Enter to send</span>
                      <Button
                        type="submit"
                        size="icon"
                        aria-label="Send message"
                        disabled={
                          busy || draftDirty || !message.trim() || !section
                        }
                      >
                        <ArrowUp size={16} />
                      </Button>
                    </div>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function SectionEditor({
  section,
  busy,
  mode,
  setMode,
  onSave,
  onDirty,
  revision,
  onConfirmed,
}: {
  section: LinkedInSection;
  busy: boolean;
  mode: string;
  setMode: (mode: string) => void;
  onSave: (section: LinkedInSection) => void;
  onDirty: (dirty: boolean) => void;
  revision?: Revision;
  onConfirmed: (revision: Revision) => void;
}) {
  const [draft, setDraftState] = useState(section);
  function setDraft(next: SetStateAction<LinkedInSection>) {
    setDraftState(next);
    onDirty(true);
  }
  const activeMode = mode === "proposal" && !revision ? "current" : mode;
  return (
    <div className="studio-editor">
      <div className="studio-document-heading">
        <span>
          {section.kind === "experience"
            ? "Experience"
            : section.kind === "about"
              ? "About"
              : "Headline"}
        </span>
        <h2>{section.company || section.label}</h2>
        {section.title && (
          <p>
            {section.title}
            {section.dates && ` · ${section.dates}`}
          </p>
        )}
      </div>
      <Tabs value={activeMode} onValueChange={setMode}>
        <TabsList variant="line" aria-label="Section content">
          <TabsTrigger value="current">Current text</TabsTrigger>
          <TabsTrigger value="facts">Your contribution</TabsTrigger>
          <TabsTrigger value="proposal" disabled={!revision}>
            Suggested draft{revision && <span className="draft-indicator" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="proposal">
          {revision && (
            <RevisionCard
              revision={revision}
              section={section}
              busy={busy}
              onConfirmed={() => onConfirmed(revision)}
            />
          )}
        </TabsContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
          }}
        >
          <TabsContent value="current">
            {section.kind === "experience" && (
              <details className="studio-role-details">
                <summary>
                  <Pencil size={13} />
                  Edit role details
                </summary>
                <div className="studio-role-fields">
                  <Field label="Company">
                    <input
                      value={draft.company}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          company: e.target.value,
                          label: e.target.value
                            ? `${e.target.value} · Experience`
                            : "New experience",
                        })
                      }
                    />
                  </Field>
                  <Field label="Job title">
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setDraft({ ...draft, title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Dates">
                    <input
                      value={draft.dates}
                      onChange={(e) =>
                        setDraft({ ...draft, dates: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </details>
            )}
            <label
              className="studio-text-label"
              htmlFor={`current-${section.id}`}
            >
              What’s on LinkedIn now
            </label>
            <textarea
              id={`current-${section.id}`}
              className="studio-document-text"
              rows={11}
              value={draft.currentText}
              onChange={(e) =>
                setDraft({ ...draft, currentText: e.target.value })
              }
              placeholder="Paste your current description here. You can start with an empty section."
            />
          </TabsContent>
          <TabsContent value="facts">
            <label
              className="studio-text-label"
              htmlFor={`facts-${section.id}`}
            >
              What you personally built
            </label>
            <p className="studio-editor-hint">
              Include the systems, decisions, team ownership, and results you
              can verify.
            </p>
            <textarea
              id={`facts-${section.id}`}
              className="studio-document-text"
              rows={12}
              value={draft.facts}
              onChange={(e) => setDraft({ ...draft, facts: e.target.value })}
              placeholder="Describe your contribution in your own words…"
            />
          </TabsContent>
          {activeMode !== "proposal" && (
            <div className="studio-editor-footer">
              <span>
                {activeMode === "facts"
                  ? "Your facts guide every draft."
                  : "Keep this in sync after editing LinkedIn."}
              </span>
              <Button variant="outline" disabled={busy} type="submit">
                <Check size={14} />
                Save edits
              </Button>
            </div>
          )}
        </form>
      </Tabs>
    </div>
  );
}
function MessageBody({ text }: { text: string }) {
  return (
    <div className="studio-message-body">
      {text.split(/\n\s*\n/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

function RevisionCard({
  revision,
  section,
  busy,
  onConfirmed,
}: {
  revision: Revision;
  section?: LinkedInSection;
  busy: boolean;
  onConfirmed: () => void;
}) {
  const [view, setView] = useState("changes");
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const stale =
    !!section &&
    (section.currentText !== revision.beforeText ||
      section.version !== revision.baseVersion) &&
    revision.status !== "published";
  return (
    <div className="linkedin-revision">
      <div className="revision-top">
        <span className="tiny-kicker">Suggested replacement</span>
        <Badge variant="outline">
          {revision.status === "published"
            ? "Recorded as published"
            : stale
              ? "Current text changed"
              : "Draft"}
        </Badge>
      </div>
      <details className="revision-rationale">
        <summary>Why this draft</summary>
        <p>{revision.rationale}</p>
      </details>
      <div className="revision-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(revision.afterText);
              setCopied(true);
            } catch {
              setView("ready");
            }
          }}
        >
          <Copy size={14} />
          {copied ? "Copied" : "Copy text"}
        </Button>
        {revision.status !== "published" && !stale && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirm((v) => !v)}
          >
            I’ve updated LinkedIn
            <Check size={14} />
          </Button>
        )}
      </div>
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="ready">Ready to paste</TabsTrigger>
        </TabsList>
        <TabsContent value="changes">
          <div className="revision-legend">
            <span>+ Additions</span>
            <span>− Removals are crossed out</span>
          </div>
          <div className="revision-diff">
            {wordChanges(revision.beforeText, revision.afterText).map(
              (piece, index) =>
                piece.kind === "added" ? (
                  <ins key={index}>{piece.text}</ins>
                ) : piece.kind === "removed" ? (
                  <del key={index}>{piece.text}</del>
                ) : (
                  <span key={index}>{piece.text}</span>
                ),
            )}
          </div>
        </TabsContent>
        <TabsContent value="ready">
          <div className="revision-ready">{revision.afterText}</div>
        </TabsContent>
      </Tabs>
      <details className="revision-evidence">
        <summary>
          <ShieldCheck size={13} />
          Facts used in this draft
        </summary>
        {revision.supportingFacts.map((fact, index) => (
          <p key={index}>{fact}</p>
        ))}
      </details>
      {!!revision.missingMetrics.length && (
        <details className="revision-metric-questions">
          <summary>Metrics to add when you can verify them</summary>
          {revision.missingMetrics.map((metric, index) => (
            <p key={index}>{metric}</p>
          ))}
        </details>
      )}
      {confirm && (
        <div className="revision-confirm">
          <p>
            Confirm you pasted this revision into LinkedIn. Trail will save it
            as your current text for future suggestions.
          </p>
          <Button disabled={busy} onClick={onConfirmed}>
            Record as current
            <Check size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
