import mammoth from "mammoth";
import { extractLinks, getDocumentProxy } from "unpdf";
import type { Profile } from "./model";
import type { Project } from "./model";
import { load } from "cheerio";
import { resumeHeading as headings, resumeLines } from "./resume-layout";
export type ResumeFields = Pick<
  Profile,
  | "name"
  | "headline"
  | "bio"
  | "skills"
  | "location"
  | "github"
  | "devpost"
  | "devfolio"
>;
export type ResumeImport = {
  resumeId?: string;
  fields: Partial<ResumeFields>;
  text: string;
  filename: string;
  warnings: string[];
  mode: string;
  projectLinks: string[];
  projects: Project[];
};
// Preflight the ZIP directory before DOCX decompression.
export function checkDocxSize(buffer: Buffer) {
  let entries = 0,
    expanded = 0;
  for (let i = 0; i + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    expanded += buffer.readUInt32LE(i + 24);
    entries++;
    const extra =
      buffer.readUInt16LE(i + 28) +
      buffer.readUInt16LE(i + 30) +
      buffer.readUInt16LE(i + 32);
    i += 45 + extra;
  }
  if (!entries || entries > 500 || expanded > 12 * 1024 * 1024)
    throw new Error(
      "This DOCX is too large or not a supported document. Export your résumé as PDF or TXT.",
    );
}
export async function resumeText(buffer: Buffer, filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf" && buffer.subarray(0, 5).toString() === "%PDF-") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
      if (pdf.numPages > 20)
        throw new Error("Upload a résumé with 20 pages or fewer.");
      const pageTexts: string[] = [];
      const { links } = await extractLinks(pdf);
      const contexts: string[] = [];
      // Preserve where a clickable PDF link appeared, not just an unordered URL list.
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items.filter(
          (item): item is Extract<typeof item, { str: string }> =>
            "str" in item,
        );
        let pageText = "";
        let previousY: number | undefined;
        for (const item of items) {
          const y = item.transform[5];
          if (
            previousY !== undefined &&
            Math.abs(previousY - y) > 3 &&
            !pageText.endsWith("\n")
          )
            pageText += "\n";
          pageText += item.str + (item.hasEOL ? "\n" : " ");
          previousY = y;
        }
        pageTexts.push(pageText);
        for (const annotation of await page.getAnnotations()) {
          const url = annotation.url;
          const rect = annotation.rect;
          if (!url || !/^https?:\/\//.test(url) || !rect) continue;
          const y = (rect[1] + rect[3]) / 2;
          const nearby = items
            .filter(
              (item) =>
                item.transform[5] >= y - 3 && item.transform[5] <= y + 90,
            )
            .sort(
              (a, b) =>
                b.transform[5] - a.transform[5] ||
                a.transform[4] - b.transform[4],
            )
            .map((item) => item.str)
            .join(" ")
            .slice(-900);
          contexts.push(`Hyperlink context: ${nearby}\nLink: ${url}`);
        }
      }
      return [
        pageTexts.join("\n"),
        ...links.filter((link) => /^https?:\/\//.test(link)),
        ...contexts,
      ].join("\n");
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
  if (extension === "docx" && buffer.subarray(0, 2).toString() === "PK") {
    checkDocxSize(buffer);
    const html = (await mammoth.convertToHtml({ buffer })).value;
    const $ = load(html);
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      if (/^https?:\/\//.test(href)) $(el).append(` [${href}]`);
    });
    $("p,li,h1,h2,h3,br").append("\n");
    return $("body").text();
  }
  if (extension === "txt" && !buffer.includes(0))
    return buffer.toString("utf8");
  throw new Error(
    "Choose a PDF, DOCX, or plain-text résumé. The file contents must match its extension.",
  );
}
export function parseResume(
  text: string,
): Pick<ResumeImport, "fields" | "projectLinks"> {
  const lines = resumeLines(text);
  const first = lines.find(
    (l) =>
      l.length < 80 &&
      !/resume|résumé|curriculum vitae|https?:|@|\d{5}/i.test(l) &&
      !headings.test(l),
  );
  const fields: Partial<ResumeFields> = {};
  if (first && first.split(/\s+/).length <= 6)
    fields.name = first.replace(/^name\s*:\s*/i, "");
  const headline = lines
    .slice(0, 8)
    .find(
      (l) =>
        /\b(engineer|developer|designer|builder|student|researcher|architect)\b/i.test(
          l,
        ) &&
        !/@|https?:/i.test(l) &&
        l.length < 180 &&
        l !== first,
    );
  if (headline) fields.headline = headline;
  const section = (label: RegExp) => {
    const start = lines.findIndex((l) => label.test(l));
    if (start < 0) return "";
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => headings.test(l));
    return (end < 0 ? rest : rest.slice(0, end)).join("\n").slice(0, 6000);
  };
  fields.bio =
    section(/^(summary|profile|about)\s*:?$/i) ||
    section(/^(experience|work experience|professional experience)\s*:?$/i);
  const declared = section(/^(skills|technical skills)\s*:?$/i);
  const labelled = lines
    .filter((line) =>
      /^(?:languages|frameworks|libraries|databases|tools|technologies|tech stack|stack|cloud|platforms)\s*:/i.test(
        line,
      ),
    )
    .map((line) => line.replace(/^[^:]+:\s*/, ""));
  fields.skills = (declared || [...new Set(labelled)].join(", ")).replace(
    /\n/g,
    ", ",
  );
  fields.location =
    lines
      .find((l) => /^location\s*:/i.test(l))
      ?.replace(/^location\s*:\s*/i, "") || "";
  const urls = [
    ...new Set(
      (
        text.match(
          /(?:https?:\/\/)?(?:www\.)?(?:github\.com|devpost\.com|devfolio\.co|ethglobal\.com)\/[^\s<>"'\]]+/gi,
        ) || []
      ).map((s) =>
        (s.startsWith("http") ? s : `https://${s}`).replace(/[),.;]+$/, ""),
      ),
    ),
  ];
  const github = urls.find((u) => /github\.com\/[^/]+\/?$/.test(u));
  if (github) fields.github = new URL(github).pathname.split("/")[1];
  for (const key of ["devpost", "devfolio"] as const) {
    const url = urls.find(
      (u) =>
        new URL(u).hostname.includes(key) &&
        !/\/(projects?|software)\//.test(new URL(u).pathname) &&
        !/\/showcase\//.test(new URL(u).pathname),
    );
    if (url) fields[key] = url;
  }
  return {
    fields,
    projectLinks: urls
      .filter((u) =>
        /github\.com\/[^/]+\/[^/]+|\/(projects?|showcase|software)\//.test(u),
      )
      .slice(0, 40),
  };
}
