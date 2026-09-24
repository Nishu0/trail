"use client";
import { Check, AlertCircle, LoaderCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "./workspace";
export function DiscoveryStatus({ loading }: { loading: boolean }) {
  const { data } = useWorkspace();
  const report = data?.discovery;
  if (!loading && !report) return null;
  return (
    <section
      className="opportunity-source-report"
      aria-label="Opportunity search sources"
      aria-live="polite"
    >
      <div className="source-report-heading">
        <span className="tiny-kicker">
          {loading ? "FINDING YOUR NEXT CHAPTER" : "YOUR LAST DISCOVERY"}
        </span>
        <span>
          {loading
            ? "Searching three sources in parallel"
            : report &&
              `Checked ${new Date(report.checkedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
        </span>
      </div>
      <div className="source-report-grid">
        {(["YC", "X", "LinkedIn"] as const).map((name) => {
          const source = report?.sources.find(
            (source) => source.source === name,
          );
          const complete = source?.status === "complete";
          return (
            <article
              key={name}
              className={`source-report-card ${!loading && source && !complete ? "source-unavailable" : ""}`}
            >
              <div>
                <b>
                  {name === "LinkedIn"
                    ? "LinkedIn · public web"
                    : name === "X"
                      ? "X · hiring posts"
                      : "YC · startup roles"}
                </b>
                {loading ? (
                  <LoaderCircle size={15} className="spin" />
                ) : complete ? (
                  <Check size={15} />
                ) : (
                  <AlertCircle size={15} />
                )}
              </div>
              <strong>
                {loading
                  ? "Searching…"
                  : complete
                    ? `${source.imported} new ${source.imported === 1 ? "lead" : "leads"}`
                    : source?.status === "not_configured"
                      ? "Connect search"
                      : "Source unavailable"}
              </strong>
              <p>
                {loading
                  ? name === "YC"
                    ? "Reading current public listings."
                    : name === "X"
                      ? "Finding relevant hiring posts and checking employer details."
                      : "Looking for publicly indexed job pages."
                  : complete
                    ? `${source.checked} checked · ${source.matched} matched. ${source.message}`
                    : source?.message}
              </p>
              {!loading && source?.status === "not_configured" && (
                <Link href="/dashboard/connections">
                  Connections <ArrowUpRight size={12} />
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
