import { github, type Repo } from "@/lib/github";
export async function GET(request: Request) {
  const username =
    new URL(request.url).searchParams
      .get("username")
      ?.replace(/^https:\/\/github.com\//, "")
      .replace(/\/$/, "") || "";
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(username))
    return Response.json(
      { error: "Enter a valid GitHub username." },
      { status: 400 },
    );
  try {
    const [user, repos] = await Promise.all([
      github<{
        login: string;
        name: string;
        avatar_url: string;
        html_url: string;
      }>(`users/${username}`),
      github<Repo[]>(`users/${username}/repos?sort=pushed&per_page=30`),
    ]);
    return Response.json({
      user,
      repos: repos.filter((r) => !r.archived).slice(0, 12),
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
