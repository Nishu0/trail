"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Info,
  Plus,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendChart } from "./charts/trend-chart";
import { GroupedBars } from "./charts/grouped-bars";
import { FunnelChart } from "./charts/funnel-chart";
import { GREYS } from "./charts/chart-tooltip";
import { PageHeader } from "./app-shell";
import { useWorkspace, request } from "./workspace";
import { CompanyIcon } from "./shared";
import { AddOpportunity } from "./opportunities";
import { DiscoveryStatus } from "./discovery-status";
import { cn } from "@/lib/utils";
import type { Job, Workspace } from "@/lib/model";

const DAY = 86_400_000;
const ist = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const contacted = (j: Job) =>
  !!j.appliedAt || ["Applied", "Interview", "Offer"].includes(j.stage);

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {children}
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="size-3.5 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-56 text-xs">{hint}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (!value)
    return (
      <span className="text-[11.5px] text-muted-foreground">no change</span>
    );
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Home() {
  const { data, now, run, replace, setMessage } = useWorkspace();
  const [add, setAdd] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const stats = useMemo(() => {
    const jobs = (data?.jobs ?? []).filter((j) => !j.sample);
    const t = now.getTime();
    const inWeek = (iso: string | undefined, weeksAgo: number) => {
      if (!iso) return false;
      const age = t - new Date(iso).getTime();
      return age >= weeksAgo * 7 * DAY && age < (weeksAgo + 1) * 7 * DAY;
    };
    const active = jobs.filter((j) => j.stage !== "Archived");
    const reached = jobs.filter(contacted);
    const replied = jobs.filter((j) =>
      ["Interview", "Offer"].includes(j.stage),
    );
    const addedNow = jobs.filter((j) => inWeek(j.addedAt, 0)).length;
    const addedBefore = jobs.filter((j) => inWeek(j.addedAt, 1)).length;
    const sentNow = jobs.filter((j) => inWeek(j.appliedAt, 0)).length;
    const sentBefore = jobs.filter((j) => inWeek(j.appliedAt, 1)).length;

    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(t - (29 - i) * DAY);
      return {
        key: ist(d),
        label: d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata",
        }),
        added: 0,
        contacted: 0,
      };
    });
    const byDay = new Map(days.map((d) => [d.key, d]));
    for (const j of jobs) {
      const a = byDay.get(ist(j.addedAt));
      if (a) a.added++;
      if (j.appliedAt) {
        const c = byDay.get(ist(j.appliedAt));
        if (c) c.contacted++;
      }
    }

    // companies added per week for the last 8 weeks, split by source.
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = t - (7 - i) * 7 * DAY;
      const start = end - 7 * DAY;
      const inRange = (j: Job) => {
        const a = new Date(j.addedAt).getTime();
        return a > start && a <= end;
      };
      return {
        week: new Date(end).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata",
        }),
        YC: jobs.filter((j) => inRange(j) && j.source === "YC").length,
        X: jobs.filter((j) => inRange(j) && j.source === "X").length,
        LinkedIn: jobs.filter(
          (j) =>
            inRange(j) && (j.source === "LinkedIn" || j.source === "Other"),
        ).length,
      };
    });

    const funnel = [
      { label: "Found", value: jobs.length },
      { label: "Contacted", value: reached.length },
      { label: "Interviewing", value: replied.length },
      { label: "Offer", value: jobs.filter((j) => j.stage === "Offer").length },
    ];

    const todayKey = ist(now);
    const followUps = jobs
      .filter((j) => j.followUp && ["Applied", "Interview"].includes(j.stage))
      .sort((a, b) => a.followUp!.localeCompare(b.followUp!));

    return {
      active: active.length,
      addedNow,
      addedDelta: addedNow - addedBefore,
      reached: reached.length,
      sentNow,
      sentDelta: sentNow - sentBefore,
      replyRate: reached.length
        ? Math.round((replied.length / reached.length) * 100)
        : 0,
      replied: replied.length,
      days,
      totalAdded: days.reduce((n, d) => n + d.added, 0),
      weeks,
      weeksTotal: weeks.reduce((n, w) => n + w.YC + w.X + w.LinkedIn, 0),
      funnel,
      followUps,
      todayKey,
    };
  }, [data, now]);

  if (!data) return null;

  async function discover() {
    setDiscovering(true);
    try {
      await run(async () => {
        const result = await request<{
          workspace: Workspace;
          imported: number;
        }>("/api/discover", {
          method: "POST",
          signal: AbortSignal.timeout(65000),
        });
        replace(result.workspace);
        setMessage(`Found ${result.imported} new opportunities.`);
      });
    } finally {
      setDiscovering(false);
    }
  }

  const first = data.profile.name.split(" ")[0];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          first ? `Here’s where your search stands, ${first}.` : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAdd(true)}>
              <Plus /> Add company
            </Button>
            <Button size="sm" onClick={discover} disabled={discovering}>
              <RefreshCw className={discovering ? "animate-spin" : ""} />
              {discovering ? "Finding…" : "Find opportunities"}
            </Button>
          </>
        }
      />
      {discovering && <DiscoveryStatus loading />}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle hint="Companies you have not closed.">
                  In pipeline
                </CardTitle>
                <Delta value={stats.addedDelta} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight">
                  {stats.active}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  +{stats.addedNow} this week
                </span>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle hint="Companies you have emailed or applied to.">
                  Contacted
                </CardTitle>
                <Delta value={stats.sentDelta} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight">
                  {stats.reached}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  +{stats.sentNow} this week
                </span>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle hint="Share of contacted companies that moved to interviewing or offer.">
                  Reply rate
                </CardTitle>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight">
                  {stats.replyRate}%
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {stats.replied} in conversation
                </span>
              </div>
            </Card>
          </div>
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle hint="Companies added and contacted per day, last 30 days.">
                  Activity
                </CardTitle>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {stats.totalAdded}
                  <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                    added in 30 days
                  </span>
                </div>
              </div>
              <div className="flex gap-3 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <i
                    className="size-2 rounded-full"
                    style={{ background: GREYS[0] }}
                  />
                  Added
                </span>
                <span className="flex items-center gap-1.5">
                  <i
                    className="size-2 rounded-full"
                    style={{ background: GREYS[1] }}
                  />
                  Contacted
                </span>
              </div>
            </div>
            <div className="mt-3">
              <TrendChart
                data={stats.days}
                xKey="key"
                series={[
                  { key: "added", label: "Added" },
                  { key: "contacted", label: "Contacted" },
                ]}
                formatTick={(k) =>
                  new Date(k).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                }
                formatTitle={(k) =>
                  new Date(k).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                }
              />
            </div>
          </Card>
        </div>
        <FollowUps jobs={stats.followUps} today={stats.todayKey} now={now} />
        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:col-span-2">
          <Card>
            <CardTitle hint="Companies added each week, by where they came from.">
              Companies added
            </CardTitle>
            <div className="mt-1 mb-3 text-2xl font-semibold tracking-tight">
              {stats.weeksTotal}
              <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                in 8 weeks
              </span>
            </div>
            <GroupedBars
              data={stats.weeks}
              xKey="week"
              series={[
                { key: "YC", label: "YC" },
                { key: "X", label: "X" },
                { key: "LinkedIn", label: "LinkedIn & web" },
              ]}
              formatTitle={(w) => `Week to ${w}`}
              height={190}
            />
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle hint="How many companies reached each stage.">
                Funnel
              </CardTitle>
              <Link
                href="/dashboard/pipeline"
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
              >
                View pipeline <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="mt-3">
              <FunnelChart steps={stats.funnel} height={268} />
            </div>
          </Card>
        </div>
      </div>
      <AddOpportunity open={add} onOpenChange={setAdd} />
    </>
  );
}

function FollowUps({
  jobs,
  today,
  now,
}: {
  jobs: Job[];
  today: string;
  now: Date;
}) {
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + (i - now.getDay()) * DAY);
    return {
      key: ist(d),
      day: d.toLocaleDateString("en-GB", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }),
      date: d.toLocaleDateString("en-GB", {
        day: "numeric",
        timeZone: "Asia/Kolkata",
      }),
    };
  });
  const due = new Set(jobs.map((j) => j.followUp));
  const upcoming = jobs.slice(0, 6);
  const label = (date: string) => {
    if (date < today) return "Overdue";
    if (date === today) return "Today";
    const days = Math.round(
      (new Date(date).getTime() - new Date(today).getTime()) / DAY,
    );
    return days === 1 ? "Tomorrow" : `In ${days} days`;
  };
  return (
    <Card className="flex flex-col p-0 xl:row-span-1">
      <div className="grid grid-cols-7 border-b px-2 pt-3 text-center">
        {week.map((d) => (
          <div key={d.key} className="pb-2">
            <div className="text-[11px] text-muted-foreground">{d.day}</div>
            <div
              className={cn(
                "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[13px]",
                d.key === today && "bg-foreground font-medium text-background",
              )}
            >
              {d.date}
            </div>
            <i
              className={cn(
                "mx-auto mt-1 block size-1 rounded-full",
                due.has(d.key) ? "bg-brand" : "bg-transparent",
              )}
            />
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-2 p-3">
        <div className="text-[12.5px] text-muted-foreground">Follow-ups</div>
        {upcoming.length ? (
          upcoming.map((j) => (
            <Link
              key={j.id}
              href={`/dashboard/pipeline?job=${j.id}`}
              className="flex items-center gap-2.5 rounded-lg border p-2.5 transition hover:bg-accent/60"
            >
              <CompanyIcon name={j.company} logoUrl={j.logoUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{j.company}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  {j.role}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[11px]",
                  j.followUp! <= today
                    ? "bg-red-50 text-red-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {label(j.followUp!)}
              </span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-[12.5px] text-muted-foreground">
            No follow-ups scheduled. Sending an email from the pipeline sets one
            for 4 days later.
          </p>
        )}
      </div>
      <Link
        href="/dashboard/pipeline"
        className="flex items-center justify-center gap-1 border-t py-2.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        Open pipeline <ChevronRight className="size-3" />
      </Link>
    </Card>
  );
}
