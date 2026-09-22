"use client";

import { useEffect, useState } from "react";
import { Check, FileText, LoaderCircle, Sparkles } from "lucide-react";
import type { ResumeStage } from "@/lib/resume-progress";

export function ResumeProcessing({
  stage,
  filename,
  useAI,
  onCancel,
}: {
  stage: ResumeStage | "uploading";
  filename: string;
  useAI: boolean;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const steps = [
    {
      id: "reading",
      title: "Read your résumé",
      detail: "Finding the text in your document",
    },
    {
      id: "matching",
      title: "Match your information",
      detail: useAI
        ? "Claude is organizing your experience and skills"
        : "Organizing your experience and skills",
    },
    {
      id: "projects",
      title: "Follow your projects",
      detail: "Reading project links and finding websites and repositories",
    },
    {
      id: "preparing",
      title: "Make it yours",
      detail: "Preparing editable fields for your review",
    },
  ];
  const current =
    stage === "uploading" ? 0 : steps.findIndex((step) => step.id === stage);
  const title =
    stage === "uploading"
      ? "Bringing your résumé in…"
      : stage === "reading"
        ? "A little context goes a long way."
        : stage === "matching"
          ? "Connecting the dots in your story."
          : "Getting everything ready for you.";

  return (
    <div className="resume-processing" aria-label="Résumé processing">
      <div className="resume-processing-top">
        <span className="resume-processing-badge">
          <Sparkles size={12} aria-hidden="true" />{" "}
          {useAI ? "CLAUDE / RÉSUMÉ AUTOFILL" : "YOUR RÉSUMÉ / AUTOFILL"}
        </span>
        <span className="resume-processing-live">
          <i aria-hidden="true" /> In progress
        </span>
      </div>
      <div className="resume-processing-intro">
        <div className="resume-document" aria-hidden="true">
          <FileText size={30} strokeWidth={1.3} />
          <span />
        </div>
        <div>
          <h3 role="status" aria-live="polite" aria-atomic="true">
            {title}
          </h3>
          <p>Turning what you’ve done into a profile you can make your own.</p>
          <span className="resume-processing-file" title={filename}>
            {filename}
          </span>
        </div>
      </div>
      <ol className="resume-processing-steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={
              index < current
                ? "done"
                : index === current
                  ? "active"
                  : "waiting"
            }
            aria-current={index === current ? "step" : undefined}
          >
            <span className="resume-step-icon" aria-hidden="true">
              {index < current ? (
                <Check size={14} />
              ) : index === current ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <div>
              <b>{step.title}</b>
              <small>{step.detail}</small>
            </div>
            <span className="resume-step-state">
              {index < current
                ? "Done"
                : index === current
                  ? "Working"
                  : "Up next"}
            </span>
          </li>
        ))}
      </ol>
      <div className="resume-processing-bottom">
        <p>
          {elapsed >= 15
            ? "Still working. Longer résumés can take a little more time."
            : "You’ll review every detail before it fills your profile."}
        </p>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
