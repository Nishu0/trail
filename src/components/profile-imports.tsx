"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FileText,
  Upload,
  RefreshCw,
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { WorkspaceSelect } from "./ui/select";
import { Field, External, localDate } from "./shared";
import { request } from "./workspace";
import { projectStory, type Profile, type Project } from "@/lib/model";
import type { ResumeImport, ResumeFields } from "@/lib/resume";
import type { ProjectImport } from "@/lib/project-import";
import { readResumeResponse, type ResumeStage } from "@/lib/resume-progress";
import { ResumeProcessing } from "./resume-processing";
import { mergeProjects } from "@/lib/project-merge";
const labels: Record<keyof ResumeFields, string> = {
  name: "Your name",
  headline: "How you describe your work",
  bio: "Your experience",
  skills: "Skills",
  location: "Location",
  github: "GitHub username",
  devpost: "Devpost",
  devfolio: "Devfolio",
};
export type ResumeWorkflow = "idle" | "selected" | "processing" | "review";
export function ResumeUpload({
  profile,
  savedResume,
  onChange,
  onWorkflowChange,
}: {
  profile: Profile;
  savedResume?: Profile["resume"];
  onChange: (p: Profile) => void;
  onWorkflowChange: (state: ResumeWorkflow) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [result, setResult] = useState<ResumeImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [chosenProjects, setChosenProjects] = useState<Record<string, boolean>>(
    {},
  );
  const [savedReview, setSavedReview] = useState(false);
  const [notice, setNotice] = useState("");
  const [stage, setStage] = useState<ResumeStage | "uploading">("uploading");
  const upload = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const showUpload = !profile.resume || replacing;
  const resumeIsSaved = !!(
    profile.resume &&
    savedResume &&
    (profile.resume.id
      ? profile.resume.id === savedResume.id
      : profile.resume.name === savedResume.name &&
        profile.resume.uploadedAt === savedResume.uploadedAt)
  );
  useEffect(() => () => upload.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    request<{ resumeAI: boolean }>("/api/status", { signal: controller.signal })
      .then((status) => setUseAI(status.resumeAI))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function resetUpload() {
    setFile(null);
    setResult(null);
    setError("");
    setNotice("");
    setSavedReview(false);
    setReplacing(false);
    if (fileInput.current) fileInput.current.value = "";
    onWorkflowChange("idle");
  }
  async function read(saved = false) {
    if ((!saved && !file) || upload.current) return;
    setSavedReview(saved);
    const controller = new AbortController();
    upload.current = controller;
    setStage("uploading");
    setLoading(true);
    onWorkflowChange("processing");
    setError("");
    setResult(null);
    setNotice("");
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      form.set("useAI", String(useAI));
      const response = await fetch(
        saved ? "/api/resume/projects" : "/api/resume",
        {
          method: "POST",
          body: saved ? JSON.stringify({ useAI }) : form,
          headers: {
            Accept: "application/x-ndjson",
            ...(saved ? { "Content-Type": "application/json" } : {}),
          },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(90000),
          ]),
        },
      );
      const data = await readResumeResponse(response, setStage);
      setResult(data);
      setChosenProjects(
        Object.fromEntries(data.projects.map((project) => [project.id, true])),
      );
      onWorkflowChange("review");
      setChosen(
        Object.fromEntries(
          Object.entries(data.fields)
            .filter(([, v]) => v)
            .map(([k]) => [k, true]),
        ),
      );
    } catch (e) {
      onWorkflowChange(saved ? "idle" : "selected");
      if (controller.signal.aborted)
        setNotice("Processing cancelled. Your profile hasn’t changed.");
      else
        setError(
          (e as Error).name === "TimeoutError"
            ? "This is taking longer than expected. Please try again."
            : (e as Error).message,
        );
    } finally {
      upload.current = null;
      setLoading(false);
    }
  }
  function apply() {
    if (!result) return;
    const updated = {
      ...profile,
      resume: savedReview
        ? profile.resume
        : {
            id: result.resumeId,
            fileStored: !!result.resumeId,
            name: result.filename,
            text: result.text,
            uploadedAt: new Date().toISOString(),
          },
      projects: mergeProjects(
        profile.projects,
        result.projects.filter((project) => chosenProjects[project.id]),
      ),
    };
    for (const key of Object.keys(labels) as (keyof ResumeFields)[]) {
      if (
        chosen[key] &&
        result.fields[key] &&
        (overwrite || !profile[key].trim())
      )
        updated[key] = result.fields[key]!;
    }
    onChange(updated);
    onWorkflowChange("idle");
    setResult(null);
    setFile(null);
    setReplacing(false);
    setSavedReview(false);
    if (fileInput.current) fileInput.current.value = "";
    setNotice(
      "Selected details and projects added to your profile. Open each project to confirm solo or team, then save your story.",
    );
  }
  return (
    <section className="panel form-panel resume-panel">
      <div className="panel-heading">
        <div>
          <span className="tiny-kicker">
            {profile.resume ? "YOUR RÉSUMÉ" : "A QUICK START / YOUR RÉSUMÉ"}
          </span>
          <h2>
            {profile.resume
              ? replacing
                ? "Update your résumé"
                : "Your résumé is in place"
              : "Bring your experience with you"}
          </h2>
        </div>
        {profile.resume ? (
          <span
            className="resume-saved-badge"
            data-saved={resumeIsSaved}
            role="status"
          >
            <CheckCircle2 size={14} />
            {resumeIsSaved ? "Saved" : "Ready to save"}
          </span>
        ) : (
          <FileText size={20} />
        )}
      </div>
      <div className="form-stack">
        {profile.resume && (
          <div className="resume-attached">
            <FileText size={17} />
            <span>
              <b>{profile.resume.name}</b>
              <small>
                {resumeIsSaved
                  ? `Saved ${localDate(profile.resume.uploadedAt)} · ${profile.resume.fileStored ? "Original file and text" : "Résumé text"} attached to your profile`
                  : "Details applied. Save your story to keep this résumé."}
              </small>
              {profile.resume.id && profile.resume.fileStored && (
                <a href={`/api/resume?id=${profile.resume.id}`}>
                  Download original file
                </a>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || replacing || !!result}
              aria-label="Remove attached résumé"
              onClick={() => {
                const next = { ...profile };
                delete next.resume;
                onChange(next);
                resetUpload();
                setNotice(
                  "Résumé removed. Save your story to keep this change.",
                );
              }}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        )}
        {profile.resume && !showUpload && !loading && !result && (
          <div className="resume-saved-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetUpload();
                setReplacing(true);
              }}
            >
              <Upload size={14} /> Upload new résumé
            </Button>
            {resumeIsSaved && (
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => void read(true)}
              >
                <RefreshCw
                  size={14}
                  className={loading && savedReview ? "spin" : ""}
                />
                Find projects in saved résumé
              </Button>
            )}
          </div>
        )}
        {showUpload && (
          <div className="resume-upload-controls">
            <div className="resume-upload-intro">
              <p className="muted">
                {profile.resume
                  ? "Choose a new résumé. Your current one stays in place until you review, apply, and save the new details."
                  : "Upload your résumé to fill in your story. You can check and edit everything first."}
              </p>
              {profile.resume && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={resetUpload}
                >
                  Cancel replacement
                </Button>
              )}
            </div>
            <ol className="resume-flow" aria-label="Résumé import steps">
              <li className={!file && !result ? "current" : ""}>
                <span>01</span> Choose file
              </li>
              <li className={file && !result ? "current" : ""}>
                <span>02</span> Process
              </li>
              <li className={result ? "current" : ""}>
                <span>03</span> Review & apply
              </li>
              <li>
                <span>04</span> Save your story
              </li>
            </ol>
            <Field
              label="Choose your résumé"
              hint="PDF, DOCX or TXT · up to 5 MB · text-based PDF required."
            >
              <input
                type="file"
                ref={fileInput}
                accept=".pdf,.docx,.txt"
                disabled={loading}
                onChange={(e) => {
                  setSavedReview(false);
                  setFile(e.target.files?.[0] || null);
                  onWorkflowChange(e.target.files?.[0] ? "selected" : "idle");
                  setResult(null);
                  setNotice("");
                  setError("");
                }}
              />
            </Field>
            <label className="check-line">
              <input
                type="checkbox"
                checked={useAI}
                disabled={loading}
                onChange={(e) => setUseAI(e.target.checked)}
              />
              <span>
                Use Claude Haiku 5.5 to autofill{" "}
                <small>
                  Optional. Sends résumé text to Anthropic. Requires a server
                  API key. Local extraction works without a key.
                </small>
              </span>
            </label>
            <div className="resume-process-action">
              <Button
                type="button"
                className="orange-button resume-process-button"
                disabled={!file || loading}
                onClick={() => void read()}
              >
                {loading ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Upload size={14} />
                )}
                {loading
                  ? "Processing your résumé…"
                  : useAI
                    ? "Process résumé with Claude"
                    : "Process résumé"}
              </Button>
              {file && !loading && (
                <button
                  type="button"
                  className="resume-skip"
                  onClick={resetUpload}
                >
                  Skip this upload
                </button>
              )}
            </div>
            {file && !loading && !result && !error && (
              <p className="resume-next-step" role="status">
                <b>Your file is selected. Processing hasn’t started yet.</b>{" "}
                Click{" "}
                {useAI ? "“Process résumé with Claude”" : "“Process résumé”"}{" "}
                above to read it and see the live progress.
              </p>
            )}
            <small className="muted">
              The original file and extracted text are stored privately in your
              workspace database. Review and apply the details, then save your
              story to update your profile.
            </small>
          </div>
        )}
        {loading && (file || profile.resume) && (
          <ResumeProcessing
            stage={stage}
            filename={savedReview ? profile.resume!.name : file!.name}
            useAI={useAI}
            onCancel={() => upload.current?.abort()}
          />
        )}
        {error && (
          <p role="alert" className="status-message error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="import-notice">
            {notice}
          </p>
        )}
        {result && (
          <div className="import-review">
            <div className="resume-complete" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                <b>
                  {savedReview
                    ? "Your projects are ready."
                    : "Your résumé is ready."}
                </b>
                <small>
                  {!savedReview && (
                    <>
                      {
                        Object.values(result.fields).filter((value) =>
                          value?.trim(),
                        ).length
                      }{" "}
                      fields found
                    </>
                  )}
                  {result.projects.length
                    ? `${savedReview ? "" : " · "}${result.projects.length} projects found`
                    : ""}{" "}
                  · Review, apply, then save your story.
                </small>
              </span>
            </div>
            <div>
              <span className="tiny-kicker">{result.mode}</span>
              <h3>
                {savedReview
                  ? "Here’s the work in your résumé."
                  : "Does this look like you?"}
              </h3>
              <p className="muted">
                {savedReview
                  ? "Choose the projects to add. Your existing edits and ownership answers are kept."
                  : "Select the fields to fill. Existing information is kept unless you choose to replace it."}
              </p>
            </div>
            {result.warnings.map((w) => (
              <p className="muted" key={w}>
                {w}
              </p>
            ))}
            <div className="resume-review-fields">
              {(Object.keys(labels) as (keyof ResumeFields)[])
                .filter((key) => result.fields[key])
                .map((key) => (
                  <div className="resume-review-row" key={key}>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={!!chosen[key]}
                        onChange={(e) =>
                          setChosen({ ...chosen, [key]: e.target.checked })
                        }
                      />
                      <span>
                        {labels[key]}
                        {profile[key] && !overwrite && (
                          <small>Already filled · will be kept</small>
                        )}
                      </span>
                    </label>
                    <textarea
                      aria-label={`Extracted ${labels[key]}`}
                      rows={key === "bio" ? 4 : 2}
                      value={result.fields[key] || ""}
                      onChange={(e) =>
                        setResult({
                          ...result,
                          fields: { ...result.fields, [key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
            </div>
            {!!result.projects.length && (
              <div className="resume-project-review">
                <h4>Projects found in your résumé</h4>
                <p className="muted">
                  Selected projects will fill “Projects you’re proud of”.
                  Existing edits and ownership answers are kept.
                </p>
                {result.projects.map((project) => (
                  <article key={project.id}>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={!!chosenProjects[project.id]}
                        onChange={(e) =>
                          setChosenProjects({
                            ...chosenProjects,
                            [project.id]: e.target.checked,
                          })
                        }
                      />
                      <span>
                        <b>{project.name}</b>
                        <small>{project.stack || project.platform}</small>
                      </span>
                    </label>
                    <p>
                      {project.description.slice(0, 500) ||
                        "Add a short description after applying."}
                    </p>
                    <div className="project-evidence-links">
                      {project.url && (
                        <External href={project.url}>Project link</External>
                      )}
                      {project.githubUrl &&
                        project.githubUrl !== project.url && (
                          <External href={project.githubUrl}>GitHub</External>
                        )}
                      {project.websiteUrl &&
                        project.websiteUrl !== project.url && (
                          <External href={project.websiteUrl}>
                            Live website
                          </External>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!!Object.keys(result.fields).length && (
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <span>Replace existing information in selected fields</span>
              </label>
            )}
            <div className="resume-review-actions">
              <Button type="button" className="orange-button" onClick={apply}>
                {savedReview
                  ? "Add selected projects to my profile"
                  : "Apply details to my profile"}{" "}
                <ArrowUpRight size={14} />
              </Button>
              <Button type="button" variant="ghost" onClick={resetUpload}>
                Discard review
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
export function ProjectEditor({
  project: p,
  index,
  onChange,
  onRemove,
  removeControl,
  onProfileLink,
}: {
  project: Project;
  index: number;
  onChange: (p: Project) => void;
  onRemove: () => void;
  removeControl?: ReactNode;
  onProfileLink?: (url: string) => void;
}) {
  const [result, setResult] = useState<ProjectImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const change = (key: keyof Project, value: string) =>
    onChange({ ...p, [key]: value });
  async function importLink() {
    setLoading(true);
    setError("");
    setResult(null);
    setNotice("");
    try {
      setResult(
        await request<ProjectImport>("/api/project", {
          method: "POST",
          body: JSON.stringify({ url: p.url }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="project-editor">
      <div className="project-editor-heading">
        <span>PROJECT {String(index + 1).padStart(2, "0")}</span>
        {removeControl || (
          <button
            type="button"
            aria-label={`Remove project ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <Field
        label="Project link"
        hint="GitHub, Devfolio, ETHGlobal, Devpost, or a public project website."
      >
        <input
          type="url"
          value={p.url}
          onChange={(e) => {
            change("url", e.target.value);
            setResult(null);
          }}
          placeholder="https://ethglobal.com/showcase/…"
        />
      </Field>
      <div className="project-import-action">
        <Button
          type="button"
          variant="outline"
          disabled={!p.url || loading}
          onClick={importLink}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          {loading ? "Finding the project…" : "Fetch project details"}
        </Button>
        <small className="muted">
          We look for the project’s GitHub link too.
        </small>
      </div>
      {error && (
        <p role="alert" className="status-message error">
          {error}
        </p>
      )}
      {result && (
        <div className="import-review">
          <span className="tiny-kicker">
            FOUND ON {result.project.platform.toUpperCase()}
          </span>
          <h3>{result.project.name || "Project details"}</h3>
          <p className="project-context-preview">
            {result.project.description.slice(0, 1600) ||
              "Add a project description after importing."}
          </p>
          {!!result.githubCandidates.length && (
            <Field label="Linked GitHub repository">
              <WorkspaceSelect
                label="Linked GitHub repository"
                value={result.project.githubUrl || ""}
                onValueChange={(value) =>
                  setResult({
                    ...result,
                    project: { ...result.project, githubUrl: value },
                  })
                }
                options={[
                  { value: "", label: "Choose / skip this link" },
                  ...result.githubCandidates.map((value) => ({
                    value,
                    label: value.replace("https://github.com/", ""),
                  })),
                ]}
              />
            </Field>
          )}
          {!result.githubCandidates.length && (
            <p className="muted">
              No GitHub repository found on this page. You can add it below.
            </p>
          )}
          {result.warnings.map((w) => (
            <p className="muted" key={w}>
              {w}
            </p>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange({
                ...p,
                ...result.project,
                repositoryCandidates: result.githubCandidates,
                importedAt: result.checkedAt,
              });
              if (result.profileLinks?.devfolio)
                onProfileLink?.(result.profileLinks.devfolio);
              setResult(null);
              setNotice(
                "Project details added. Review them, then tell us whether you built it solo or with a team.",
              );
            }}
          >
            Use project details <ArrowUpRight size={14} />
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="import-notice">
          {notice}
        </p>
      )}
      <div className="form-grid">
        <Field label="Project name">
          <input
            required
            value={p.name}
            onChange={(e) => change("name", e.target.value)}
            placeholder="What did you build?"
          />
        </Field>
        <Field label="Built at">
          <WorkspaceSelect
            label="Built at"
            value={p.platform}
            onValueChange={(value) => change("platform", value)}
            options={[
              "GitHub",
              "Devpost",
              "Devfolio",
              "ETHGlobal",
              "Personal",
              "Work",
            ].map((value) => ({ value, label: value }))}
          />
        </Field>
      </div>
      <Field
        label="What the project does"
        hint="Project context. Keep this separate from the part you personally built."
      >
        <textarea
          rows={4}
          value={p.description}
          onChange={(e) => change("description", e.target.value)}
          placeholder="What problem does it solve, and how does it work?"
        />
      </Field>
      <div className="form-grid">
        <Field label="Live website">
          <input
            type="url"
            value={p.websiteUrl || ""}
            onChange={(e) => change("websiteUrl", e.target.value)}
            placeholder="https://your-project.com"
          />
        </Field>
        {!!p.repositoryCandidates?.length && (
          <Field
            label="GitHub links found on the project page"
            hint="Choose the main repository. Other links may be supporting code or dependencies."
          >
            <WorkspaceSelect
              label="Project repository"
              value={p.githubUrl || ""}
              onValueChange={(value) => change("githubUrl", value)}
              options={[
                { value: "", label: "Choose a repository / keep unset" },
                ...[
                  ...new Set(
                    [...(p.repositoryCandidates || []), p.githubUrl].filter(
                      (url): url is string => !!url,
                    ),
                  ),
                ].map((value) => ({
                  value,
                  label: value.replace("https://github.com/", ""),
                })),
              ]}
            />
            <div className="project-evidence-links">
              {p.repositoryCandidates.map((url) => (
                <External key={url} href={url}>
                  {url.replace("https://github.com/", "")}
                </External>
              ))}
            </div>
          </Field>
        )}
        <Field label="GitHub repository">
          <input
            type="url"
            value={p.githubUrl || ""}
            onChange={(e) => change("githubUrl", e.target.value)}
            placeholder="https://github.com/owner/project"
          />
        </Field>
        <Field label="Stack">
          <input
            value={p.stack}
            onChange={(e) => change("stack", e.target.value)}
            placeholder="Bun, Next.js, Solidity…"
          />
        </Field>
      </div>
      <fieldset className="ownership-field">
        <legend>Did you build this on your own or with a team?</legend>
        <div className="ownership-options">
          {(
            [
              ["solo", "On my own"],
              ["team", "With a team"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={p.buildMode === value ? "selected" : ""}
            >
              <input
                type="radio"
                name={`ownership-${p.id}`}
                value={value}
                checked={p.buildMode === value}
                onChange={() =>
                  onChange({
                    ...p,
                    buildMode: value,
                    contribution: value === "solo" ? "" : p.contribution,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {p.buildMode === "team" && (
        <Field
          label="What did you personally build?"
          hint="A few simple sentences are enough. We use this when talking about your work."
        >
          <textarea
            required
            rows={4}
            value={p.contribution || ""}
            onChange={(e) => change("contribution", e.target.value)}
            placeholder="I built the Next.js frontend, connected it to the contracts, and handled deployment. My teammates worked on the contracts and design."
          />
        </Field>
      )}
      {p.buildMode && (
        <details className="story-preview">
          <summary>How this reads in your story</summary>
          <p>{projectStory(p)}</p>
        </details>
      )}
    </div>
  );
}
