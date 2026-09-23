import { z } from "zod";
import { checkOrigin, getWorkspace } from "@/lib/store";
import { searchCompany, companyWebsiteCandidates } from "@/lib/company-search";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { jobId } = z
      .object({ jobId: z.string().min(1).max(200) })
      .parse(await request.json());
    const workspace = await getWorkspace();
    const job = workspace.jobs.find((job) => job.id === jobId);
    if (!job)
      return Response.json(
        { error: "Opportunity not found." },
        { status: 404 },
      );
    const result = await searchCompany(
      "exa-company",
      `${job.company} official company website. Find the employer's own website, not a job board or article.`,
      job.company,
      { fresh: true, signal: request.signal },
    );
    return Response.json({
      ...result,
      results: companyWebsiteCandidates(result.results, job.company),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
