export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    storage: "postgresql",
    resumeAI: Boolean(process.env.ANTHROPIC_API_KEY),
    resumeModel: "claude-haiku-5-5",
    aiWriting: Boolean(process.env.AI_GATEWAY_API_KEY),
    githubToken: Boolean(process.env.GITHUB_TOKEN),
    ycPublic: true,
    xAutomation: false,
    xSearch: true,
    exaResearch: Boolean(process.env.EXA_API_KEY),
    linkedinSearch: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    linkedinAutomation: false,
    mailbox: false,
  });
}
