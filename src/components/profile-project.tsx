"use client";
import { useState } from "react";
import { ArrowLeft, Check, Trash2, Link2, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { ProjectEditor } from "./profile-imports";
import { Empty, External } from "./shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { request, useWorkspace } from "./workspace";
import type { Profile, Project, Workspace } from "@/lib/model";

export function newProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "",
    platform: "Personal",
    url: "",
    description: "",
    stack: "",
    buildMode: "",
  };
}

export function ProfileProjectDetail({
  project,
  profile,
  onProfileChange,
  onBack,
}: {
  project?: Project;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  onBack: () => void;
}) {
  const { data, run, replace, busy, setMessage } = useWorkspace();
  const [remove, setRemove] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [draft, setDraft] = useState<Project>(() => project || newProject());
  const [devfolio, setDevfolio] = useState(profile.devfolio);
  if (!project)
    return (
      <Empty
        title="Project not found"
        text="Choose a project from your story, or add a new one."
        action={
          <Button onClick={onBack}>
            <ArrowLeft size={15} /> Back to your story
          </Button>
        }
      />
    );
  function change(updated: Project) {
    setDraft(updated);
    onProfileChange({
      ...profile,
      projects: profile.projects.some((p) => p.id === updated.id)
        ? profile.projects.map((p) => (p.id === updated.id ? updated : p))
        : [...profile.projects, updated],
    });
  }
  async function save() {
    await run(async () => {
      const workspace = await request<Workspace>("/api/workspace", {
        method: "PATCH",
        body: JSON.stringify({ action: "project", project: draft, devfolio }),
      });
      replace(workspace);
      onProfileChange({
        ...profile,
        devfolio: profile.devfolio || workspace.profile.devfolio,
        projects: profile.projects.some((p) => p.id === draft.id)
          ? profile.projects.map((p) => (p.id === draft.id ? draft : p))
          : [...profile.projects, draft],
      });
      setMessage(`${draft.name} is saved.`);
      onBack();
    });
  }
  async function deleteProject() {
    setRemoveError("");
    await run(async () => {
      try {
        if (data?.profile.projects.some((p) => p.id === draft.id)) {
          replace(
            await request<Workspace>("/api/workspace", {
              method: "PATCH",
              body: JSON.stringify({ action: "delete-project", id: draft.id }),
            }),
          );
        }
        onProfileChange({
          ...profile,
          projects: profile.projects.filter((p) => p.id !== draft.id),
        });
        setRemove(false);
        setMessage("Project removed.");
        onBack();
      } catch (error) {
        setRemoveError(
          error instanceof Error
            ? error.message
            : "Could not remove this project. Please try again.",
        );
        throw error;
      }
    });
  }
  return (
    <AlertDialog
      open={remove}
      onOpenChange={(open) => {
        if (!busy) {
          setRemove(open);
          setRemoveError("");
        }
      }}
    >
      <div className="project-detail-page">
        <button type="button" className="project-back-link" onClick={onBack}>
          <ArrowLeft size={16} /> All your projects
        </button>
        <form
          className="project-detail-layout"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <section className="panel project-detail-editor">
            <ProjectEditor
              project={draft}
              index={Math.max(
                0,
                profile.projects.findIndex((p) => p.id === draft.id),
              )}
              onChange={change}
              onRemove={() => setRemove(true)}
              removeControl={
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="project-remove-trigger"
                    disabled={busy}
                  >
                    <Trash2 size={15} /> Remove project
                  </Button>
                </AlertDialogTrigger>
              }
              onProfileLink={(url) => {
                if (!devfolio) setDevfolio(url);
              }}
            />
            <div className="sticky-save">
              <p>Keep the details in your own words.</p>
              <Button
                type="submit"
                className="orange-button"
                disabled={busy || !draft.name.trim()}
              >
                <Check size={15} />
                {busy ? "Saving…" : "Save project"}
              </Button>
            </div>
          </section>
          <aside className="panel project-detail-summary">
            <span className="tiny-kicker">YOUR PROJECT</span>
            <span
              className="project-monogram"
              data-tone={draft.platform.toLowerCase()}
            >
              {(draft.name || "P").slice(0, 2).toUpperCase()}
            </span>
            <h2>{draft.name || "Something worth sharing."}</h2>
            <p>{draft.description || "A little context goes a long way."}</p>
            {draft.stack && (
              <div className="tag-row">
                {draft.stack
                  .split(",")
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((skill) => (
                    <span key={skill.trim()}>{skill.trim()}</span>
                  ))}
              </div>
            )}
            {(draft.url || draft.githubUrl || draft.websiteUrl) && (
              <div className="project-detail-links">
                <span className="tiny-kicker">
                  <Link2 size={13} /> THE EVIDENCE
                </span>
                {draft.url && (
                  <External href={draft.url}>Project page</External>
                )}
                {draft.websiteUrl && draft.websiteUrl !== draft.url && (
                  <External href={draft.websiteUrl}>Live website</External>
                )}
                {draft.githubUrl && (
                  <External href={draft.githubUrl}>GitHub repository</External>
                )}
              </div>
            )}
          </aside>
        </form>
        <AlertDialogContent className="project-remove-dialog" aria-busy={busy}>
          <AlertDialogHeader className="project-remove-header">
            <span className="project-remove-symbol" aria-hidden="true">
              <Trash2 size={21} />
            </span>
            <AlertDialogTitle>Remove this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be removed from your builder story. You can add
              it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="project-remove-preview">
            <span
              className="project-monogram"
              data-tone={draft.platform.toLowerCase()}
              aria-hidden="true"
            >
              {(draft.name || "P").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{draft.name || "Untitled project"}</b>
              <span>{draft.platform} project</span>
            </div>
          </div>
          {removeError && (
            <p className="project-remove-error" role="alert">
              {removeError}
            </p>
          )}
          <AlertDialogFooter className="project-remove-footer">
            <AlertDialogCancel disabled={busy}>Keep project</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="project-remove-action"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void deleteProject();
              }}
            >
              {busy ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Trash2 size={15} />
              )}
              {busy ? "Removing…" : "Remove project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
}
