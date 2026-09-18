import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { updateWorkspace, record } = await import("../src/lib/store");
const { closeDatabase } = await import("../src/db/client");
// One-time removal of the original demo records; never remove a researched company.
const seeds: Record<string, string> = {
  turso: "Turso",
  inngest: "Inngest",
  cal: "Cal.com",
  linear: "Linear",
};
try {
  let removedCompanies = 0,
    removedJobs = 0;
  const workspace = await updateWorkspace((w) => {
    const keep = w.companies.filter(
      (c) =>
        !(
          seeds[c.id] === c.name &&
          !c.people.length &&
          !/Research source:|Checked:/i.test(c.notes)
        ),
    );
    removedCompanies = w.companies.length - keep.length;
    w.companies = keep;
    const jobs = w.jobs.filter((job) => !job.sample);
    removedJobs = w.jobs.length - jobs.length;
    const remainingJobs = new Set(jobs.map((job) => job.id));
    w.drafts = w.drafts.filter((draft) => remainingJobs.has(draft.jobId));
    w.jobs = jobs;
    if (removedCompanies || removedJobs)
      record(w, "Removed the original sample companies and opportunities");
  });
  console.log(
    JSON.stringify({
      removedCompanies,
      removedJobs,
      savedCompanies: workspace.companies.length,
      savedJobs: workspace.jobs.length,
      projectsPreserved: workspace.profile.projects.length,
    }),
  );
} catch {
  console.error("Sample cleanup failed; the transaction was rolled back.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
