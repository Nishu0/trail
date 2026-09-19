import { Dashboard } from "@/components/dashboard";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  return (
    <Dashboard
      view={section[0] || "overview"}
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
