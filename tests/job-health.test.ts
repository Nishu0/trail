import { expect, test } from "bun:test";
import {
  inspectJobPage,
  applyJobInspections,
  applicationLinkInPost,
} from "../src/lib/job-health";
import { websiteBrand, brandLink } from "../src/lib/company-brand";
import { initialWorkspace } from "../src/lib/model";
import { testJob, testCompany } from "./fixtures/workspace";
const job = {
  ...testJob,
  sample: false,
  url: "https://example.com/jobs/engineer",
};
const page = (html = "", status = 200, url = job.url) => ({
  url,
  status,
  type: "text/html",
  body: Buffer.from(html),
});
const now = new Date("2026-10-13T08:00:00Z");
test("confirmed removals and explicit closed listings archive; access failures never do", () => {
  for (const code of [404, 410])
    expect(inspectJobPage(job, page("", code), now).health.status).toBe(
      "closed",
    );
  expect(
    inspectJobPage(
      job,
      page("<main>This job is no longer available.</main>"),
      now,
    ).health.status,
  ).toBe("closed");
  for (const code of [401, 403, 429, 500])
    expect(inspectJobPage(job, page("", code), now).health.status).toBe(
      "unavailable",
    );
  for (const html of [
    "Join LinkedIn to view this job",
    "Verify you are human",
    "Enable JavaScript",
  ])
    expect(inspectJobPage(job, page(html), now).health.status).toBe(
      "unavailable",
    );
  expect(
    inspectJobPage(job, page("", 404, "https://example.com/authwall"), now)
      .health.status,
  ).toBe("unavailable");
  expect(
    inspectJobPage(job, page("<main>Careers</main>"), now).health.status,
  ).toBe("unverified");
});
test("job metadata yields brand provenance and deadlines, without using a different vacancy", () => {
  const metadata = {
    "@type": "JobPosting",
    title: job.role,
    validThrough: "2026-10-12",
    hiringOrganization: {
      logo: "https://example.com/brand.png",
      url: "https://example.com",
    },
  };
  const html = (values: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(values)}</script><main>Apply now</main>`;
  const expired = inspectJobPage(job, page(html(metadata)), now);
  expect(expired.health.status).toBe("closed");
  expect(expired.logoSource).toBe(job.url);
  expect(expired.logoUrl).toBe("https://example.com/brand.png");
  expect(
    inspectJobPage(
      job,
      page(html({ ...metadata, validThrough: "2026-12-01" })),
      now,
    ).health.status,
  ).toBe("open");
  expect(
    inspectJobPage(
      job,
      page(
        html([
          { ...metadata, title: "Unrelated role" },
          { ...metadata, title: "Another vacancy" },
        ]),
        200,
        "https://example.com/jobs",
      ),
      now,
    ).health.status,
  ).toBe("unverified");
});
test("archiving retains application history and notes and ignores a changed source URL", () => {
  const w = initialWorkspace();
  w.jobs = [
    {
      ...job,
      stage: "Interview",
      channel: "Email",
      appliedAt: now.toISOString(),
      followUp: "2026-10-20",
      notes: "Spoke to founder",
    },
  ];
  const closed = inspectJobPage(job, page("", 410), now);
  expect(applyJobInspections(w, [closed])).toEqual([job.id]);
  expect(w.jobs[0].stage).toBe("Archived");
  expect(w.jobs[0].health?.previousStage).toBe("Interview");
  expect(w.jobs[0].notes).toBe("Spoke to founder");
  expect(w.jobs[0].followUp).toBe("2026-10-20");
  expect(w.jobs[0].channel).toBe("Email");
  const prior = structuredClone(w.jobs[0]);
  applyJobInspections(w, [
    { ...closed, originalUrl: "https://example.com/different" },
  ]);
  expect(w.jobs[0]).toEqual(prior);
});
test("public brand discovery uses original logos or favicons, never a marketing hero", () => {
  expect(
    websiteBrand(
      '<meta property="og:image" content="/hero.jpg"><link rel="icon" href="/icon.png">',
      "https://example.com",
    ),
  ).toEqual({
    logoUrl: "https://example.com/icon.png",
    logoSource: "https://example.com",
  });
  expect(
    websiteBrand(
      '<script type="application/ld+json">{"@type":"Organization","logo":{"url":"/logo.svg"}}</script><link rel="icon" href="/icon.png">',
      "https://example.com",
    ).logoUrl,
  ).toBe("https://example.com/logo.svg");
  expect(brandLink("javascript:alert(1)", "https://example.com")).toBe("");
  expect(brandLink("https://127.0.0.1/logo.png", "https://example.com")).toBe(
    "",
  );
  expect(
    websiteBrand(
      '<meta property="og:image" content="/hero.jpg">',
      "https://example.com",
    ),
  ).toEqual({});
});
test("X checks follow the explicit application link rather than a poster's avatar or social links", () => {
  expect(
    applicationLinkInPost(
      "We’re hiring! Apply here: https://careers.example.com/role https://x.com/company",
    ),
  ).toBe("https://careers.example.com/role");
  expect(
    applicationLinkInPost(
      "See https://x.com/company and https://twitter.com/team",
    ),
  ).toBe("");
  expect(
    applicationLinkInPost(
      "Read https://example.com/about or https://example.com/team",
    ),
  ).toBe("");
});
