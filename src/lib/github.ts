export async function github<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Trail-job-workspace",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "GitHub rate limit reached. Add GITHUB_TOKEN or try again later."
        : `GitHub returned ${response.status}. Check the username or repository.`,
    );
  return response.json();
}
export type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
};
export type Pull = {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  user: { login: string };
  body: string | null;
};
export type Issue = {
  number: number;
  title: string;
  html_url: string;
  labels: { name: string }[];
  pull_request?: unknown;
  assignee?: unknown;
};
