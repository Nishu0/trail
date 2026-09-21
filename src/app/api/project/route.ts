import { z } from "zod";
import { checkOrigin, getWorkspace } from "@/lib/store";
import { importProject } from "@/lib/project-import";
import { findDevfolioProfile } from "@/lib/project-profile";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { url } = z
      .object({ url: z.url().max(2000) })
      .parse(await request.json());
    const result = await importProject(url, { signal: request.signal });
    if (result.devfolioProfiles?.length) {
      const { profile } = await getWorkspace();
      if (!profile.devfolio) {
        const devfolio = await findDevfolioProfile(
          result.devfolioProfiles,
          profile,
          { signal: request.signal },
        );
        if (devfolio) result.profileLinks = { devfolio };
      }
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
