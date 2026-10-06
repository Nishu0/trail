import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const cohorts = [
  [
    "Move / on-chain credit",
    "Software engineers building Move smart contracts, Aptos or Sui lending protocols and on-chain credit marketplaces. Profiles with concrete engineering experience and product ownership.",
  ],
  [
    "ZK / verifiable inference",
    "Software engineers implementing zero knowledge proofs and verifiable machine learning inference, zkML, underwriting or privacy infrastructure. Profiles describing specific shipped systems.",
  ],
  [
    "Fintech / full stack",
    "Full stack engineers building lending fintech products, credit marketplaces, underwriting policy pipelines, loan origination and investment flows. Specific architecture and delivery accomplishments.",
  ],
  [
    "Early-stage product engineering",
    "Founding and early startup software engineers who co-led full stack products with small teams and describe what they shipped and measured in their experience.",
  ],
  [
    "DeFi / infrastructure",
    "Protocol engineers building DeFi lending pools, Rust blockchain infrastructure and smart contract security. Concrete contributions and collaboration in experience sections.",
  ],
  [
    "Product / developer tools",
    "Software and product engineers at Linear, Vercel, Supabase, Stripe, Ramp or Plaid with strong descriptions of shipped features, ownership and measurable technical impact.",
  ],
];
const outputs: any[] = [];
for (let offset = 0; offset < cohorts.length; offset += 2) {
  await Promise.all(
    cohorts.slice(offset, offset + 2).map(async ([cohort, query]) => {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.EXA_API_KEY!,
        },
        body: JSON.stringify({
          query,
          category: "people",
          type: "auto",
          numResults: 25,
          contents: { text: { maxCharacters: 7000 }, highlights: true },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`Exa returned ${response.status}`);
      const body = await response.json();
      outputs.push({
        cohort,
        query,
        checkedAt: new Date().toISOString(),
        results: body.results,
      });
      console.log(
        `${cohort}: ${body.results?.length || 0} public indexed profiles`,
      );
    }),
  );
}
await Bun.write("research/linkedin-source-cache.json", JSON.stringify(outputs));
const profiles = new Map();
for (const cohort of outputs)
  for (const result of cohort.results || []) {
    const url = new URL(result.url);
    const match = /^\/in\/([^/]+)/.exec(url.pathname);
    if (!/linkedin\.com$/.test(url.hostname) || !match) continue;
    const key = match[1].toLowerCase();
    const text = result.text || result.highlights?.join("\n") || "";
    if (text.length < 400) continue;
    if (!profiles.has(key))
      profiles.set(key, {
        name: result.title,
        url: `https://www.linkedin.com/in/${match[1]}`,
        cohort: cohort.cohort,
        query: cohort.query,
        checkedAt: cohort.checkedAt,
        text,
        highlights: result.highlights || [],
      });
  }
await Bun.write(
  "research/linkedin-reviewed-profiles.json",
  JSON.stringify([...profiles.values()]),
);
console.log(`Unique profiles with substantive indexed text: ${profiles.size}`);
