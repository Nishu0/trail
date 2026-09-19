"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import type { Workspace, Profile } from "@/lib/model";
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
type Context = {
  data: Workspace | null;
  now: Date;
  busy: boolean;
  message: string;
  error: string;
  setMessage: (s: string) => void;
  run: (task: () => Promise<void>) => Promise<void>;
  mutate: (action: unknown, message?: string) => Promise<void>;
  replace: (workspace: Workspace) => void;
  reload: () => void;
  profileDraft: Profile | null;
  setProfileDraft: Dispatch<SetStateAction<Profile | null>>;
};
const WorkspaceContext = createContext<Context | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null);
  // Keep unsaved form edits across dashboard routes. Durable data is still saved to PostgreSQL.
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    setMessage("");
    setError("");
  }, [pathname]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<Workspace>("/api/workspace", { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [refresh]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(action: unknown, note = "Saved to your workspace.") {
    await run(async () => {
      const saved = await request<Workspace>("/api/workspace", {
        method: "PATCH",
        body: JSON.stringify(action),
      });
      setData(saved);
      if (
        action &&
        typeof action === "object" &&
        "action" in action &&
        action.action === "profile"
      )
        setProfileDraft(saved.profile);
      setMessage(note);
    });
  }
  return (
    <WorkspaceContext.Provider
      value={{
        data,
        profileDraft,
        setProfileDraft,
        now,
        busy,
        message,
        error,
        setMessage,
        run,
        mutate,
        replace: setData,
        reload: () => setRefresh((r) => r + 1),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace provider is missing");
  return context;
}
