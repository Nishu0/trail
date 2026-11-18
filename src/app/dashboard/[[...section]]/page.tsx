import { Dashboard } from "@/components/dashboard";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  // Applications and Outreach were merged into Pipeline; keep old links working.
  const view = ["applications", "outreach"].includes(section[0] ?? "")
    ? "pipeline"
    : section[0] || "overview";
  return (
    <Dashboard
      view={view}
      linkedinResearch={section[0] === "linkedin" && section[1] === "research"}
      companyId={
        section[0] === "companies" && section[1] !== "opportunities"
          ? section[1]
          : undefined
      }
      opportunityId={
        section[0] === "companies" && section[1] === "opportunities"
          ? section[2]
          : undefined
      }
      projectId={
        section[0] === "profile" && section[1] === "projects"
          ? section[2]
          : undefined
      }
    />
  );
}
