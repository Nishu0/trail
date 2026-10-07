import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { brandAssets } from "@/db/schema";
import { fetchPublicResource } from "@/lib/public-resource";
import { projectURL } from "@/lib/project-import";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = projectURL(
      new URL(request.url).searchParams.get("url") || "",
    ).href;
    if (url.length > 2048) throw new Error("Invalid brand URL.");
    const db = getDatabase();
    let asset = (
      await db.select().from(brandAssets).where(eq(brandAssets.url, url))
    )[0];
    if (!asset || Date.parse(asset.checkedAt) < Date.now() - 7 * 86400000) {
      const source = await fetchPublicResource(
        url,
        AbortSignal.timeout(16000),
        true,
      );
      if (source.status !== 200 || !source.body.length)
        throw new Error("Brand unavailable.");
      asset = {
        url,
        content: source.body,
        contentType: source.type,
        checkedAt: new Date().toISOString(),
      };
      await db
        .insert(brandAssets)
        .values(asset)
        .onConflictDoUpdate({ target: brandAssets.url, set: asset });
    }
    return new Response(new Uint8Array(asset.content), {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
