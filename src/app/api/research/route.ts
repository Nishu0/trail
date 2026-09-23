import { github, type Pull, type Issue, type Repo } from "@/lib/github";
export async function GET(request: Request) {
  const repo =
    new URL(request.url).searchParams
      .get("repo")
      ?.replace(/^https:\/\/github.com\//, "")
      .replace(/\/$/, "") || "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
    return Response.json({ error: "Use owner/repository." }, { status: 400 });
  try {
    const [info, closed, issues, tree, contributors] = await Promise.all([
      github<Repo & { default_branch: string }>(`repos/${repo}`),
      github<Pull[]>(
        `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=60`,
      ),
      github<Issue[]>(`repos/${repo}/issues?state=open&per_page=30`),
      github<{ tree: { path: string; type: string }[]; truncated: boolean }>(
        `repos/${repo}/git/trees/HEAD?recursive=1`,
      ),
      github<{ login: string; html_url: string; avatar_url: string }[]>(
        `repos/${repo}/contributors?per_page=6`,
      ).catch(() => []),
    ]);
    const files = tree.tree
      .filter(
        (f) =>
          f.type === "blob" &&
          (/^(CONTRIBUTING|VOUCH|CODE_OF_CONDUCT)/i.test(f.path) ||
            /^\.github\/(CONTRIBUTING|PULL_REQUEST_TEMPLATE|workflows\/|.*vouch)/i.test(
              f.path,
            )),
      )
      .sort((a, b) => {
        const priority = (p: string) =>
          /^(CONTRIBUTING|VOUCH|CODE_OF_CONDUCT)/i.test(p)
            ? 0
            : /vouch|PULL_REQUEST_TEMPLATE/i.test(p)
              ? 1
              : 2;
        return priority(a.path) - priority(b.path);
      })
      .slice(0, 35);
    const rules = await Promise.all(
      files.map(async (f) => {
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/${repo}/${info.default_branch}/${f.path}`,
            { signal: AbortSignal.timeout(12000), cache: "no-store" },
          );
          if (!response.ok) throw new Error("File unavailable");
          return {
            path: f.path,
            url: `https://github.com/${repo}/blob/${info.default_branch}/${f.path}`,
            text: (await response.text()).slice(0, 24000),
          };
        } catch {
          return {
            path: f.path,
            url: `https://github.com/${repo}/blob/${info.default_branch}/${f.path}`,
            text: "Could not read this file. Open the source to review it.",
          };
        }
      }),
    );
    const vouch = rules.some((r) =>
      /\bvouch(?:ed|ing)?\b|trusted.contributor|approved.contributor/i.test(
        r.text,
      ),
    );
    return Response.json({
      repo: info,
      checkedAt: new Date().toISOString(),
      rules,
      vouch,
      contributors,
      treeTruncated: tree.truncated,
      merged: closed
        .filter((p) => p.merged_at)
        .slice(0, 8)
        .map((p) => ({
          number: p.number,
          title: p.title,
          url: p.html_url,
          author: p.user.login,
          mergedAt: p.merged_at,
        })),
      issues: issues
        .filter((i) => !i.pull_request)
        .slice(0, 12)
        .map((i) => ({
          number: i.number,
          title: i.title,
          url: i.html_url,
          labels: i.labels.map((l) => l.name),
          assigned: Boolean(i.assignee),
          tested: false,
        })),
      caution:
        "Research only. Read the linked rules and actual PR reviews. Listed issues have not been reproduced or tested; eligibility and maintainer intent require manual confirmation.",
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
