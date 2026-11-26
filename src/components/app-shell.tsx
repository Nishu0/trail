"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  UserRound,
  Columns3,
  Settings,
  Search,
  ChevronsUpDown,
  ArrowUpRight,
  CircleHelp,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mark } from "./mark";
import { Modal } from "./shared";
import { useWorkspace } from "./workspace";
import { describe } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export const NAV = [
  {
    view: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutGrid,
    group: "Platform",
  },
  {
    view: "profile",
    label: "Profile",
    href: "/dashboard/profile",
    icon: UserRound,
    group: "Platform",
  },
  {
    view: "pipeline",
    label: "Pipeline",
    href: "/dashboard/pipeline",
    icon: Columns3,
    group: "Platform",
  },
  {
    view: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    group: "System",
  },
] as const;

// pages that left the sidebar but still exist, reachable from search and settings.
export const MORE = [
  { label: "Discover opportunities", href: "/dashboard/discover" },
  { label: "Interview prep", href: "/dashboard/interview" },
  { label: "Companies", href: "/dashboard/companies" },
  { label: "Contributions", href: "/dashboard/contributions" },
  { label: "GitHub activity", href: "/dashboard/activity" },
  { label: "LinkedIn tuning", href: "/dashboard/linkedin" },
  { label: "Edit profile", href: "/dashboard/profile/edit" },
];

// which sidebar item lights up for each url.
function activeFor(path: string) {
  const first = path.split("/")[2] ?? "";
  if (first === "" || first === "overview") return "dashboard";
  if (["pipeline", "applications", "outreach"].includes(first))
    return "pipeline";
  if (["settings", "connections"].includes(first)) return "settings";
  if (["profile", "linkedin", "activity", "interview"].includes(first))
    return "profile";
  return "";
}

export function AppShell({ children }: { children: ReactNode }) {
  const active = activeFor(usePathname());
  const { data, now, message, error, setMessage } = useWorkspace();
  const router = useRouter();
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const jobs = data?.jobs.filter((j) => !j.sample) ?? [];
  const rows = data ? jobs.map((j) => describe(j, data.drafts, now)) : [];
  const needs = rows.filter((r) => r.group === "needs").length;
  const name = data?.profile.name || "Your workspace";
  const targets = [
    ...NAV.map((n) => ({ label: n.label, href: n.href })),
    ...MORE,
  ].filter((t) => t.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
      className="trail-app font-sans text-[13px]"
    >
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="gap-3">
          <div className="flex items-center justify-between px-1 pt-1 group-data-[collapsible=icon]:justify-center">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold tracking-tight group-data-[collapsible=icon]:hidden"
            >
              <span className="grid size-6 place-items-center rounded-md bg-brand text-white [&_svg]:size-3.5">
                <Mark />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                trail
              </span>
            </Link>
            <SidebarTrigger className="text-muted-foreground" />
          </div>
          <button
            onClick={() => setSearch(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-sidebar-border bg-background px-2.5 text-muted-foreground transition hover:bg-accent group-data-[collapsible=icon]:hidden"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-sidebar-border px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </SidebarHeader>
        <SidebarContent>
          {(["Platform", "System"] as const).map((group) => (
            <SidebarGroup key={group} className="py-1">
              <SidebarGroupLabel className="h-7 text-[11.5px] font-normal text-muted-foreground group-data-[collapsible=icon]:pointer-events-none">
                {group}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {NAV.filter((n) => n.group === group).map((n) => (
                    <SidebarMenuItem key={n.view}>
                      <SidebarMenuButton
                        asChild
                        isActive={active === n.view}
                        tooltip={n.label}
                        className="h-8 text-[13px] [&>span:last-child]:overflow-clip [&>span:last-child]:text-clip [&>span:last-child]:whitespace-nowrap"
                      >
                        <Link href={n.href}>
                          <n.icon />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {n.view === "pipeline" && needs > 0 && (
                        <SidebarMenuBadge className="text-muted-foreground">
                          {needs}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="gap-2">
          <SidebarMenu className="gap-0.5">
            {[
              { label: "How Trail works", href: "/about", icon: CircleHelp },
              { label: "Back to website", href: "/", icon: ArrowUpRight },
            ].map((l) => (
              <SidebarMenuItem key={l.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={l.label}
                  className="h-7 text-[12.5px] text-muted-foreground [&>span:last-child]:overflow-clip [&>span:last-child]:text-clip [&>span:last-child]:whitespace-nowrap"
                >
                  <Link href={l.href}>
                    <l.icon />
                    <span>{l.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="h-11 group-data-[collapsible=icon]:p-0!">
                <Avatar className="size-7 rounded-md group-data-[collapsible=icon]:size-8">
                  <AvatarFallback className="rounded-md bg-sidebar-accent text-[11px] font-medium">
                    {name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 overflow-clip leading-tight whitespace-nowrap">
                  <span className="text-clip text-[13px] font-medium">
                    {name}
                  </span>
                  <span className="text-clip text-[11.5px] text-muted-foreground">
                    {data?.profile.headline || "Your profile"}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {name}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <UserRound /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/about">
                  <CircleHelp /> How Trail works
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/">
                  <ArrowUpRight /> Back to the website
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-5 pb-8 md:px-8">
          {(error || message) && (
            <div
              role={error ? "alert" : "status"}
              className={cn(
                "mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]",
                error
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800",
              )}
            >
              {!error && <Check className="size-3.5" />}
              <span className="flex-1">{error || message}</span>
              {!error && (
                <button aria-label="Dismiss" onClick={() => setMessage("")}>
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
      <Modal
        title="Jump to"
        description="Pages in your workspace."
        open={search}
        onOpenChange={setSearch}
      >
        <input
          autoFocus
          className="mb-2 h-9 w-full rounded-lg border px-3 text-sm outline-none"
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid gap-0.5">
          {targets.map((t) => (
            <button
              key={t.href}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                router.push(t.href);
                setSearch(false);
                setQuery("");
              }}
            >
              {t.label}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Modal>
    </SidebarProvider>
  );
}

/** Page title row: serif title on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <div>
          <h1 className="text-[19px] leading-tight font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
