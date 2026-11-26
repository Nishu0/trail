import { Dashboard } from "@/components/dashboard";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  // old urls (overview, applications, outreach, connections) map to the new pages.
  const first = section[0] ?? "";
  const view =
    first === "" || first === "overview"
      ? "dashboard"
      : ["applications", "outreach"].includes(first)
        ? "pipeline"
        : first === "connections"
          ? "settings"
          : first === "profile" && section[1] === "edit"
            ? "profile-edit"
            : first;
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
