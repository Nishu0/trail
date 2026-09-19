import {
  checkOrigin,
  getWorkspace,
  record,
  updateWorkspace,
} from "@/lib/store";
import { mutationSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await getWorkspace());
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Unable to read workspace database.",
      },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const action = mutationSchema.parse(await request.json());
    const workspace = await updateWorkspace((w) => {
      if (action.action === "profile") {
        w.profile = action.profile;
        record(w, "Updated your builder profile");
      }
      if (action.action === "project") {
        const index = w.profile.projects.findIndex(
          (project) => project.id === action.project.id,
        );
        if (index >= 0) w.profile.projects[index] = action.project;
        else {
          if (w.profile.projects.length >= 40)
            throw new Error("You can save up to 40 projects.");
          w.profile.projects.push(action.project);
        }
        if (action.devfolio && !w.profile.devfolio) {
          if (
            !/^https:\/\/devfolio\.co\/@[a-z0-9_-]+\/?$/i.test(action.devfolio)
          )
            throw new Error("Use a Devfolio profile link.");
          w.profile.devfolio = action.devfolio;
        }
        record(w, `Saved project ${action.project.name}`);
      }
      if (action.action === "delete-project") {
        const project = w.profile.projects.find(
          (project) => project.id === action.id,
        );
        if (!project) throw new Error("Project not found.");
        w.profile.projects = w.profile.projects.filter(
          (project) => project.id !== action.id,
        );
        record(w, `Removed project ${project.name}`);
      }
      if (action.action === "clear-samples")
        w.jobs = w.jobs.filter((j) => !j.sample);
      if (action.action === "add-job") {
        if (
          action.job.url &&
          w.jobs.some((j) => !j.sample && j.url === action.job.url)
        )
          throw new Error("This opportunity is already saved.");
        w.jobs.unshift({
          ...action.job,
          id: crypto.randomUUID(),
          stage: "Saved",
          addedAt: new Date().toISOString(),
        });
        record(w, `Saved ${action.job.role} at ${action.job.company}`);
      }
      if (action.action === "job" || action.action === "snooze") {
        const job = w.jobs.find((j) => j.id === action.id);
        if (!job) throw new Error("Opportunity not found.");
        if (job.sample)
          throw new Error(
            "Sample leads are previews. Save a real opportunity first.",
          );
        if (action.action === "snooze") job.followUp = action.followUp;
        else {
          job.stage = action.stage;
          if (action.channel) job.channel = action.channel;
          if (action.followUp !== undefined) job.followUp = action.followUp;
          if (action.notes !== undefined) job.notes = action.notes;
          if (action.stage === "Applied" && !job.appliedAt)
            job.appliedAt = new Date().toISOString();
          record(w, `${job.company} moved to ${action.stage.toLowerCase()}`);
        }
      }
      if (action.action === "company") {
        const index = w.companies.findIndex((c) => c.id === action.id);
        if (index >= 0)
          w.companies[index] = { ...action.company, id: action.id! };
        else w.companies.push({ ...action.company, id: crypto.randomUUID() });
        record(w, `Updated research notes for ${action.company.name}`);
      }
      if (action.action === "draft") {
        const draft = w.drafts.find((d) => d.id === action.id);
        if (!draft) throw new Error("Draft not found.");
        draft.subject = action.subject;
        draft.body = action.body;
      }
    });
    return Response.json(workspace);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not save changes" },
      { status: 400 },
    );
  }
}
