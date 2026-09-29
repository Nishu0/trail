import { z } from "zod";
import { boundedBytes } from "@/lib/import-utils";
import { checkOrigin, getWorkspace } from "@/lib/store";
import { findCompanies } from "@/lib/company-finder";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { query } = z
      .object({ query: z.string().max(500).default("") })
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedBytes(request.body, 4096)),
        ),
      );
    const { profile, employerExclusions } = await getWorkspace();
    const result = await findCompanies(profile, query, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(35000)]),
      excludedEmployers: employerExclusions,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
