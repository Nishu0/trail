"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader, MORE } from "./app-shell";
import { Connections } from "./profile";

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Connections, keys and the rest of your tools."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <Connections />
        </div>
        <section className="rounded-xl border bg-card p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="px-2.5 pt-2 pb-1 text-[12px] text-muted-foreground">
            More tools
          </div>
          {MORE.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] hover:bg-accent"
            >
              {m.label}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
