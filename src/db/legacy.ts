import type { Workspace } from "../lib/model";
// SQL adds document identities and normalizes absent optional fields. Every user fact must match.
export function sameLegacyFacts(a: Workspace, b: Workspace) {
  function comparable(w: Workspace) {
    const copy = structuredClone(w);
    if (copy.profile.resume) {
      delete copy.profile.resume.id;
      delete copy.profile.resume.fileStored;
    }
    return JSON.parse(
      JSON.stringify(copy, (_key, value) =>
        value === "" || value === false ? undefined : value,
      ),
    );
  }
  function sorted(v: unknown): unknown {
    return Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, sorted(value)]),
          )
        : v;
  }
  return (
    JSON.stringify(sorted(comparable(a))) ===
    JSON.stringify(sorted(comparable(b)))
  );
}
