"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Check, CircleHelp } from "lucide-react";
import { Button } from "./ui/button";
import { request, useWorkspace } from "./workspace";
import type { Workspace } from "@/lib/model";
export function JobChecks() {
  const { data, replace, setMessage } = useWorkspace();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const eligible =
    data?.jobs.filter((j) => !j.sample && j.stage !== "Archived") || [];
  const signature = eligible
    .filter(
      (j) =>
        !j.health || Date.parse(j.health.checkedAt) < Date.now() - 6 * 3600000,
    )
    .map((j) => j.id)
    .join(",");
  async function check(force = false) {
    if (started.current) return;
    started.current = true;
    setChecking(true);
    setError("");
    try {
      const result = await request<{
        workspace: Workspace;
        archived: number;
        checked: number;
      }>("/api/jobs/check", {
        method: "POST",
        body: JSON.stringify({ force }),
        signal: AbortSignal.timeout(65000),
      });
      replace(result.workspace);
      if (result.archived)
        setMessage(
          `${result.archived} closed or removed listing${result.archived === 1 ? " was" : "s were"} moved to Archive. Application history is kept.`,
        );
    } catch {
      setError("Couldn’t check sources. Try again.");
    } finally {
      setChecking(false);
      started.current = false;
    }
  }
  useEffect(() => {
    if (signature)
      void check(); /* Checks are due every six hours, not on each render. */
  }, [signature]);
  const checked = eligible.filter((j) => j.health).length;
  const uncertain = eligible.filter(
    (j) =>
      j.health?.status === "unavailable" || j.health?.status === "unverified",
  ).length;
  return (
    <div className="job-check-control">
      <span
        title={
          uncertain
            ? `${uncertain} sources need a public availability check; these are kept active.`
            : "Confirmed closed listings move to Archive. Checks run every six hours."
        }
      >
        {checking ? (
          <RefreshCw size={13} className="spin" />
        ) : uncertain ? (
          <CircleHelp size={13} />
        ) : (
          <Check size={13} />
        )}
        {checking
          ? "Checking job links…"
          : error ||
            (checked
              ? `${checked} links checked${uncertain ? ` · ${uncertain} unverified` : ""}`
              : "Job links not checked yet")}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={checking || !eligible.length}
        onClick={() => void check(true)}
      >
        <RefreshCw size={13} />
        Refresh links
      </Button>
    </div>
  );
}
