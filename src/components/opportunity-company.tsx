"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  FileText,
  Globe,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Companies } from "./companies";
import { CompanyIcon, Empty, External, Field, localDate } from "./shared";
import { request, useWorkspace } from "./workspace";
import {
  fit,
  type Job,
  type Stage,
  type Channel,
  type Workspace,
} from "@/lib/model";
import type { CompanySearch } from "@/lib/company-search";
import { WorkspaceSelect } from "./ui/select";
export function OpportunityCompanyPage({ jobId }: { jobId: string }) {
  const { data } = useWorkspace();
  const job = data?.jobs.find((job) => job.id === jobId);
  if (!job)
    return (
      <Empty
        title="This opportunity wasn’t found."
        text="Choose a saved lead from your shortlist."
        action={
          <Button asChild>
            <Link href="/dashboard/discover">Back to Discover</Link>
          </Button>
        }
      />
    );
  return <CompanyOpportunity key={job.id} job={job} />;
}
function CompanyOpportunity({ job }: { job: Job }) {
  const { data, busy, run, replace, setMessage } = useWorkspace();
  const router = useRouter();
  const [tab, setTab] = useState("opportunity");
  const [stage, setStage] = useState<Stage>(job.stage);
  const [channel, setChannel] = useState<Channel>(job.channel || "Email");
  const [followUp, setFollowUp] = useState(job.followUp || "");
  const [notes, setNotes] = useState(job.notes);
  const [website, setWebsite] = useState("");
  const [looking, setLooking] = useState(false);
  const [researching, setResearching] = useState(false);
  const [lookup, setLookup] = useState<CompanySearch | null>(null);
  if (!data) return null;
  const company = data.companies.find((company) =>
    job.companyId
      ? company.id === job.companyId
      : company.name.toLowerCase() === job.company.toLowerCase(),
  );
  const match = fit(job, data.profile);
  async function save() {
    const workspace = await request<Workspace>("/api/workspace", {
      method: "PATCH",
      body: JSON.stringify({
        action: "job",
        id: job.id,
        stage,
        channel,
        followUp,
        notes,
      }),
    });
    replace(workspace);
  }
  async function research(url: string) {
    setResearching(true);
    try {
      await run(async () => {
        const result = await request<{ workspace: Workspace }>("/api/company", {
          method: "POST",
          body: JSON.stringify({ url, jobId: job.id }),
          signal: AbortSignal.timeout(45000),
        });
        replace(result.workspace);
        setTab("research");
        setMessage("Company research saved to your notebook.");
      });
    } finally {
      setResearching(false);
    }
  }
  async function findWebsite() {
    setLooking(true);
    try {
      await run(async () => {
        setLookup(
          await request<CompanySearch>("/api/company/lookup", {
            method: "POST",
            body: JSON.stringify({ jobId: job.id }),
            signal: AbortSignal.timeout(30000),
          }),
        );
      });
    } finally {
      setLooking(false);
    }
  }
  return (
    <div className="opportunity-company-page">
      <div className="opportunity-page-meta">
        <Link href="/dashboard/discover" className="back-link">
          <ArrowLeft size={14} />
          Your shortlist
        </Link>
        <span>
          Saved {localDate(job.addedAt)}
          <Badge variant="outline">{job.source}</Badge>
        </span>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="company-page-tabs">
        <TabsList variant="line" aria-label="Company page sections">
          <TabsTrigger value="opportunity">
            <FileText size={15} />
            Opportunity
          </TabsTrigger>
          <TabsTrigger value="research">
            <Building2 size={15} />
            Company research{company && <span className="green-dot" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="opportunity">
          <div className="opportunity-workbench">
            <div className="opportunity-main-column">
              <Card className="role-detail-card">
                <CardHeader>
                  <div className="role-employer">
                    <CompanyIcon
                      large
                      name={job.company}
                      logoUrl={job.logoUrl || company?.logoUrl}
                    />
                    <div>
                      <span className="tiny-kicker">THE OPPORTUNITY</span>
                      <p>{job.company}</p>
                    </div>
                    <Badge variant="outline">{job.stage}</Badge>
                  </div>
                  <h2>{job.role}</h2>
                  <div className="role-detail-location">
                    <MapPin size={14} />
                    {job.location || "Check the original listing"}
                  </div>
                </CardHeader>
                <CardContent>
                  {job.health && (
                    <div className={`job-health-note ${job.health.status}`}>
                      <ShieldCheck size={15} />
                      <div>
                        <b>
                          {job.health.status === "closed"
                            ? "Archived listing"
                            : job.health.status === "open"
                              ? "Listing checked"
                              : "Availability unverified"}{" "}
                          · {localDate(job.health.checkedAt)}
                        </b>
                        <p>
                          {job.health.reason}
                          {job.health.previousStage &&
                            ` Previous application stage: ${job.health.previousStage}.`}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="role-detail-tags">
                    {job.tags.map((tag) => (
                      <Badge variant="secondary" key={tag}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="role-detail-description">
                    <h3>What they’re looking for</h3>
                    <p>
                      {job.description ||
                        "Open the original listing for the full role description."}
                    </p>
                  </div>
                  <div className="role-source-line">
                    <ShieldCheck size={16} />
                    <p>
                      Saved from {job.source}. Check the original listing for
                      the latest availability, requirements, and application
                      details.
                    </p>
                  </div>
                  <Button asChild className="orange-button">
                    <a href={job.url} target="_blank" rel="noreferrer">
                      View original opportunity
                      <ArrowUpRight size={15} />
                    </a>
                  </Button>
                </CardContent>
              </Card>
              <Card className="role-match-card">
                <CardHeader>
                  <span className="tiny-kicker">
                    THE CONNECTION TO YOUR WORK
                  </span>
                  <CardTitle>Why this came up</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    {match.reasons.length
                      ? `Your profile and this listing both mention ${match.reasons.join(", ")}.`
                      : "You saved this lead to explore further."}
                  </p>
                  <small>
                    This is keyword overlap. Review the full role to decide
                    whether it’s a good fit.
                  </small>
                </CardContent>
              </Card>
              <Card className="role-research-invitation">
                <CardContent>
                  <div>
                    <Building2 size={21} />
                    <div>
                      <h3>Get to know the company</h3>
                      <p>
                        {company
                          ? "Your notebook, the team, and their contribution process."
                          : "Bring the product, people, and repositories into one notebook."}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setTab("research")}>
                    Company research
                    <ArrowUpRight size={14} />
                  </Button>
                </CardContent>
              </Card>
            </div>
            <Card className="application-tracker">
              <CardHeader>
                <span className="tiny-kicker">YOUR NEXT STEP</span>
                <CardTitle>Keep the conversation moving</CardTitle>
                <CardDescription>
                  One place for the details you’ll need later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await save();
                      setMessage("Application details saved.");
                    });
                  }}
                >
                  <Field label="Application status">
                    <WorkspaceSelect
                      label="Application status"
                      value={stage}
                      onValueChange={(v) => setStage(v as Stage)}
                      options={[
                        "Saved",
                        "Applied",
                        "Interview",
                        "Offer",
                        "Archived",
                      ].map((value) => ({ value, label: value }))}
                    />
                  </Field>
                  <Field label="Application channel">
                    <WorkspaceSelect
                      label="Application channel"
                      value={channel}
                      onValueChange={(v) => setChannel(v as Channel)}
                      options={["Email", "X", "Job form"].map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                  </Field>
                  <Field label="Follow up on">
                    <input
                      type="date"
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Research & conversation notes"
                    hint="Useful specifics make a better introduction."
                  >
                    <textarea
                      rows={5}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Why this team? What have you learned?"
                    />
                  </Field>
                  <Button
                    type="submit"
                    className="orange-button"
                    disabled={busy}
                  >
                    <Check size={15} />
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await save();
                        const result = await request<{ workspace: Workspace }>(
                          "/api/draft",
                          {
                            method: "POST",
                            body: JSON.stringify({
                              jobId: job.id,
                              useAI: false,
                            }),
                          },
                        );
                        replace(result.workspace);
                        router.push("/dashboard/outreach");
                      })
                    }
                  >
                    <Mail size={15} />
                    Draft a hello
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="research">
          {company ? (
            <Companies companyId={company.id} embedded />
          ) : (
            <Card className="company-research-setup">
              <CardHeader>
                <span className="tiny-kicker">
                  A COMPANY NOTEBOOK, BUILT FROM SOURCES
                </span>
                <CardTitle>Meet {job.company} behind the role.</CardTitle>
                <CardDescription>
                  Start with their public website. Then research founders, team
                  profiles, repositories, and how they accept contributions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.source === "YC" ? (
                  <div className="research-start-row">
                    <div>
                      <ShieldCheck size={22} />
                      <div>
                        <h3>Start with the YC company profile</h3>
                        <p>
                          Read the company’s own description and verified
                          founder links.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="orange-button"
                      disabled={busy}
                      onClick={() => void research(job.url)}
                    >
                      <RefreshCw
                        size={15}
                        className={researching ? "spin" : ""}
                      />
                      {researching
                        ? "Reading company…"
                        : "Research company & founders"}
                    </Button>
                  </div>
                ) : (
                  <div className="research-start-row">
                    <div>
                      <Search size={22} />
                      <div>
                        <h3>Find the official website</h3>
                        <p>
                          Review the company search results before saving a
                          source.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void findWebsite()}
                    >
                      <Search size={15} className={looking ? "spin" : ""} />
                      {looking ? "Finding website…" : "Find company website"}
                    </Button>
                  </div>
                )}
                {lookup && (
                  <div className="company-website-results">
                    {lookup.results.length ? (
                      lookup.results.map((result) => (
                        <article key={result.url}>
                          <div>
                            <h3>{result.title}</h3>
                            <External href={result.url}>
                              {new URL(result.url).hostname}
                            </External>
                            <p>{result.summary}</p>
                          </div>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => void research(result.url)}
                          >
                            Use this company
                            <ArrowUpRight size={14} />
                          </Button>
                        </article>
                      ))
                    ) : (
                      <p>
                        No websites were found. Add the official company website
                        below.
                      </p>
                    )}
                  </div>
                )}
                <form
                  className="company-website-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void research(website);
                  }}
                >
                  <Field
                    label="Already know their website?"
                    hint="Use the company’s own website, rather than a job board."
                  >
                    <input
                      type="url"
                      required
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://company.com"
                    />
                  </Field>
                  <Button
                    variant="outline"
                    type="submit"
                    disabled={busy || !website}
                  >
                    <Globe size={15} />
                    Save & research
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
