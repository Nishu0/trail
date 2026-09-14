# Trail

A personal job-search workspace built with Bun, Next.js App Router, React, shadcn/ui (reused from the Japan frontend), and Tailwind CSS. The landing page has an original pastoral print-style landscape, orange accents, and a scalloped oversized-wordmark footer. The dashboard follows Japan's sidebar, restrained panels, and visual hierarchy.

## Run

```sh
bun install
# Set DATABASE_URL in .env.local first.
bun run db:migrate
bun run db:import # one-time migration of an existing local workspace
bun run dev
```

Open http://127.0.0.1:3000. Start at **Your story** to add your own experience, skills, target roles, GitHub username, hackathon projects, and writing samples.

```sh
bun run build
bun run start
```

Bun handles package installation, development, scripts, and tests. Production Next.js uses Node through its CLI shebang: Bun 1.3.11 fails loading the compiled Next.js 16.3 production runtime. Both modes bind to localhost. No global runtime changes are required. This runtime issue is also documented in [Bun issue #36866](https://github.com/oven-sh/bun/issues/36866).

## Implemented

- Landing, brand guide, and responsive dashboard.
- Résumé upload (PDF, DOCX, TXT, up to 5 MB), local text extraction, editable field previews, Claude Haiku 5.5 autofill (enabled by default when configured), and automatic project cards with descriptions, stacks, live websites and linked GitHub repositories. PDF extraction preserves text lines and clickable link context; skill extraction has no fixed technology list. Claude and local projects are merged, and AI or website failures retain the document facts with warnings. Click “Find projects in saved résumé” to revisit an existing upload. Repeated imports fill missing details without replacing edits or solo/team attribution. Successful imports retain original files, extracted text, and field previews in PostgreSQL; applied details update the profile. Scanned PDFs need a text-based export.
- Project-link import from public GitHub, Devfolio, ETHGlobal, Devpost and HTTPS websites; linked GitHub repository discovery; solo/team ownership and explicit personal contributions. Public page content depends on the source, and login-only or script-only pages may require manual details.
- Persistent personal profile and project evidence for GitHub, Devpost, Devfolio, and ETHGlobal.
- Live opportunity discovery across YC, X hiring posts and Brave-indexed LinkedIn job pages, driven by supplied skills/target roles. Each source reports availability, checked/matched/imported counts and check time. Source links, deduplication, keyword evidence, source/remote filters and fit sorting are included. Workspace employer exclusions persist in PostgreSQL and filter both job and company recommendations by exact normalized names, LinkedIn publisher aliases and owned domains. They also guard job imports against rediscovery. Location, current availability and eligibility must be checked at the source.
- Public X profile and live-post search through x.pcstyle.dev in company notebooks and opportunity discovery; keyless limits apply. Manual job-lead intake is also available.
- Exa company/people research and Brave-indexed public LinkedIn profile discovery, source excerpts and reviewed person intake. Search results are candidates, not confirmed employment.
- Saved / Applied / Interview / Offer / Archived pipeline, email/X/job-form channels, notes, dated follow-ups, in-app reminders, and snoozing.
- Draft creation, editing, copying, and .eml export. Deterministic starters work without credentials. Optional AI Gateway drafting uses supplied evidence and writing samples as context; it is not model fine-tuning.
- Empty company notebooks with no seeded businesses or jobs. Live company discovery searches Exa and YC’s current job index using your saved skills/target or an entered focus. Each result includes its source, check time and matching terms; “Save & research” reads the live website or YC profile and persists the company to Neon. Provider failures are explicit and never replaced by sample results.
- Company notebooks, live public YC company/founder imports, verified founder/team links with evidence URLs, public GitHub contributors, and source links for further research. Contributors are not treated as confirmed employees.
- Live repository research: contribution guides, templates/workflows, vouch/gating keyword detection, recent merged PR examples, public issues, and a pre-work checklist. Policy detection is a heuristic over sampled files, not a definitive access decision. Issues are explicitly untested; no arbitrary repository code is executed.
- Public GitHub repository activity, recent update dates, languages, descriptions, and links.

## Configuration

Copy `.env.example` to `.env.local` and set values locally:

- `DATABASE_URL`: required Neon pooled PostgreSQL URL. Never prefix it with NEXT_PUBLIC_.
- `TRAIL_WORKSPACE_ID`: optional personal workspace UUID; use a separate UUID for isolated environments.
- `GITHUB_TOKEN`: optional, increases the GitHub API rate limit. Only public reads are currently implemented.
- `AI_GATEWAY_API_KEY`: enables “Draft in my voice”. Raw résumé text is omitted from outreach prompts.
- `ANTHROPIC_API_KEY`: also verifies employer/role facts in ambiguous public hiring results. Enables résumé autofill using [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), model ID `claude-haiku-5-5`, directly through Anthropic. “Use Claude Haiku 5.5 to autofill” is selected by default when configured; uncheck it for local extraction. Text is sent only when selected; fields remain editable before applying. The original file stays in your workspace database; it is not sent to Claude.
- `AI_MODEL`: optional gateway model identifier; default `openai/gpt-5.4`.

- `EXA_API_KEY`: enables Exa company and people searches. This provider may charge according to your account plan.
- `BRAVE_SEARCH_API_KEY`: enables indexed public LinkedIn profile searches. [Brave](https://brave.com/search/api/) currently offers $5 monthly credits (about 1,000 Search requests at $5/1,000); registration requires a card. This is public-web discovery, not a LinkedIn account connection. A manual Google public-profile search link is always available.

[X search docs](https://x.pcstyle.dev/docs/search) describe the keyless limits. Searches are cached for ten minutes; Trail allows at most five uncached research requests per minute to avoid repeated provider calls. Provider limits and credits still apply. [LinkedIn's Profile API](https://learn.microsoft.com/en-gb/linkedin/shared/integrations/people/profile-api) is restricted to approved developers; it is not a general free employee search API.

Secrets stay on the server. Mailbox OAuth/reply sync and background/push reminders still require integrations. Emails, applications, X messages, and PRs are never sent by this version.

## Storage and hosting

All live data uses Neon PostgreSQL through Drizzle ORM and a bounded node-postgres pool. There is no JSON or filesystem fallback. `src/db/schema.ts` defines 21 relational tables: users, workspaces, profiles, projects, résumés, companies, company people, jobs, applications, drafts, activity, per-source discovery reports, employer exclusions, cached brand assets, and seven LinkedIn tuning tables for profiles, sections, snapshots, research runs, reviewed profiles, messages and revisions. Records are workspace-scoped, foreign keys cascade consistently, real job URLs are unique within a workspace, and follow-ups have an index. Mutations use database transactions and a workspace row lock; only changed rows are upserted.

```sh
bun run db:generate  # Generate a reviewable SQL migration after schema changes.
bun run db:migrate   # Apply versioned SQL migrations.
bun run db:import    # Preserve existing .data/workspace.json facts in PostgreSQL once.
bun run db:studio    # Inspect tables locally.
```

The import validates the old data, refuses to replace an already used database workspace, verifies every user fact inside the transaction, and records completion to make retries safe. The old JSON file remains a migration backup and is never used by the running app. Historical résumé imports contain extracted text only because the prototype discarded their originals; re-upload to retain the original PDF/DOCX/TXT. New imports retain original bytes (up to 5 MB), text, structured extracted fields, model, and upload time in `trail_resumes`; originals can be downloaded from the profile.

This installation still uses one configured personal workspace. The schema supports separate owners/workspaces, but sign-in and trusted session-to-workspace resolution are not implemented yet. Adding a database alone does not make it a publicly accessible multi-user application. Neon Auth is the next integration for account access.

## Verification

```sh
bun test
bun run typecheck
bun run build
bun run verify
VERIFY_LIVE=1 bun run verify
```

The integration script starts an isolated production server on port 3011 against a temporary PostgreSQL/PGlite test database using the same SQL migrations and production pg driver. It verifies TXT/PDF/DOCX imports without automatic persistence, project ownership/contribution persistence, and profile → saved lead → application → follow-up → draft → draft edit → persisted SQL rows, input/origin rejection, duplicate handling, and all product routes. Live verification additionally exercises X profile search/cache, GitHub project import, YC discovery/deduplication and public GitHub repository/research endpoints. Exa, Brave and AI extraction require keys and are not exercised without them. It never connects to the personal Neon database and leaves the personal workspace untouched.

## Asset provenance

`public/trail-landscape.png` was generated with the built-in imagegen tool using this brief: “Original nostalgic pastoral landscape, rolling chartreuse/moss countryside, golden cumulus clouds in a teal sky, cream path and tiny sheep; analog risograph / editorial oil painting with fine halftone grain; wide composition with open sky; no text, architecture, people, logos, or watermarks.”

`public/trail-flower.png` was generated with the built-in imagegen tool as a transparent footer cutout: “A single open hibiscus, pale apricot-yellow petals, coral-pink/magenta center, fine painterly grain, curved sage stem and one small leaf; nostalgic botanical collage; no text, vase, logo, or background.”

## Opportunity discovery

Find opportunities searches YC’s public job index, live X hiring posts through x.pcstyle.dev, and publicly indexed LinkedIn job pages through Brave in parallel. Saved skills and target terms drive matching. Each source reports its own availability, checked/matched counts, new imports and check time; unavailable providers never generate sample data. X posts without a verifiable company and role are omitted. LinkedIn search is a public-web index, not an authenticated LinkedIn API, and indexed vacancies may be old or closed. Confirm eligibility and current availability at the original source. Repeated discoveries keep existing application details and deduplicate source URLs.

Clicking a lead opens `/dashboard/companies/opportunities/<jobId>` with shadcn cards/tabs for the role, application tracking, and company research. YC company profiles can be researched directly. For other leads, Exa helps find the official company website; the user reviews the source before saving. The company-job association persists as a workspace-scoped foreign key.

`VERIFY_OPPORTUNITIES=1 VERIFY_COMPANIES=1 bun run verify` exercises live discovery, source-report persistence and company-job linking against an isolated test database.

## LinkedIn tuning

Open **Your story → LinkedIn tuning** (`/dashboard/linkedin`). The studio stores your current headline, About and experience sections, user-provided facts, section-specific Claude chat, source snapshots and highlighted revisions in seven normalized PostgreSQL tables. No extra sidebar navigation is added; the research library is a nested page at `/dashboard/linkedin/research`.

Chat revisions use only your saved facts/current text and your messages for personal claims. Research provides writing techniques, not accomplishments to borrow. Missing metrics become questions. Numeric claims absent in the supplied evidence and proposals for another selected section are withheld. Job titles and shared ownership remain explicit. Word diffs use underlining and strikethrough plus text labels, so changes do not rely on color alone.

Copy a draft to LinkedIn, then choose **I updated LinkedIn → Record as current**, or paste the current section text in the editor and save. Section versions prevent stale revisions from becoming current. Public refresh requests fresh contents through Exa, but LinkedIn can return a sign-in page or incomplete/indexed text. Refresh attempts are recorded and never overwrite confirmed sections; retrieved text is available for review. There is no authenticated LinkedIn read/write API or automatic publishing.

The initial benchmark contains 100 unique public LinkedIn profiles reviewed from Exa-indexed text across six engineering cohorts. Reviews include a source link, a short source-checked quote, a writing lesson, observed signals and limitations. AI assistance is used for the review; the cohort is not a validated ranking of hiring success. Raw search/review caches are ignored scratch files; the running product reads the normalized database. The reusable research scripts can collect a new corpus (`bun scripts/linkedin-research.ts`), review it (`bun scripts/linkedin-review.ts`), and import it (`bun scripts/linkedin-import-benchmark.ts`). The import script includes this user's supplied Qiro facts and screenshot metadata only for initially missing sections; it does not overwrite edited sections.

`VERIFY_LINKEDIN=1 bun run verify` checks real Claude chat, evidence-backed revision generation, confirmed-current updates and SQL persistence against the isolated test database. It does not publish to LinkedIn or mutate your personal workspace.

## Job availability and company branding

`POST /api/jobs/check` checks active records due after six hours (`{ "force": true }` rechecks immediately). Original 404/410 responses, explicit listing-specific closure text, and expired `JobPosting.validThrough` values move a record to `Archived`. Sign-in, CAPTCHA, rate limiting, network failures, ambiguous redirects, and unrelated job metadata do not archive a record. Application notes, dates, channel, drafts, and the previous stage remain saved. Applications has a separate Archive view; open a record to review its source and restore its stage manually.

X availability reads the original post through the public x.pcstyle.dev post reader and follows an explicit application link when supplied. A surviving tweet does not prove a vacancy is still open. LinkedIn access failures remain unverified. The Applications and Discover screens check due records when opened and expose **Refresh links**. `bun scripts/check-job-health.ts` runs the same pipeline without a running web server; `--force` bypasses the cooldown. A Codex heartbeat checks this workspace every six hours and reports newly archived records or actionable persistent failures.

Company logos come from YC metadata, job-posting organization metadata, company website logos/favicons, or a uniquely identified official site's indexed favicon. Ambiguous employer identities keep a neutral company icon. Brand URLs and source provenance persist on company/job records; `/api/brand` caches bounded public image bytes in `trail_brand_assets` for seven days and validates every DNS resolution/redirect. No API key is needed for company icons, and no logo is generated or inferred from a company name.

The LinkedIn studio now has a document editor and adjacent conversation, a compact connection popover, Radix/shadcn section selectors, and a nested research list with expandable source evidence. Desktop panes fill the remaining viewport; mobile switches between Editor and Chat. Design references include [Linear's UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui), [Attio's workspace](https://attio.com/help/reference/attio-101/introduction-to-navigating-attio), [Granola's notes and chat](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes), [Raycast AI](https://www.raycast.com/), and [shadcn's Select](https://ui.shadcn.com/docs/components/radix/select), interpreted with Trail's existing visual identity and the installed frontend-design skill.
