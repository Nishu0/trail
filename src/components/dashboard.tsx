"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./app-shell";
import { useWorkspace } from "./workspace";
import { Empty } from "./shared";
import { Home } from "./home";
import { ProfilePage } from "./profile-page";
import { SettingsPage } from "./settings-page";
import { Pipeline } from "./pipeline";
import { Opportunities } from "./opportunities";
import { ProfileView, GitHubActivity } from "./profile";
import { Companies, Contributions } from "./companies";
import { OpportunityCompanyPage } from "./opportunity-company";
import { LinkedInTuning } from "./linkedin-tuning";
import { InterviewPrep } from "./interview-prep";

// pages outside the four main tabs keep their old titles.
const TITLES: Record<string, [string, string]> = {
  discover: [
    "Discover",
    "A shortlist with a source and a reason to look closer.",
  ],
  interview: [
    "Interview prep",
    "What each call is for, what you’ll be asked, what to practise.",
  ],
  companies: ["Companies", "The product, the people, and the way they build."],
  contributions: [
    "Contributions",
    "Learn the process. Reproduce the issue. Then build.",
  ],
  activity: [
    "GitHub activity",
    "A repository-level view of what you’re building.",
  ],
  linkedin: ["LinkedIn", "Shape a profile that shows what you can build."],
  "profile-edit": [
    "Edit profile",
    "Your story, projects, resume and writing samples.",
  ],
};

export function Dashboard({
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
  const { data, error, reload } = useWorkspace();
  const [search, setSearch] = useState("");

  let page: React.ReactNode;
  if (!data)
    page = (
      <div
        className="grid flex-1 place-items-center text-[13px] text-muted-foreground"
        role="status"
      >
        {error ? (
          <div className="grid justify-items-center gap-3">
            Your workspace could not be loaded.
            <Button size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : (
          "Loading your workspace…"
        )}
      </div>
    );
  else if (view === "dashboard") page = <Home />;
  else if (view === "profile")
    page = projectId ? (
      <Legacy view="profile-edit">
        <ProfileView projectId={projectId} />
      </Legacy>
    ) : (
      <ProfilePage />
    );
  else if (view === "profile-edit")
    page = (
      <Legacy view={view}>
        <ProfileView />
      </Legacy>
    );
  else if (view === "pipeline") page = <Pipeline />;
  else if (view === "settings") page = <SettingsPage />;
  else if (view === "discover")
    page = (
      <Legacy view={view}>
        <Opportunities search={search} onSearch={setSearch} />
      </Legacy>
    );
  else if (view === "interview")
    page = (
      <Legacy view={view}>
        <InterviewPrep />
      </Legacy>
    );
  else if (view === "companies")
    page = opportunityId ? (
      <Legacy
        view={view}
        title={data.jobs.find((j) => j.id === opportunityId)?.company}
      >
        <OpportunityCompanyPage jobId={opportunityId} />
      </Legacy>
    ) : (
      <Legacy view={view}>
        <Companies companyId={companyId} />
      </Legacy>
    );
  else if (view === "contributions")
    page = (
      <Legacy view={view}>
        <Contributions />
      </Legacy>
    );
  else if (view === "activity")
    page = (
      <Legacy view={view}>
        <GitHubActivity />
      </Legacy>
    );
  else if (view === "linkedin")
    page = (
      <Legacy view={view}>
        <LinkedInTuning research={linkedinResearch} />
      </Legacy>
    );
  else
    page = (
      <Empty
        title="This page doesn’t exist"
        text="Use the sidebar to find your way back."
        action={
          <Button asChild size="sm">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    );

  return page;
}

function Legacy({
  view,
  title,
  children,
}: {
  view: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [t, d] = TITLES[view] ?? [view, ""];
  return (
    <>
      <PageHeader title={title || t} description={d} />
      <div className="legacy-page min-w-0">{children}</div>
    </>
  );
}
