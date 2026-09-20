import { parseResume } from "./resume";
import { extractResumeWithClaude } from "./resume-ai";
import {
  enrichResumeProjects,
  localResumeProjects,
  mergeResumeFacts,
} from "./resume-projects";
import type { ResumeStage } from "./resume-progress";
import { findDevfolioProfile } from "./project-profile";

export async function extractResumeDetails(
  text: string,
  options: {
    useAI: boolean;
    apiKey?: string;
    aiFetch?: typeof fetch;
    importer?: NonNullable<
      Parameters<typeof enrichResumeProjects>[2]
    >["importer"];
    signal: AbortSignal;
    onProgress: (stage: ResumeStage) => void;
    identity?: { name?: string; github?: string };
  },
) {
  const parsed = parseResume(text);
  let fields = parsed.fields;
  let facts = localResumeProjects(text);
  let mode = "Local extraction";
  const extractionWarnings: string[] = [];
  options.onProgress("matching");
  if (options.useAI) {
    if (!options.apiKey)
      throw new Error("Claude autofill needs ANTHROPIC_API_KEY on the server.");
    try {
      const { projects, ...output } = await extractResumeWithClaude(text, {
        apiKey: options.apiKey,
        fetch: options.aiFetch,
        signal: options.signal,
      });
      fields = {
        ...fields,
        ...Object.fromEntries(
          Object.entries(output).filter(([, value]) => value.trim()),
        ),
      };
      facts = mergeResumeFacts(facts, projects, text);
      mode = "Claude Haiku 5.5 + document extraction";
    } catch {
      options.signal.throwIfAborted();
      extractionWarnings.push(
        "Claude could not complete this extraction. Document text and links were extracted locally; review the fields and retry AI processing if needed.",
      );
    }
  }

  options.onProgress("projects");
  const { projects, warnings, devfolioProfiles } = await enrichResumeProjects(
    text,
    facts,
    {
      signal: options.signal,
      importer: options.importer,
      githubUsername: fields.github || options.identity?.github,
    },
  );
  if (!fields.devfolio) {
    const devfolio = await findDevfolioProfile(
      devfolioProfiles,
      {
        name: fields.name || options.identity?.name,
        github: fields.github || options.identity?.github,
      },
      { signal: options.signal },
    );
    if (devfolio) fields = { ...fields, devfolio };
  }
  options.onProgress("preparing");
  options.signal.throwIfAborted();
  return {
    fields,
    projects,
    mode,
    projectLinks: [
      ...new Set([
        ...parsed.projectLinks,
        ...projects.map((project) => project.url).filter(Boolean),
      ]),
    ],
    warnings: [
      "Check the extracted details before applying. Confirm solo or team for each project; we don’t assume what you personally built.",
      ...extractionWarnings,
      ...warnings,
    ],
  };
}
