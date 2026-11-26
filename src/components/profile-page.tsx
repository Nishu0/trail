"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  FileText,
  Link2,
  MapPin,
  Quote,
  RefreshCw,
  Target,
  BriefcaseBusiness,
  Upload,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "./app-shell";
import { useWorkspace, request } from "./workspace";
import { localDate } from "./shared";
import { cn } from "@/lib/utils";
import type { LinkedInTuningState } from "@/lib/linkedin-types";

const EDIT = "/dashboard/profile/edit";

// lucide dropped brand icons, so these two are inline.
function Linkedin({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}
function Github({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-start gap-2.5">
          {Icon && <Icon className="mt-0.5 size-4 text-muted-foreground" />}
          <div>
            <h2 className="text-[13.5px] font-medium">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 pt-3 pb-5">{children}</div>
    </section>
  );
}

function EditLink({ label = "Edit" }: { label?: string }) {
  return (
    <Link
      href={EDIT}
      className="shrink-0 text-[12px] text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function Ring({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 52 52" className="size-14 -rotate-90">
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
        />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="var(--color-chart-2)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12px] font-medium">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function ProfilePage() {
  const { data } = useWorkspace();
  const [linkedin, setLinkedin] = useState<LinkedInTuningState | null>(null);
  const [bioOpen, setBioOpen] = useState(false);
  const [allBuilds, setAllBuilds] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<LinkedInTuningState>("/api/linkedin", { signal: controller.signal })
      .then(setLinkedin)
      .catch(() => setLinkedin(null)); // linkedin is optional on this page
    return () => controller.abort();
  }, []);

  if (!data) return null;
  const p = data.profile;
  const skills = p.skills
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const experience = (linkedin?.sections ?? []).filter(
    (s) => s.kind === "experience" && s.currentText.trim(),
  );
  const headline =
    p.headline ||
    linkedin?.sections.find((s) => s.kind === "headline")?.currentText ||
    "";
  const builds = p.projects.filter((x) => x.name);
  const shownBuilds = allBuilds ? builds : builds.slice(0, 3);
  const github = p.github
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\/$/, "");
  const links = [
    linkedin?.profileUrl && {
      icon: Linkedin,
      label: linkedin.profileUrl
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, ""),
      href: linkedin.profileUrl,
    },
    github && {
      icon: Github,
      label: `github.com/${github}`,
      href: `https://github.com/${github}`,
    },
    p.devfolio && { icon: Link2, label: "Devfolio", href: p.devfolio },
    p.devpost && { icon: Link2, label: "Devpost", href: p.devpost },
    p.ethglobal && { icon: Link2, label: "ETHGlobal", href: p.ethglobal },
  ].filter(Boolean) as { icon: typeof Link2; label: string; href: string }[];

  const checklist = [
    { label: "The role you want", done: !!p.target },
    { label: "Your links", done: links.length > 0 },
    { label: "You in one line", done: !!headline },
    { label: "Your proudest build", done: builds.length > 0 },
    { label: "Your skills", done: skills.length > 0 },
    { label: "How you write", done: !!p.writing.trim() },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <>
      <PageHeader
        title="Profile"
        description="What the emails you send are written from."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href={EDIT}>
              <Pencil /> Edit profile
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-4">
          <section className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-muted text-xl font-semibold">
                  {(p.name || "Y").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold tracking-tight">
                  {p.name || "Your name"}
                </h2>
                <p className="truncate text-[13px] text-muted-foreground">
                  {headline || "Add a one-line headline"}
                </p>
                {p.location && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
                    <MapPin className="size-3" /> {p.location}
                  </p>
                )}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-center gap-2">
              {links.length ? (
                links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-[12px] hover:bg-muted"
                  >
                    <l.icon className="size-3.5" /> {l.label}
                  </a>
                ))
              ) : (
                <Link
                  href={EDIT}
                  className="text-[12.5px] text-muted-foreground hover:text-foreground"
                >
                  Add your links
                </Link>
              )}
              {linkedin?.lastCheckedAt && (
                <span className="ml-auto flex items-center gap-3 text-[12px] text-muted-foreground">
                  LinkedIn read {localDate(linkedin.lastCheckedAt)}
                  <Link
                    href="/dashboard/linkedin"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <RefreshCw className="size-3" /> Read again
                  </Link>
                </span>
              )}
            </div>
          </section>

          <Section
            icon={Quote}
            title="How founders meet you"
            action={<EditLink />}
          >
            {p.bio ? (
              <>
                <p
                  className={cn(
                    "text-[14px] leading-[1.7] text-foreground/90",
                    !bioOpen && "line-clamp-4",
                  )}
                >
                  {p.bio}
                </p>
                {p.bio.length > 320 && (
                  <button
                    onClick={() => setBioOpen((o) => !o)}
                    className="mt-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
                  >
                    {bioOpen ? "Show less" : "Read more"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Add a short bio. It opens every email you send.
              </p>
            )}
            <Separator className="my-4" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] text-muted-foreground">
                What stands out
              </span>
              <EditLink />
            </div>
            {builds.length ? (
              <ol className="grid gap-3 sm:grid-cols-3">
                {shownBuilds.map((b, i) => (
                  <li key={b.id} className="flex gap-2.5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#eaf0fb] text-[11px] font-medium text-[#3f6fc4]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {b.name}
                      </div>
                      <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
                        {b.description ||
                          b.stack ||
                          "Add what you built and why it mattered."}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Add a project you are proud of.
              </p>
            )}
            {builds.length > 3 && (
              <button
                onClick={() => setAllBuilds((o) => !o)}
                className="mt-3 text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                {allBuilds ? "Show fewer" : `Show all ${builds.length}`}
              </button>
            )}
          </Section>

          <Section
            icon={Target}
            title="What you’re looking for"
            subtitle="Discovery searches for this and filters out the rest."
            action={<EditLink />}
          >
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-muted-foreground">Role</dt>
                <dd className="mt-0.5 text-[13.5px]">
                  {p.target || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">Location</dt>
                <dd className="mt-0.5 text-[13.5px]">
                  {p.location || "Anywhere"}
                </dd>
              </div>
            </dl>
            {skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {skills.slice(0, 18).map((s) => (
                  <span
                    key={s}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 text-[12px]"
                  >
                    {s}
                  </span>
                ))}
                {skills.length > 18 && (
                  <span className="px-1 text-[12px] text-muted-foreground">
                    +{skills.length - 18}
                  </span>
                )}
              </div>
            )}
          </Section>

          <Section
            icon={BriefcaseBusiness}
            title="Experience"
            subtitle={
              experience.length ? "From your LinkedIn profile." : undefined
            }
            action={
              <Link
                href="/dashboard/linkedin"
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                Tune on LinkedIn
              </Link>
            }
          >
            {experience.length ? (
              <ol className="relative grid gap-4 border-l pl-4">
                {experience.map((e) => (
                  <li key={e.id} className="relative">
                    <i className="absolute top-1.5 -left-[21px] size-2 rounded-full border-2 border-card bg-muted-foreground/40" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[13.5px] font-medium">
                        {e.title || e.label}
                        {e.company && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {e.company}
                          </span>
                        )}
                      </span>
                      {e.dates && (
                        <span className="text-[12px] text-muted-foreground">
                          {e.dates}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {e.currentText}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Connect LinkedIn to bring in your roles.{" "}
                <Link
                  href="/dashboard/linkedin"
                  className="underline underline-offset-2"
                >
                  Connect
                </Link>
              </p>
            )}
          </Section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-4">
          <section className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-3">
              <Ring value={done / checklist.length} />
              <div>
                <div className="text-[13.5px] font-medium">
                  Make your emails sharper
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {done} of {checklist.length} done
                </div>
              </div>
            </div>
            <ul className="mt-4 grid gap-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link
                    href={EDIT}
                    className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "grid size-[18px] place-items-center rounded-full",
                        c.done
                          ? "bg-emerald-500 text-white"
                          : "border border-dashed border-muted-foreground/40",
                      )}
                    >
                      {c.done && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "text-[13px]",
                        c.done && "text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                <FileText className="size-4 text-muted-foreground" /> Your
                resume
              </div>
              <Button size="xs" variant="outline" asChild>
                <Link href={EDIT}>
                  <Upload /> {p.resume ? "Replace" : "Upload"}
                </Link>
              </Button>
            </div>
            {p.resume ? (
              <div className="mt-3 rounded-lg border bg-muted/30 p-2.5">
                <div className="truncate text-[13px]">{p.resume.name}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  Uploaded {localDate(p.resume.uploadedAt)}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                No resume yet. A PDF or Word file; emails are written from it.
              </p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            {[
              { label: "Interview prep", href: "/dashboard/interview" },
              { label: "GitHub activity", href: "/dashboard/activity" },
              { label: "LinkedIn tuning", href: "/dashboard/linkedin" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] hover:bg-accent"
              >
                {l.label}
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
