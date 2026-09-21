import { load } from "cheerio";
import { fetchProjectPage, type ProjectImport } from "./project-import";

type Identity = { name?: string; github?: string };
const nameKey = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Contributor links are evidence, not ownership. Never choose the first teammate.
export async function findDevfolioProfile(
  candidates: NonNullable<ProjectImport["devfolioProfiles"]>,
  identity: Identity,
  options: { signal?: AbortSignal; readPage?: typeof fetchProjectPage } = {},
) {
  const unique = [
    ...new Map(
      candidates
        .filter((candidate) =>
          /^https:\/\/devfolio\.co\/@[a-z0-9_-]+$/i.test(candidate.url),
        )
        .map((candidate) => [candidate.url.toLowerCase(), candidate]),
    ).values(),
  ];
  const name = nameKey(identity.name || "");
  const nameMatches =
    name.length >= 4
      ? unique.filter((candidate) => nameKey(candidate.name) === name)
      : [];
  if (nameMatches.length === 1) return nameMatches[0].url;
  if (!identity.github || !/^[a-z0-9-]{1,39}$/i.test(identity.github))
    return "";
  const matches: string[] = [];
  await Promise.all(
    unique.slice(0, 6).map(async (candidate) => {
      try {
        const $ = load(
          await (options.readPage || fetchProjectPage)(
            candidate.url,
            0,
            options.signal
              ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)])
              : AbortSignal.timeout(8000),
          ),
        );
        const ownsGitHub = $("a[href]")
          .toArray()
          .some((element) => {
            try {
              const link = new URL($(element).attr("href") || "");
              return (
                link.protocol === "https:" &&
                link.hostname === "github.com" &&
                link.pathname.replace(/^\/|\/$/g, "").toLowerCase() ===
                  identity.github!.toLowerCase()
              );
            } catch {
              return false;
            }
          });
        if (ownsGitHub) matches.push(candidate.url);
      } catch {
        options.signal?.throwIfAborted();
      }
    }),
  );
  return matches.length === 1 ? matches[0] : "";
}
