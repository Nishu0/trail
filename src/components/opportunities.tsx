"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Asterisk,
  Search,
  ArrowUpRight,
  MapPin,
  SlidersHorizontal,
  Bookmark,
  Mail,
  Clock3,
  ChevronDown,
  Plus,
  Archive,
  Circle,
  Send,
  MessagesSquare,
  PartyPopper,
} from "lucide-react";
import { JobChecks } from "./job-checks";
import { WorkspaceSelect } from "./ui/select";
import { Button } from "@/components/ui/button";
import { useWorkspace, request } from "./workspace";
import {
  Modal,
  Field,
  CompanyIcon,
  Empty,
  External,
  localDate,
} from "./shared";
import {
  fit,
  dueJobs,
  type Job,
  type Source,
  type Stage,
  type Channel,
  type Workspace,
} from "@/lib/model";
export function AddOpportunity({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, replace, setMessage, busy } = useWorkspace();
  const [source, setSource] = useState<Source>("X");
  return (
    <Modal
      title="Save a little signal"
      description="Add a real opportunity from X, LinkedIn, YC, or a company’s careers page."
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const w = await request<Workspace>("/api/workspace", {
              method: "PATCH",
              body: JSON.stringify({
                action: "add-job",
                job: {
                  company: f.get("company"),
                  role: f.get("role"),
                  url: f.get("url"),
                  source,
                  location: f.get("location"),
                  description: f.get("description"),
                  tags: String(f.get("tags"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  notes: "",
                },
              }),
            });
            replace(w);
            setMessage("A new opportunity, saved to your trail.");
            onOpenChange(false);
          });
        }}
      >
        <div className="form-grid">
          <Field label="Company">
            <input
              name="company"
              placeholder="The team you’re curious about"
              required
            />
          </Field>
          <Field label="Role">
            <input name="role" placeholder="Product engineer" required />
          </Field>
        </div>
        <Field label="Original job link">
          <input name="url" type="url" placeholder="https://…" required />
        </Field>
        <div className="form-grid">
          <Field label="Found on">
            <WorkspaceSelect
              label="Found on"
              value={source}
              onValueChange={(v) => setSource(v as Source)}
              options={["X", "LinkedIn", "YC", "Other"].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Field>
          <Field label="Location">
            <input
              name="location"
              placeholder="Remote, India, San Francisco…"
            />
          </Field>
        </div>
        <Field label="What are they looking for?">
          <textarea
            name="description"
            rows={4}
            placeholder="Paste the role description. Specific details make better introductions."
          />
        </Field>
        <Field label="Skills / tags">
          <input name="tags" placeholder="TypeScript, React, developer tools" />
        </Field>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="orange-button" disabled={busy} type="submit">
            <Bookmark size={15} />
            Save opportunity
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Opportunities({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (v: string) => void;
}) {
  const { data, busy, mutate } = useWorkspace();
  const [source, setSource] = useState("All sources");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState("Newest");
  if (!data) return null;
  const jobs = data.jobs
    .filter(
      (j) =>
        j.stage !== "Archived" &&
        (source === "All sources" || j.source === source) &&
        (!remote || j.location.toLowerCase().includes("remote")) &&
        `${j.company} ${j.role} ${j.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Best fit"
        ? (fit(b, data.profile).score || 0) - (fit(a, data.profile).score || 0)
        : b.addedAt.localeCompare(a.addedAt),
    );
  return (
    <>
      <JobChecks />
      <div className="filter-toolbar">
        <div className="source-tabs">
          {["All sources", "YC", "X", "LinkedIn"].map((s) => (
            <button
              key={s}
              aria-pressed={source === s}
              className={source === s ? "active" : ""}
              onClick={() => setSource(s)}
            >
              {s === "YC" && <span className="tiny-yc">Y</span>}
              {s}
            </button>
          ))}
        </div>
        <div className="toolbar-controls">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Search roles or companies…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => setRemote(!remote)}
            aria-pressed={remote}
          >
            <SlidersHorizontal size={14} />
            {remote ? "Remote only" : "All locations"}
          </Button>
        </div>
      </div>
      <div className="list-caption">
        <span>
          {jobs.length} opportunities{" "}
          <span className="muted">
            ·{" "}
            {data.jobs.some((j) => j.sample)
              ? "sample leads clearly marked"
              : "with original source links"}
          </span>
        </span>
        <label>
          Sort by{" "}
          <WorkspaceSelect
            label="Sort opportunities"
            value={sort}
            onValueChange={setSort}
            options={["Newest", "Best fit"].map((value) => ({
              value,
              label: value,
            }))}
          />
        </label>
      </div>
      {!data.profile.skills && (
        <div className="soft-notice">
          <Asterisk size={23} />
          <p>
            Add your skills and target roles to make discovery more personal.
          </p>
          <Link href="/dashboard/profile">
            Add your story <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <div className="job-grid">
        {jobs.map((job) => {
          const match = fit(job, data.profile);
          return (
            <article key={job.id} className="panel job-card">
              <div className="job-card-top">
                <CompanyIcon name={job.company} />
                <span className={`source-badge ${job.source.toLowerCase()}`}>
                  {job.source}
                </span>
              </div>
              <div className="job-company">
                {job.company}
                {job.sample && <span className="sample-pill">SAMPLE</span>}
              </div>
              <h2>
                <Link href={`/dashboard/companies/opportunities/${job.id}`}>
                  {job.role}
                </Link>
              </h2>
              <p className="job-description">
                {job.description ||
                  "Open the source for the complete role description."}
              </p>
              <div className="job-location">
                <MapPin size={13} />
                {job.location || "See listing"}
              </div>
              <div className="tag-row">
                {job.tags.slice(0, 4).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="job-card-bottom">
                <span>
                  {job.sample
                    ? "Illustrative opportunity"
                    : match.score === null
                      ? "Your fit starts with your story"
                      : `${match.score}% keyword overlap`}
                </span>
                <Link href={`/dashboard/companies/opportunities/${job.id}`}>
                  Take a look <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!jobs.length && (
        <Empty
          title="There’s more out there."
          text="Try another filter, search YC, X and LinkedIn, or save a job link you found."
        />
      )}
      {data.jobs.some((j) => j.sample) && (
        <button
          className="remove-samples"
          disabled={busy}
          onClick={() =>
            mutate({ action: "clear-samples" }, "Sample opportunities removed.")
          }
        >
          Clear sample leads from my workspace
        </button>
      )}
    </>
  );
}
export function Applications() {
  const { data, now, busy, mutate } = useWorkspace();
  const [add, setAdd] = useState(false);
  const [archived, setArchived] = useState(false);
  if (!data) return null;
  const jobs = data.jobs.filter((j) => !j.sample && j.stage !== "Archived");
  const due = dueJobs(jobs, now);
  const nextDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };
  return (
    <>
      {due.length > 0 && (
        <div className="followup-strip">
          <Clock3 size={20} />
          <div>
            <b>
              {due.length} thoughtful follow-up{due.length > 1 ? "s" : ""}{" "}
              waiting
            </b>
            <p>{due.map((j) => j.company).join(", ")}</p>
          </div>
          {due.map((j) => (
            <Button
              key={j.id}
              disabled={busy}
              variant="outline"
              onClick={() =>
                mutate(
                  { action: "snooze", id: j.id, followUp: nextDate() },
                  `Follow-up with ${j.company} moved forward 3 days.`,
                )
              }
            >
              Snooze {j.company}
            </Button>
          ))}
        </div>
      )}
      <div className="board-toolbar">
        <div className="pipeline-view-tabs">
          <button aria-pressed={!archived} onClick={() => setArchived(false)}>
            Pipeline <span>{jobs.length}</span>
          </button>
          <button aria-pressed={archived} onClick={() => setArchived(true)}>
            <Archive size={14} />
            Archive{" "}
            <span>
              {data.jobs.filter((j) => j.stage === "Archived").length}
            </span>
          </button>
        </div>
        <Button variant="outline" onClick={() => setAdd(true)}>
          <Plus size={14} />
          Add application
        </Button>
      </div>
      <JobChecks />
      {archived ? (
        <div className="archived-job-list">
          {data.jobs
            .filter((j) => j.stage === "Archived")
            .map((j) => (
              <Link
                key={j.id}
                href={`/dashboard/companies/opportunities/${j.id}`}
              >
                <CompanyIcon name={j.company} logoUrl={j.logoUrl} />
                <div>
                  <b>{j.role}</b>
                  <span>
                    {j.company} · {j.health?.reason || "Archived by you"}
                  </span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          {!data.jobs.some((j) => j.stage === "Archived") && (
            <Empty
              title="No archived opportunities"
              text="Closed and removed listings appear here with their application history."
            />
          )}
        </div>
      ) : (
        <div className="application-board">
          {(["Saved", "Applied", "Interview", "Offer"] as Stage[]).map(
            (stage) => (
              <section className="board-column" key={stage}>
                <div className="column-heading">
                  {stage === "Saved" ? (
                    <Bookmark size={15} />
                  ) : stage === "Applied" ? (
                    <Send size={15} />
                  ) : stage === "Interview" ? (
                    <MessagesSquare size={15} />
                  ) : (
                    <PartyPopper size={15} />
                  )}
                  <b>{stage}</b>
                  <span>{jobs.filter((j) => j.stage === stage).length}</span>
                </div>
                <div className="board-card-list">
                  {jobs
                    .filter((j) => j.stage === stage)
                    .map((j) => (
                      <Link
                        key={j.id}
                        className="application-card"
                        href={`/dashboard/companies/opportunities/${j.id}`}
                      >
                        <div>
                          <CompanyIcon name={j.company} />
                          <span>{j.company}</span>
                          <ArrowUpRight size={13} />
                        </div>
                        <h3>{j.role}</h3>
                        <p>
                          <span
                            className={`source-badge ${j.source.toLowerCase()}`}
                          >
                            {j.source}
                          </span>{" "}
                          {j.channel || "Not applied yet"}
                          {j.appliedAt && ` · ${localDate(j.appliedAt)}`}
                        </p>
                        {j.followUp && (
                          <small>
                            <Clock3 size={12} />
                            Follow up {j.followUp}
                          </small>
                        )}
                      </Link>
                    ))}
                </div>
                {!jobs.some((j) => j.stage === stage) && (
                  <div className="board-empty">
                    <Circle size={22} />
                    <b>No {stage.toLowerCase()} roles</b>
                    <span>
                      {stage === "Saved"
                        ? "Save a role from Discover."
                        : stage === "Applied"
                          ? "Log your application after sending it."
                          : stage === "Interview"
                            ? "Move a role here when you hear back."
                            : "Keep your offers together here."}
                    </span>
                  </div>
                )}
              </section>
            ),
          )}
        </div>
      )}
      <div className="soft-notice">
        <ArrowUpRight size={22} />
        <p>
          Log an application after you send it. Trail tracks email, X, and job
          forms without sending on your behalf.
        </p>
      </div>
      <AddOpportunity open={add} onOpenChange={setAdd} />
    </>
  );
}
