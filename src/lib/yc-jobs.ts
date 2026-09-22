import { load } from "cheerio";
import type { Job } from "./model";
export async function fetchYCJobs(signal?: AbortSignal): Promise<Job[]> {
  const response = await fetch("https://www.ycombinator.com/jobs", {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      "YC is unavailable. You can still save a job link manually.",
    );
  const $ = load(await response.text());
  const jobs: Job[] = [];
  type Listing = {
    id: number;
    companyName: string;
    title: string;
    url: string;
    location: string;
    companyOneLiner?: string;
    salaryRange?: string;
    minExperience?: string;
    skills?: (string | { name: string })[];
  };
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.jobPostings))
      for (const item of obj.jobPostings as Listing[]) {
        if (
          !item.title ||
          !item.companyName ||
          !item.url?.startsWith("/companies/")
        )
          continue;
        jobs.push({
          id: `yc-${item.id}`,
          company: item.companyName,
          role: item.title,
          url: `https://www.ycombinator.com${item.url}`,
          source: "YC",
          location: item.location || "See listing",
          description: [
            item.companyOneLiner,
            item.salaryRange,
            item.minExperience && `${item.minExperience} experience`,
          ]
            .filter(Boolean)
            .join(" · "),
          tags: (item.skills || [])
            .map((s) => (typeof s === "string" ? s : s.name))
            .filter(Boolean),
          stage: "Saved",
          notes: "",
          addedAt: new Date().toISOString(),
        });
      }
    for (const [key, child] of Object.entries(obj))
      if (key !== "jobPostings") visit(child);
  };
  $("[data-page], [data-props]").each((_, element) => {
    for (const attribute of ["data-page", "data-props"]) {
      const raw = $(element).attr(attribute);
      if (raw) {
        try {
          visit(JSON.parse(raw));
        } catch {
          /* Not a JSON data attribute. */
        }
      }
    }
  });
  if (!jobs.length)
    throw new Error(
      "YC changed its public listing format. Open the source and save selected job links manually.",
    );

  return [...new Map(jobs.map((job) => [job.url, job])).values()];
}
