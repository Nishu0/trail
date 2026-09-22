"use client";
import { useEffect, useState, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Asterisk,
  ChevronRight,
  Code2,
  Database,
  Building2,
  Sparkles,
  PenLine,
  UsersRound,
  UserRound,
  ArrowUpRight,
  GitBranch,
  Star,
  RefreshCw,
  Check,
  Mail,
  Globe,
  Search,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Empty, External, localDate } from "./shared";
import { useWorkspace, request } from "./workspace";
import { ResumeUpload, type ResumeWorkflow } from "./profile-imports";
import { ProfileProjectDetail, newProject } from "./profile-project";
import type { Profile } from "@/lib/model";
import type { Repo } from "@/lib/github";
export function ProfileView({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [draftProject, setDraftProject] = useState(newProject);
  const { data, mutate, busy, profileDraft, setProfileDraft } = useWorkspace();
  const profile = profileDraft || data?.profile;
  function setProfile(next: SetStateAction<Profile | null>) {
    setProfileDraft((current) =>
      typeof next === "function"
        ? next(current || data?.profile || null)
        : next,
    );
  }
  const [resumeWorkflow, setResumeWorkflow] = useState<ResumeWorkflow>("idle");
  useEffect(() => {
    if (!projectId && window.location.hash === "#projects")
      document.getElementById("projects")?.scrollIntoView({ block: "start" });
  }, [projectId, profile?.projects.length]);
  if (!profile) return null;
  function field(key: keyof Profile, value: string) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }
  if (projectId) {
    const project =
      profile.projects.find(
        (p) => p.id === (projectId === "new" ? draftProject.id : projectId),
      ) || (projectId === "new" ? draftProject : undefined);
    return (
      <ProfileProjectDetail
        key={projectId === "new" ? draftProject.id : projectId}
        project={project}
        profile={profile}
        onProfileChange={setProfile}
        onBack={() => router.push("/dashboard/profile#projects")}
      />
    );
  }
  return (
    <form
      className="profile-layout"
      onSubmit={(e) => {
        e.preventDefault();
        if (resumeWorkflow !== "idle") return;
        void mutate(
          { action: "profile", profile },
          "Your builder story is saved.",
        );
      }}
    >
      <div className="profile-main">
        <div className="profile-linkedin-entry">
          <div>
            <span className="tiny-kicker">YOUR NEXT INTRODUCTION</span>
            <h2>Give your LinkedIn a clearer story.</h2>
            <p>Research-backed writing, with your actual work at the center.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/linkedin">
              LinkedIn tuning
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
        <ResumeUpload
          profile={profile}
          savedResume={data?.profile.resume}
          onChange={setProfile}
          onWorkflowChange={setResumeWorkflow}
        />
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="tiny-kicker">
                01 / THE PERSON BEHIND THE PROJECTS
              </span>
              <h2>A little about you</h2>
            </div>
            <Asterisk className="soft-icon" size={21} />
          </div>
          <div className="form-stack">
            <div className="form-grid">
              <Field label="Your name">
                <input
                  value={profile.name}
                  onChange={(e) => field("name", e.target.value)}
                  placeholder="Nisarg"
                />
              </Field>
              <Field label="How you describe your work">
                <input
                  value={profile.headline}
                  onChange={(e) => field("headline", e.target.value)}
                  placeholder="Full stack builder & open source contributor"
                />
              </Field>
            </div>
            <Field label="Your experience, in your own words">
              <textarea
                rows={5}
                value={profile.bio}
                onChange={(e) => field("bio", e.target.value)}
                placeholder="What have you built? What did you own end to end? What kind of problems get you curious?"
              />
            </Field>
            <Field
              label="Things you can ship with"
              hint="Separate skills with commas. These are used for transparent keyword matching."
            >
              <textarea
                rows={2}
                value={profile.skills}
                onChange={(e) => field("skills", e.target.value)}
                placeholder="TypeScript, React, Next.js, Rust, Solidity, Bun…"
              />
            </Field>
            <div className="form-grid">
              <Field label="What you’re looking for">
                <input
                  value={profile.target}
                  onChange={(e) => field("target", e.target.value)}
                  placeholder="Developer tools, product engineer, infrastructure"
                />
              </Field>
              <Field label="Location / work preference">
                <input
                  value={profile.location}
                  onChange={(e) => field("location", e.target.value)}
                  placeholder="India · Remote preferred"
                />
              </Field>
            </div>
          </div>
        </section>
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="tiny-kicker">02 / SHOW THE WORK</span>
              <h2>Your corner of the internet</h2>
            </div>
            <GitBranch size={20} />
          </div>
          <div className="form-stack">
            <div className="form-grid">
              <Field
                label="GitHub username"
                hint="Public repositories can sync without OAuth."
              >
                <input
                  value={profile.github}
                  onChange={(e) => field("github", e.target.value)}
                  placeholder="your-username"
                />
              </Field>
              <Field label="Devpost">
                <input
                  type="url"
                  value={profile.devpost}
                  onChange={(e) => field("devpost", e.target.value)}
                  placeholder="https://devpost.com/…"
                />
              </Field>
              <Field label="Devfolio">
                <input
                  type="url"
                  value={profile.devfolio}
                  onChange={(e) => field("devfolio", e.target.value)}
                  placeholder="https://devfolio.co/…"
                />
              </Field>
            </div>
          </div>
        </section>
        <section id="projects" className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="tiny-kicker">
                03 / THINGS THAT MADE IT INTO THE WORLD
              </span>
              <h2>Projects you’re proud of</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || resumeWorkflow !== "idle"}
              onClick={() => {
                setDraftProject(newProject());
                router.push("/dashboard/profile/projects/new");
              }}
            >
              <Plus size={14} />
              Add project
            </Button>
          </div>
          <div className="profile-project-grid">
            {profile.projects.map((project) => (
              <button
                type="button"
                className="profile-project-card"
                key={project.id}
                disabled={resumeWorkflow !== "idle"}
                onClick={() =>
                  router.push(
                    `/dashboard/profile/projects/${encodeURIComponent(project.id)}`,
                  )
                }
                aria-label={`Edit project ${project.name || "Untitled project"}`}
              >
                <div className="profile-project-card-heading">
                  <span
                    className="project-monogram"
                    data-tone={project.platform.toLowerCase()}
                  >
                    {(project.name || "P").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3>{project.name || "Untitled project"}</h3>
                    <span>{project.platform || "Personal project"}</span>
                  </div>
                  <ChevronRight size={17} />
                </div>
                <p>
                  {project.description ||
                    "Tell the story behind what you built."}
                </p>
                <div className="profile-project-card-bottom">
                  <span>
                    <Code2 size={14} />
                    {project.stack
                      ? project.stack.split(",").slice(0, 3).join(" · ")
                      : "Project details"}
                  </span>
                  {project.buildMode && (
                    <span>
                      {project.buildMode === "team" ? (
                        <UsersRound size={14} />
                      ) : (
                        <UserRound size={14} />
                      )}
                      {project.buildMode === "team" ? "Team" : "Solo"}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {!profile.projects.length && (
              <div className="inline-empty">
                <GitBranch size={25} />
                <p>
                  Hackathon experiments. Weekend projects. Things you shipped.
                  <br />
                  They all tell your story.
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="tiny-kicker">04 / YOUR WORDS, YOUR RHYTHM</span>
              <h2>Make it sound like you</h2>
            </div>
            <FileText size={20} />
          </div>
          <div className="form-stack">
            <Field
              label="Writing samples"
              hint="Paste a few of your own X articles or posts. AI drafts use these as style references when enabled."
            >
              <textarea
                rows={9}
                value={profile.writing}
                onChange={(e) => field("writing", e.target.value)}
                placeholder="The way you explain an idea. The words you actually use. A few samples go a long way."
              />
            </Field>
          </div>
        </section>
        <div className="sticky-save">
          <p>
            {resumeWorkflow === "selected"
              ? "Process your selected résumé above, or skip this upload to save."
              : resumeWorkflow === "processing"
                ? "Your résumé is being processed. You’ll review the details next."
                : resumeWorkflow === "review"
                  ? "Review and apply your résumé details above before saving."
                  : "Your work. Your story. Always editable."}
          </p>
          <Button
            type="submit"
            disabled={busy || resumeWorkflow !== "idle"}
            className="orange-button"
          >
            <Check size={15} />
            {busy ? "Saving…" : "Save your story"}
          </Button>
        </div>
      </div>
    </form>
  );
}
export function GitHubActivity() {
  const { data } = useWorkspace();
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState("");
  const username = data?.profile.github || "";
  async function sync() {
    setLoading(true);
    setError("");
    try {
      const r = await request<{ repos: Repo[]; checkedAt: string }>(
        `/api/github?username=${encodeURIComponent(username)}`,
      );
      setRepos(r.repos);
      setUpdated(r.checkedAt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (username) void sync();
  }, [username]);
  if (!username)
    return (
      <Empty
        title="Bring your GitHub into the picture."
        text="Add your public GitHub username to see your recently active repositories."
        action={
          <Button asChild className="orange-button">
            <Link href="/dashboard/profile">
              Add GitHub <ArrowUpRight size={14} />
            </Link>
          </Button>
        }
      />
    );
  return (
    <>
      <div className="board-toolbar">
        <span>
          <GitBranch size={16} /> {username} · public repositories{" "}
          {updated && `· synced ${localDate(updated)}`}
        </span>
        <Button disabled={loading} variant="outline" onClick={sync}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Sync repositories
        </Button>
      </div>
      {error && (
        <div role="alert" className="status-message error">
          {error}
        </div>
      )}
      {loading && !repos ? (
        <div className="workspace-loading">
          Following the thread of your work…
        </div>
      ) : (
        <div className="repo-grid">
          {repos?.map((r) => (
            <article key={r.id} className="panel repo-card">
              <div className="repo-card-head">
                <GitBranch size={20} />
                <span>{r.fork ? "FORK" : "PUBLIC"}</span>
              </div>
              <External href={r.html_url}>{r.name}</External>
              <p>
                {r.description ||
                  "A little work in progress. Add this project to your story for more context."}
              </p>
              <div className="repo-flow">
                <span>Explore</span>
                <i />
                <span>Build</span>
                <i />
                <span>
                  Ship <ArrowUpRight size={11} />
                </span>
              </div>
              <div className="repo-meta">
                <span>
                  <i
                    style={{
                      background:
                        r.language === "TypeScript" ? "#5e8fc8" : "#d3a56a",
                    }}
                  />
                  {r.language || "Mixed"}
                </span>
                <span>
                  <Star size={12} />
                  {r.stargazers_count}
                </span>
                <small>Updated {localDate(r.pushed_at)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
      {repos?.length === 0 && (
        <Empty
          title="Your next project is waiting."
          text="No public active repositories found for this username."
        />
      )}
    </>
  );
}
export function Connections() {
  const { data } = useWorkspace();
  const [status, setStatus] = useState<{
    databaseConfigured: boolean;
    aiWriting: boolean;
    resumeAI: boolean;
    exaResearch: boolean;
    linkedinSearch: boolean;
  } | null>(null);
  useEffect(() => {
    request<{
      databaseConfigured: boolean;
      aiWriting: boolean;
      resumeAI: boolean;
      exaResearch: boolean;
      linkedinSearch: boolean;
    }>("/api/status")
      .then(setStatus)
      .catch(() => {});
  }, []);
  return (
    <>
      <div className="connection-grid">
        {[
          {
            name: "Neon PostgreSQL",
            icon: Database,
            status: status?.databaseConfigured
              ? "Database configured"
              : "Database connection required",
            text: "Your profile, résumé files, projects, applications, company notebooks and outreach drafts persist in PostgreSQL.",
            href: "/dashboard/profile",
            action: "Open your profile",
            ready: Boolean(status?.databaseConfigured),
          },
          {
            name: "GitHub",
            icon: GitBranch,
            status: data?.profile.github
              ? "Public profile ready"
              : "Add your username",
            text: "Read your public repositories, contribution guides, merged PRs, and open issues.",
            href: "/dashboard/profile",
            action: "Manage profile",
            ready: !!data?.profile.github,
          },
          {
            name: "Y Combinator",
            icon: Building2,
            status: "Public discovery ready",
            text: "Import engineering listings from YC’s public job index. Every opportunity keeps its original source link.",
            href: "/dashboard/discover",
            action: "Explore opportunities",
            ready: true,
          },
          {
            name: "X",
            icon: Search,
            status: "Public search ready",
            text: "Search public profiles and live posts through x.pcstyle.dev. Small keyless searches are available, subject to provider limits.",
            href: "/dashboard/companies",
            action: "Research a company",
            ready: true,
          },
          {
            name: "LinkedIn",
            icon: UsersRound,
            status: status?.linkedinSearch
              ? "Public web search ready"
              : "Brave key required",
            text: "Find indexed public LinkedIn profiles and job pages with Brave Search. Its monthly $5 credits cover about 1,000 search requests; signup requires a card. Add BRAVE_SEARCH_API_KEY.",
            href: "/dashboard/companies",
            action: "Research people",
            ready: Boolean(status?.linkedinSearch),
          },
          {
            name: "Exa",
            icon: Globe,
            status: status?.exaResearch
              ? "Company & people search ready"
              : "Exa key required",
            text: "Research companies and people with source evidence. Add EXA_API_KEY on the server to enable searches.",
            href: "/dashboard/companies",
            action: "Open company notebooks",
            ready: Boolean(status?.exaResearch),
          },
          {
            name: "Email",
            icon: Mail,
            status: "Drafts & tracking ready",
            text: "Create, edit, and copy outreach drafts. Mailbox OAuth and automatic reply synchronization need a provider connection.",
            href: "/dashboard/outreach",
            action: "Open drafts",
            ready: false,
          },
          {
            name: "Claude résumé autofill",
            icon: Sparkles,
            status: status?.resumeAI
              ? "Haiku 5.5 ready"
              : "Anthropic key required",
            text: "Read your résumé with Claude Haiku 5.5, then review the extracted profile fields. Configure ANTHROPIC_API_KEY in .env.local.",
            href: "/dashboard/profile",
            action: "Open résumé import",
            ready: Boolean(status?.resumeAI),
          },
          {
            name: "AI writing",
            icon: PenLine,
            status: status?.aiWriting
              ? "AI writing ready"
              : "Server key required",
            text: "Style-aware drafts use your saved evidence and writing samples. Configure AI_GATEWAY_API_KEY in .env.local to enable generation.",
            href: "/dashboard/outreach",
            action: "Open outreach",
            ready: Boolean(status?.aiWriting),
          },
        ].map((c) => (
          <article className="panel connection-card" key={c.name}>
            <div className="connection-symbol">
              <c.icon size={23} />
            </div>
            <h2>{c.name}</h2>
            <span className={`connection-status ${c.ready ? "ready" : ""}`}>
              <span className={c.ready ? "green-dot" : "neutral-dot"} />
              {c.status}
            </span>
            <p>{c.text}</p>
            <Button asChild variant="outline">
              <Link href={c.href}>
                {c.action}
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          </article>
        ))}
      </div>
      <div className="soft-notice">
        <span>
          <Globe size={18} />
        </span>
        <p>
          Your saved information lives in your workspace database. External
          accounts are only used when a real connection is configured.
        </p>
      </div>
    </>
  );
}
