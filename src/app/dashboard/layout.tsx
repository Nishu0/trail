import { WorkspaceProvider } from "@/components/workspace";
import { AppShell } from "@/components/app-shell";
import type { ReactNode } from "react";

// the shell lives here so the sidebar stays mounted between pages.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
