"use client";
import { ArrowUpRight, Plus, Compass, Building2 } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "./workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-content">
        <DialogHeader className="modal-header">
          <DialogTitle className="modal-title">{title}</DialogTitle>
          <DialogDescription className="modal-description">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Compass size={27} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`external-link ${className}`}
      href={/^https?:\/\//.test(href) ? href : "#"}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function CompanyIcon({
  name,
  color,
  large = false,
  logoUrl,
}: {
  name: string;
  color?: string;
  large?: boolean;
  logoUrl?: string;
}) {
  const { data } = useWorkspace();
  const [failed, setFailed] = useState("");
  const source =
    logoUrl ||
    data?.companies.find((c) => c.name.toLowerCase() === name.toLowerCase())
      ?.logoUrl ||
    data?.jobs.find(
      (j) => j.company.toLowerCase() === name.toLowerCase() && j.logoUrl,
    )?.logoUrl;
  return (
    <span
      className={`company-icon${large ? " large" : ""}`}
      style={{
        background: source && source !== failed ? "#fff" : color || "#f1f2ee",
      }}
      aria-label={`${name}${source && source !== failed ? " logo" : " company"}`}
    >
      {source && source !== failed ? (
        <img
          src={`/api/brand?url=${encodeURIComponent(source)}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(source)}
        />
      ) : (
        <Building2 size={large ? 25 : 18} aria-hidden="true" />
      )}
    </span>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Plus size={15} />
      {children}
    </Button>
  );
}
export function localDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}
