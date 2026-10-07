import { load } from "cheerio";
import { projectURL } from "./project-import";
import { fetchPublicResource } from "./public-resource";

export function brandLink(value: unknown, source: string) {
  const raw =
    typeof value === "object" && value
      ? (value as { url?: string }).url
      : value;
  if (typeof raw !== "string" || !raw) return "";
  try {
    return projectURL(new URL(raw, source).href).href;
  } catch {
    return "";
  }
}
export function websiteBrand(html: string, source: string) {
  const $ = load(html);
  let logo = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    const visit = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(visit);
      if (!v || typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      if (/Organization|Corporation/.test(String(o["@type"])))
        logo ||= brandLink(o.logo, source);
      if (o["@graph"]) visit(o["@graph"]);
    };
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      /* malformed metadata */
    }
  });
  // A brand-marked image is preferable to a social-preview/hero image.
  const marked = $(
    'img[alt*="logo" i], img[class*="logo" i], img[id*="logo" i]',
  ).first();
  logo ||= brandLink(marked.attr("src"), source);
  logo ||= brandLink($('link[rel="apple-touch-icon"]').attr("href"), source);
  logo ||= brandLink($('link[rel~="icon"]').attr("href"), source);
  return logo ? { logoUrl: logo, logoSource: source } : {};
}
export async function findWebsiteBrand(website: string, signal?: AbortSignal) {
  try {
    const page = await fetchPublicResource(website, signal);
    if (page.status !== 200) return {};
    const brand = websiteBrand(page.body.toString("utf8"), page.url);
    if (brand.logoUrl) return brand;
    const icon = new URL("/favicon.ico", page.url).href;
    const response = await fetchPublicResource(icon, signal, true);
    return response.status === 200 && response.body.length
      ? { logoUrl: icon, logoSource: page.url }
      : {};
  } catch {
    return {};
  }
}
