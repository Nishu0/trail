import { z } from "zod";
import { checkOrigin, record, updateWorkspace } from "@/lib/store";
import { importCompany } from "@/lib/company-import";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { url, jobId } = z
      .object({ url: z.url(), jobId: z.string().max(200).optional() })
      .parse(await request.json());
    const { company, source } = await importCompany(url, request.signal);
    let id = "";
    const workspace = await updateWorkspace((w) => {
      if (jobId && !w.jobs.some((job) => job.id === jobId))
        throw new Error("Opportunity not found.");
      const existing = w.companies.find(
        (x) =>
          x.name.toLowerCase() === company.name.toLowerCase() ||
          (x.website &&
            company.website &&
            new URL(x.website).hostname.replace(/^www\./, "") ===
              new URL(company.website).hostname.replace(/^www\./, "")),
      );
      if (existing) {
        id = existing.id;
        if (company.description) existing.description = company.description;
        if (company.website) existing.website = company.website;
        if (company.logoUrl) {
          existing.logoUrl = company.logoUrl;
          existing.logoSource = company.logoSource;
        }
        existing.repo = existing.repo || company.repo;
        const lines = new Set(existing.notes.split("\n").filter(Boolean));
        for (const line of company.notes.split("\n").filter(Boolean))
          lines.add(line);
        existing.notes = [...lines].join("\n").slice(-20000);
        for (const p of company.people)
          if (!existing.people.some((x) => x.name === p.name))
            existing.people.push(p);
      } else {
        id = crypto.randomUUID();
        w.companies.push({ ...company, id });
      }
      if (jobId) w.jobs.find((job) => job.id === jobId)!.companyId = id;
      record(w, `Researched ${company.name} from its live source`);
    });
    return Response.json({
      workspace,
      companyId: id,
      source,
      people: company.people.length,
    });
  } catch (e) {
    const detail = (e as Error).message;
    const error =
      /getaddrinfo|ENOTFOUND|ECONNREFUSED|fetch failed|timed out/i.test(detail)
        ? "This company website couldn’t be reached. Try another official link or research it later."
        : detail;
    return Response.json({ error }, { status: 400 });
  }
}
