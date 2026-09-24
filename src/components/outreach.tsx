"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Asterisk,
  Mail,
  Sparkles,
  ArrowUpRight,
  Copy,
  Download,
  Check,
  Pencil,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace, request } from "./workspace";
import { Field, Empty, CompanyIcon, localDate } from "./shared";
import { WorkspaceSelect } from "./ui/select";
import type { Draft, Workspace } from "@/lib/model";
export function Outreach() {
  const { data, busy, run, replace, setMessage, mutate } = useWorkspace();
  const [jobId, setJobId] = useState("");
  useEffect(() => {
    const job = new URL(window.location.href).searchParams.get("job");
    if (job) setJobId(job);
  }, []);
  const [selected, setSelected] = useState<Draft | null>(null);
  if (!data) return null;
  const jobs = data.jobs.filter((j) => !j.sample && j.stage !== "Archived");
  const active = selected || data.drafts[0] || null;
  async function generate(useAI: boolean) {
    await run(async () => {
      const result = await request<{ workspace: Workspace; draft: Draft }>(
        "/api/draft",
        {
          method: "POST",
          body: JSON.stringify({ jobId: jobId || jobs[0]?.id, useAI }),
        },
      );
      replace(result.workspace);
      setSelected(result.draft);
      setMessage(
        useAI
          ? "A personal draft, shaped around your evidence and writing samples."
          : "Starter draft created. Fill the marked details before reaching out.",
      );
    });
  }
  return (
    <div className="outreach-layout">
      <div>
        <section className="panel outreach-setup">
          <div className="panel-heading">
            <div>
              <h2>Start with a real connection</h2>
              <p>One opportunity. One thoughtful introduction.</p>
            </div>
            <Mail size={18} />
          </div>
          <div className="form-stack">
            <Field label="Who are you reaching out to?">
              <WorkspaceSelect
                label="Outreach opportunity"
                value={jobId || jobs[0]?.id || "empty"}
                onValueChange={setJobId}
                disabled={!jobs.length}
                options={
                  jobs.length
                    ? jobs.map((j) => ({
                        value: j.id,
                        label: `${j.company} · ${j.role}`,
                      }))
                    : [{ value: "empty", label: "Save an opportunity first" }]
                }
              />
            </Field>
            <div className="outreach-evidence">
              <div>
                <span
                  className={
                    data.profile.projects.length ? "green-dot" : "neutral-dot"
                  }
                />
                {data.profile.projects.length} projects in your story
              </div>
              <div>
                <span
                  className={data.profile.writing ? "green-dot" : "neutral-dot"}
                />
                {data.profile.writing
                  ? "Your writing samples are ready"
                  : "Add writing samples for your voice"}
              </div>
            </div>
            <div className="outreach-generate">
              <Button
                disabled={busy || !jobs.length}
                variant="outline"
                onClick={() => generate(false)}
              >
                <Pencil size={14} />
                Create starter
              </Button>
              <Button
                disabled={busy || !jobs.length}
                className="orange-button"
                onClick={() => generate(true)}
              >
                <Sparkles size={14} />
                {busy ? "Working on it…" : "Draft in my voice"}
              </Button>
            </div>
            <p className="form-hint">
              AI drafts require a server key. Starter drafts work immediately.
              Nothing is sent automatically.
            </p>
          </div>
        </section>
        <section className="panel draft-list">
          <div className="panel-heading">
            <h2>
              Your introductions{" "}
              <span className="count-pill">{data.drafts.length}</span>
            </h2>
            <FileText size={17} />
          </div>
          {data.drafts.map((d) => {
            const j = data.jobs.find((j) => j.id === d.jobId);
            return (
              <button
                key={d.id}
                className={`draft-list-item ${active?.id === d.id ? "active" : ""}`}
                onClick={() => setSelected(d)}
              >
                <CompanyIcon name={j?.company || "?"} />
                <div>
                  <b>{j?.company || "Saved opportunity"}</b>
                  <p>{d.subject}</p>
                  <small>
                    {localDate(d.createdAt)} ·{" "}
                    {d.mode === "ai" ? "AI draft" : "Starter"}
                  </small>
                </div>
                <ArrowUpRight size={14} />
              </button>
            );
          })}
          {!data.drafts.length && (
            <div className="inline-empty">
              <Mail size={25} />
              <p>A thoughtful hello starts here.</p>
            </div>
          )}
        </section>
        <div className="profile-note">
          <Asterisk size={23} />
          <h3>Your voice is the whole point.</h3>
          <p>
            A specific project. A real reason to care. A simple invitation to
            talk. Start there.
          </p>
          <Link href="/dashboard/profile">
            Add your writing samples <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      {active ? (
        <DraftEditor key={active.id} draft={active} />
      ) : (
        <section className="panel draft-empty">
          <Empty
            title="A little context. A better hello."
            text="Save an opportunity and add your story. Then create a starter or draft an introduction in your own voice."
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/discover">
                  Find an opportunity <ArrowUpRight size={14} />
                </Link>
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}
function DraftEditor({ draft }: { draft: Draft }) {
  const { data, busy, mutate, run, setMessage } = useWorkspace();
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const job = data?.jobs.find((j) => j.id === draft.jobId);
  function exportDraft() {
    const text = `Subject: ${subject.replace(/[\r\n]/g, " ")}\r\nContent-Type: text/plain; charset=UTF-8\r\nX-Unsent: 1\r\n\r\n${body}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "message/rfc822" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job?.company || "outreach"}-draft.eml`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel draft-editor">
      <div className="draft-editor-header">
        <div>
          <span className="draft-pill">
            <span className="orange-dot" />
            DRAFT · NOT SENT
          </span>
          <h2>A note to {job?.company || "the team"}</h2>
        </div>
        <span>
          {draft.mode === "ai"
            ? "YOUR VOICE + YOUR EVIDENCE"
            : "STARTER · REVIEW MARKED DETAILS"}
        </span>
      </div>
      <div className="email-recipient">
        <span>To</span>
        <b>Add the verified recipient in your email app</b>
      </div>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <label className="email-body-label">
        <span className="sr-only">Email body</span>
        <textarea
          className="email-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <div className="draft-editor-footer">
        <p>
          <Check size={13} />
          Review facts, links, and recipient before sending.
        </p>
        <div>
          <Button
            variant="outline"
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(
                  `Subject: ${subject}\n\n${body}`,
                );
                setMessage("Draft copied. Ready for your final review.");
              })
            }
          >
            <Copy size={14} />
            Copy
          </Button>
          <Button variant="outline" onClick={exportDraft}>
            <Download size={14} />
            .eml
          </Button>
          <Button
            className="orange-button"
            disabled={busy}
            onClick={() =>
              mutate(
                { action: "draft", id: draft.id, subject, body },
                "Your edits are saved.",
              )
            }
          >
            Save draft
          </Button>
        </div>
      </div>
    </section>
  );
}
