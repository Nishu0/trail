import type { EmployerExclusion } from "./model";
export function employerKey(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
export function isEmployerExcluded(
  name: string,
  url: string,
  exclusions: EmployerExclusion[] = [],
) {
  const identities = new Set([employerKey(name)]);
  let hostname = "";
  try {
    const source = new URL(url);
    hostname = source.hostname.toLowerCase().replace(/^www\./, "");
    if (/^(?:[a-z]{2,3}\.)?linkedin\.com$/.test(hostname)) {
      const company = /^\/company\/([^/]+)/.exec(source.pathname)?.[1];
      const publisher = /-at-([^/]+)-\d+\/?$/.exec(source.pathname)?.[1];
      if (company || publisher)
        identities.add(employerKey(decodeURIComponent(company || publisher!)));
    }
  } catch {
    /* Name matching still applies to records without a URL. */
  }
  return exclusions.some(
    (exclusion) =>
      [exclusion.key, exclusion.name, ...exclusion.aliases].some((alias) => {
        const key = employerKey(alias);
        return !!key && identities.has(key);
      }) ||
      exclusion.domains.some((domain) => {
        const host = domain
          .trim()
          .toLowerCase()
          .replace(/^www\./, "");
        return !!host && (hostname === host || hostname.endsWith(`.${host}`));
      }),
  );
}
