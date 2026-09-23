import { z } from "zod";
import { checkOrigin, getWorkspace } from "@/lib/store";
import { searchCompany } from "@/lib/company-search";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { companyId, provider, query } = z
      .object({
        companyId: z.string().max(200),
        provider: z.enum([
          "exa-company",
          "exa-people",
          "x-users",
          "x-posts",
          "linkedin",
        ]),
        query: z.string().trim().min(2).max(300),
      })
      .parse(await request.json());
    const workspace = await getWorkspace();
    const company = workspace.companies.find((c) => c.id === companyId);
    if (!company) throw new Error("Choose a saved company to research.");
    return Response.json(await searchCompany(provider, query, company.name));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
