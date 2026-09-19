"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Search,
  BriefcaseBusiness,
  Building2,
  Mail,
  GitPullRequest,
  GitBranch,
  UserRound,
  Settings2,
  ArrowUpRight,
  Bell,
  ChevronDown,
  PanelLeftClose,
  Menu,
  ArrowRight,
  Plus,
  RefreshCw,
  CircleHelp,
  Check,
  X,
  Clock3,
  Asterisk,
  Compass,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mark } from "./mark";
import { useWorkspace, request } from "./workspace";
import { Modal, CompanyIcon, localDate, Empty } from "./shared";
import { Opportunities, Applications, AddOpportunity } from "./opportunities";
import { ProfileView, GitHubActivity, Connections } from "./profile";
import { Companies, Contributions } from "./companies";
import { DiscoveryStatus } from "./discovery-status";
import { OpportunityCompanyPage } from "./opportunity-company";
import { LinkedInTuning } from "./linkedin-tuning";
import { Outreach } from "./outreach";
import { dueJobs, fit, type Workspace } from "@/lib/model";
const navigation = [
  {
    view: "overview",
    label: "Overview",
    icon: LayoutGrid,
    group: "YOUR WORKSPACE",
  },
  {
    view: "discover",
    label: "Discover",
    icon: Compass,
    group: "YOUR WORKSPACE",
  },
  {
    view: "applications",
    label: "Applications",
    icon: BriefcaseBusiness,
    group: "YOUR WORKSPACE",
  },
  { view: "outreach", label: "Outreach", icon: Mail, group: "YOUR WORKSPACE" },
  {
    view: "companies",
    label: "Companies",
    icon: Building2,
    group: "GO A LITTLE DEEPER",
  },
  {
    view: "contributions",
    label: "Contributions",
    icon: GitPullRequest,
    group: "GO A LITTLE DEEPER",
  },
  {
    view: "activity",
    label: "GitHub activity",
    icon: Activity,
    group: "GO A LITTLE DEEPER",
  },
  {
    view: "profile",
    label: "Your story",
    icon: UserRound,
    group: "MAKE IT YOURS",
  },
  {
    view: "connections",
    label: "Connections",
    icon: Settings2,
    group: "MAKE IT YOURS",
  },
];
const copy: Record<string, [string, string]> = {
  overview: [
    "A little closer to what’s next.",
    "Your opportunities, conversations, and next steps. All in one place.",
  ],
  discover: [
    "Follow the signal.",
    "A thoughtful shortlist, with a source and a reason to look closer.",
  ],
  applications: [
    "Keep the conversation moving.",
    "Track every application, from your first hello to your next chapter.",
  ],
  outreach: [
    "A note that sounds like you.",
    "Specific, personal introductions. Yours to review, edit, and send.",
  ],
  companies: [
    "Find your kind of people.",
    "Get to know the product, the people, and the way they build.",
  ],
  contributions: [
    "Make something useful.",
    "Learn the process. Reproduce the issue. Then start building.",
  ],
  activity: [
    "Your work speaks for itself.",
    "A repository-level view of what you’re building. No commit-count theatre.",
  ],
  linkedin: [
    "Your work, clearly told.",
    "Shape a profile that shows what you can build.",
  ],
  profile: [
    "Tell your builder story.",
    "The projects you’ve shipped, the things you know, and your own words.",
  ],
  connections: [
    "Bring your world together.",
    "See what’s connected, what’s available, and what needs a little setup.",
  ],
};
export function Dashboard(props: {
  view: string;
  companyId?: string;
  opportunityId?: string;
  projectId?: string;
  linkedinResearch?: boolean;
}) {
  return <DashboardInner {...props} />;
}
function DashboardInner({
  view,
  companyId,
  opportunityId,
  projectId,
  linkedinResearch,
}: {
  view: string;
  companyId?: string;
  opportunityId?: string;
  projectId?: string;
  linkedinResearch?: boolean;
}) {
  const {
    data,
    profileDraft,
    now,
    busy,
    error,
    message,
    setMessage,
    run,
    replace,
    reload,
  } = useWorkspace();
  const router = useRouter();
  const [discovering, setDiscovering] = useState(false);
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [add, setAdd] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [command, setCommand] = useState(false);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const current = navigation.find(
    (n) => n.view === (view === "linkedin" ? "profile" : view),
  );
  const due = data ? dueJobs(data.jobs, now) : [];
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  async function discover() {
    setDiscovering(true);
    try {
      await run(async () => {
        const result = await request<{
          workspace: Workspace;
          imported: number;
          checked: number;
        }>("/api/discover", {
          method: "POST",
          signal: AbortSignal.timeout(65000),
        });
        replace(result.workspace);
        const sources = result.workspace.discovery?.sources || [];
        const completed = sources
          .filter((source) => source.status === "complete")
          .map((source) => source.source);
        setMessage(
          completed.length
            ? `Saved ${result.imported} new opportunities. Searched ${completed.join(", ")}. See each source’s results below.`
            : "Search could not complete. See each source’s status below and try again.",
        );
      });
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div
      className={`dashboard-shell view-${view} ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <aside className={`dash-sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Link href="/dashboard" aria-label="Trail workspace">
            <span className="brand-square">
              <Mark />
            </span>
            <b>trail</b>
          </Link>
          <button
            aria-label={
              mobile
                ? "Close sidebar"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            onClick={() =>
              mobile ? setMobile(false) : setCollapsed((v) => !v)
            }
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <button
          className="nav-search"
          aria-label="Jump to anything"
          onClick={() => setCommand(true)}
        >
          <Search size={16} />
          <span>Jump to anything</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav aria-label="Workspace navigation">
          {["YOUR WORKSPACE", "GO A LITTLE DEEPER", "MAKE IT YOURS"].map(
            (group) => (
              <div className="nav-group" key={group}>
                <span>{group}</span>
                {navigation
                  .filter((n) => n.group === group)
                  .map((n) => (
                    <Link
                      key={n.view}
                      title={n.label}
                      aria-label={n.label}
                      href={
                        n.view === "overview"
                          ? "/dashboard"
                          : `/dashboard/${n.view}`
                      }
                      onClick={() => setMobile(false)}
                      className={
                        view === n.view ||
                        (view === "linkedin" && n.view === "profile")
                          ? "active"
                          : ""
                      }
                    >
                      <n.icon size={19} />
                      <span className="nav-label">{n.label}</span>
                      {n.view === "applications" &&
                        !!data?.jobs.filter(
                          (j) => !j.sample && j.stage === "Applied",
                        ).length && (
                          <i>
                            {
                              data.jobs.filter(
                                (j) => !j.sample && j.stage === "Applied",
                              ).length
                            }
                          </i>
                        )}
                      {n.view === "discover" && (
                        <span className="nav-new">NEW</span>
                      )}
                    </Link>
                  ))}
              </div>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-help" href="/about">
            <CircleHelp size={16} />
            How Trail works <ArrowUpRight size={13} />
          </Link>
          <Link className="sidebar-help" href="/">
            <ArrowUpRight size={16} />
            Back to the website
          </Link>
          <Link className="sidebar-user" href="/dashboard/profile">
            <span>{data?.profile.name?.slice(0, 1) || "N"}</span>
            <div>
              <b>{data?.profile.name || "Your workspace"}</b>
              <small>Building what’s next</small>
            </div>
            <ChevronDown size={14} />
          </Link>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="dash-main">
        <header className="dash-topbar">
          <div>
            <button
              className="mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open sidebar"
            >
              <Menu size={19} />
            </button>
            <LayoutGrid size={17} />
            <span>Workspace</span>
            <i>/</i>
            <b>{current?.label || "Page not found"}</b>
            {companyId && (
              <>
                <i>/</i>
                <b>{data?.companies.find((c) => c.id === companyId)?.name}</b>
              </>
            )}
          </div>
          <div>
            <span className="workspace-label">
              <span className="green-dot" /> PERSONAL WORKSPACE
            </span>
            <button
              className="notification-button"
              aria-label={`Notifications, ${due.length} follow-ups due`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {due.length > 0 && <i />}
            </button>
          </div>
        </header>
        <div className="dash-content">
          <div className="dash-page-heading">
            <div className="dash-heading-copy">
              <div className="dash-eyebrow">
                {view === "overview"
                  ? `YOUR DAILY SIGNAL · ${date.toUpperCase()}`
                  : current?.group}
              </div>
              <h1>
                <span className="dash-title-text">
                  {opportunityId
                    ? data?.jobs.find((job) => job.id === opportunityId)
                        ?.company || "Company opportunity"
                    : projectId
                      ? projectId === "new"
                        ? "Bring a project to life."
                        : (profileDraft || data?.profile)?.projects.find(
                            (p) => p.id === projectId,
                          )?.name || "Your project"
                      : copy[view]?.[0] || "This trail hasn’t been mapped."}
                </span>
                <Asterisk className="title-star" size={24} aria-hidden="true" />
              </h1>
              <p>
                {opportunityId
                  ? "The role, the people, and your next step. All in one place."
                  : projectId
                    ? "The story, links, and the part you built. All in one place."
                    : copy[view]?.[1] ||
                      "Choose a page from the sidebar to find your way back."}
              </p>
            </div>
            {["overview", "discover"].includes(view) && (
              <div className="heading-actions">
                <Button variant="outline" onClick={() => setAdd(true)}>
                  <Plus size={15} />
                  Save a lead
                </Button>
                <Button
                  className="orange-button"
                  onClick={discover}
                  disabled={busy}
                >
                  <RefreshCw className={busy ? "spin" : ""} size={15} />
                  {busy ? "Finding…" : "Find opportunities"}
                </Button>
              </div>
            )}
          </div>
          {error && (
            <div className="status-message error" role="alert">
              <span>{error}</span>
              {!data && (
                <Button variant="outline" onClick={reload}>
                  Retry
                </Button>
              )}
            </div>
          )}
          {message && (
            <div className="status-message success" role="status">
              <Check size={15} />
              {message}
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="dash-page-body">
            {["overview", "discover"].includes(view) && (
              <DiscoveryStatus loading={discovering} />
            )}
            {!data ? (
              <div className="workspace-loading" role="status">
                {error
                  ? "Your workspace could not be loaded. Fix the database connection, then retry above."
                  : "Loading your workspace…"}
              </div>
            ) : view === "overview" ? (
              <Overview onDiscover={discover} onAdd={() => setAdd(true)} />
            ) : view === "discover" ? (
              <Opportunities search={search} onSearch={setSearch} />
            ) : view === "applications" ? (
              <Applications />
            ) : view === "outreach" ? (
              <Outreach />
            ) : view === "companies" ? (
              opportunityId ? (
                <OpportunityCompanyPage jobId={opportunityId} />
              ) : (
                <Companies companyId={companyId} />
              )
            ) : view === "contributions" ? (
              <Contributions />
            ) : view === "activity" ? (
              <GitHubActivity />
            ) : view === "linkedin" ? (
              <LinkedInTuning research={linkedinResearch} />
            ) : view === "profile" ? (
              <ProfileView projectId={projectId} />
            ) : view === "connections" ? (
              <Connections />
            ) : (
              <Empty
                title="Choose your next step"
                text="Your workspace is one click away."
                action={
                  <Button asChild>
                    <Link href="/dashboard">Go to overview</Link>
                  </Button>
                }
              />
            )}
          </div>
          <div className="dash-bottom-line">
            <span>
              <Mark />A little less searching. A lot more building.
            </span>
            <Link href="/brand">
              MADE WITH INTENTION <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
      <AddOpportunity open={add} onOpenChange={setAdd} />
      <Modal
        title="Your next steps"
        description="Follow-ups scheduled in your workspace. Notifications appear while the app is open."
        open={notifications}
        onOpenChange={setNotifications}
      >
        {due.length ? (
          due.map((j) => (
            <Link
              key={j.id}
              href="/dashboard/applications"
              className="notification-row"
              onClick={() => setNotifications(false)}
            >
              <Clock3 size={18} />
              <div>
                <b>Follow up with {j.company}</b>
                <p>
                  {j.role} · {j.followUp}
                </p>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))
        ) : (
          <Empty
            title="A little breathing room."
            text="No follow-ups are overdue. Add a date when you log an application."
          />
        )}
      </Modal>
      <Modal
        title="Find your way"
        description="Jump to a page in your workspace."
        open={command}
        onOpenChange={setCommand}
      >
        <input
          autoFocus
          className="command-input"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {navigation
          .filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
          .map((n) => (
            <button
              key={n.view}
              className="command-item"
              onClick={() => {
                router.push(
                  n.view === "overview" ? "/dashboard" : `/dashboard/${n.view}`,
                );
                setCommand(false);
                setSearch("");
              }}
            >
              <n.icon size={19} />
              {n.label}
              <ArrowRight size={14} />
            </button>
          ))}
      </Modal>
    </div>
  );
}
function Overview({
  onDiscover,
  onAdd,
}: {
  onDiscover: () => void;
  onAdd: () => void;
}) {
  const { data, now, busy } = useWorkspace();
  if (!data) return null;
  const real = data.jobs.filter((j) => !j.sample);
  const due = dueJobs(data.jobs, now);
  const shortlist = data.jobs.filter((j) => j.stage === "Saved").slice(0, 4);
  const samples = shortlist.some((j) => j.sample);
  const completed = [
    data.profile.bio,
    data.profile.skills,
    data.profile.github,
    data.profile.projects.length,
    data.profile.writing,
  ].filter(Boolean).length;
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="tiny-kicker">THIS IS YOUR TRAIL.</span>
          <h2>
            {data.profile.name
              ? `Good to see you, ${data.profile.name.split(" ")[0]}.`
              : "Your next chapter starts here."}
          </h2>
          <p>Find the teams you believe in. Show them what you can build.</p>
          <Link href="/dashboard/profile">
            {completed < 5
              ? "Tell your builder story"
              : "Keep your story up to date"}{" "}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="banner-art">
          <div className="banner-art-frame" />
          <Asterisk className="banner-art-star" size={100} />
          <span className="banner-art-label">
            FOLLOW YOUR CURIOSITY <ArrowUpRight size={12} />
          </span>
        </div>
      </div>
      <div className="metrics-grid">
        {[
          {
            label: "In your shortlist",
            value: real.filter((j) => j.stage === "Saved").length,
            detail: "Opportunities worth exploring",
            icon: Search,
            color: "orange",
          },
          {
            label: "Applications sent",
            value: real.filter((j) =>
              ["Applied", "Interview", "Offer"].includes(j.stage),
            ).length,
            detail: "Every introduction, tracked",
            icon: Mail,
            color: "blue",
          },
          {
            label: "In conversation",
            value: real.filter((j) => j.stage === "Interview").length,
            detail: "Something good is taking shape",
            icon: BriefcaseBusiness,
            color: "purple",
          },
          {
            label: "Follow-ups due",
            value: due.length,
            detail: due.length
              ? "A thoughtful nudge goes a long way"
              : "You’re all caught up",
            icon: Clock3,
            color: "green",
          },
        ].map((m) => (
          <div className="metric" key={m.label}>
            <div>
              <span>{m.label}</span>
              <m.icon size={17} />
            </div>
            <strong>
              {String(m.value).padStart(2, "0")}
              <ArrowUpRight className={`metric-accent ${m.color}`} size={15} />
            </strong>
            <p>{m.detail}</p>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel opportunity-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Worth a closer look{" "}
                <span className="count-pill">{shortlist.length}</span>
              </h2>
              <p>
                {samples
                  ? "Sample leads · add your profile to start finding real matches"
                  : "Your most recently saved opportunities"}
              </p>
            </div>
            <Link href="/dashboard/discover">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="overview-table">
            <div className="overview-table-head">
              <span>COMPANY & ROLE</span>
              <span>SOURCE</span>
              <span>FIT</span>
              <span />
            </div>
            {shortlist.map((j) => {
              const match = fit(j, data.profile);
              return (
                <Link
                  key={j.id}
                  href={`/dashboard/companies/opportunities/${j.id}`}
                  className="overview-job"
                >
                  <div>
                    <CompanyIcon name={j.company} />
                    <span>
                      <b>{j.company}</b>
                      <small>{j.role}</small>
                    </span>
                  </div>
                  <span className={`source-badge ${j.source.toLowerCase()}`}>
                    {j.source === "YC" ? (
                      "Y "
                    ) : j.source === "X" ? (
                      "𝕏 "
                    ) : j.source === "LinkedIn" ? (
                      "in "
                    ) : (
                      <ArrowUpRight size={12} />
                    )}
                    {j.source}
                  </span>
                  <span className="fit-label">
                    {j.sample
                      ? "Preview"
                      : match.score === null
                        ? "Add skills"
                        : `${match.score}%`}
                    <span className="fit-dots">
                      ••••<i>•</i>
                    </span>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              );
            })}
            {!shortlist.length && (
              <Empty
                title="Make a little room for possibility."
                text="Find opportunities from YC or save an interesting job link."
                action={<Button onClick={onAdd}>Save your first lead</Button>}
              />
            )}
          </div>
          <div className="panel-foot">
            <span className="green-dot" />
            {data.lastDiscovery
              ? `Last discovery ${localDate(data.lastDiscovery)} · YC, X, and LinkedIn sources`
              : "Ready when you are. Start with your story, then follow the signal."}
          </div>
        </section>
        <section className="panel focus-panel">
          <div className="panel-heading">
            <h2>A little focus for today</h2>
            <Asterisk className="focus-star" size={25} />
          </div>
          <div className="focus-list">
            {[
              {
                done: completed >= 3,
                title: "Make it sound like you",
                text: "Add your projects, skills & writing samples",
                href: "/dashboard/profile",
              },
              {
                done: real.length > 0,
                title: "Find a team worth meeting",
                text: "Explore opportunities with real sources",
                href: "/dashboard/discover",
              },
              {
                done: data.drafts.length > 0,
                title: "Say a thoughtful hello",
                text: "Draft your first personal introduction",
                href: "/dashboard/outreach",
              },
            ].map((t) => (
              <Link key={t.title} href={t.href}>
                <span className={`focus-check ${t.done ? "done" : ""}`}>
                  {t.done && <Check size={12} />}
                </span>
                <div>
                  <b>{t.title}</b>
                  <p>{t.text}</p>
                </div>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
          <div className="profile-progress">
            <div>
              <span>Your story is taking shape</span>
              <b>{completed}/5</b>
            </div>
            <div className="progress-track">
              <i style={{ width: `${(completed / 5) * 100}%` }} />
            </div>
            <Link href="/dashboard/profile">
              Keep going <ArrowRight size={13} />
            </Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Build a connection</h2>
              <p>Get to know the team before the introduction.</p>
            </div>
            <Link href="/dashboard/companies">
              Explore <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="company-preview-grid">
            {data.companies.slice(0, 3).map((c) => (
              <Link href={`/dashboard/companies/${c.id}`} key={c.id}>
                <CompanyIcon name={c.name} color={c.color} />
                <b>{c.name}</b>
                <small>{c.category}</small>
                <span>
                  Company notebook <ArrowUpRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>Along your trail</h2>
            <GitBranch size={16} />
          </div>
          {data.activity.length ? (
            data.activity.slice(0, 3).map((a) => (
              <div className="recent-item" key={a.id}>
                <span className="green-dot" />
                <div>
                  <p>{a.text}</p>
                  <small>{localDate(a.at)}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="recent-empty">
              <div className="recent-flow">
                <span>
                  <UserRound size={17} />
                </span>
                <i />
                <span>
                  <Search size={17} />
                </span>
                <i />
                <span>
                  <Mail size={17} />
                </span>
              </div>
              <p>Your story → your shortlist → your next chapter.</p>
              <small>Your activity will appear here as you go.</small>
            </div>
          )}
        </section>
      </div>
      <div className="discover-nudge">
        <Asterisk className="nudge-icon" size={23} />
        <div>
          <b>The right opportunity is worth a little curiosity.</b>
          <p>
            Start with YC’s public listings, or save a lead from X or LinkedIn.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={onDiscover}>
          Follow the signal <ArrowUpRight size={14} />
        </Button>
      </div>
    </>
  );
}
