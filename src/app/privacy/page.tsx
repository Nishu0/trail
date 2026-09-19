import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Mark } from "@/components/mark";
export default function Privacy() {
  return (
    <main className="info-page">
      <header>
        <Link href="/">
          <Mark />
          trail
        </Link>
        <Link href="/dashboard">
          Your workspace <ArrowUpRight size={14} />
        </Link>
      </header>
      <article>
        <h1>
          Your work.
          <br />
          Your words. Your data.
        </h1>
        <p>
          Your profile, projects, writing samples, opportunities, company notes,
          and drafts are stored in your workspace’s Neon PostgreSQL database.
          Database credentials stay on the server.
        </p>
        <h2>Résumé imports</h2>
        <p>
          PDF, DOCX and text résumés are processed on the server. Successful
          imports retain the original file, extracted text, and field preview in
          the database. Your profile changes only when you apply the details and
          save your story. Local autofill does not use an AI provider. If you
          select Claude autofill, résumé text is sent directly to Anthropic’s
          Claude Haiku 5.5 to extract the fields. You review the fields before
          applying them.
        </p>
        <h2>Public source requests</h2>
        <p>
          YC discovery reads the public jobs page. GitHub sync and contribution
          research use the public GitHub API and public repository files. Your
          GitHub username and chosen repository are included in those requests.
          Project imports request the public link you provide and linked GitHub
          metadata. Company research sends your search query to the selected
          provider: Exa, x.pcstyle.dev, or Brave Search. Results retain their
          source links; public-profile matches are reviewed before being saved
          as people.
        </p>
        <h2>AI drafting is optional</h2>
        <p>
          Starter drafts are generated locally without an AI provider. When you
          explicitly choose “Draft in my voice,” your saved profile, writing
          samples, and selected opportunity are sent through Vercel AI Gateway
          to the configured model. Review what you save in your profile before
          using that feature. Raw attached résumé text is omitted from outreach
          prompts; the profile fields you chose to save are included.
        </p>
        <h2>External accounts</h2>
        <p>
          Your X, LinkedIn, and email accounts are not connected in this
          version. Public search uses external search providers. Source links
          open their original websites. Trail does not automatically send email
          or messages, submit job forms, or publish pull requests.
        </p>
        <h2>Workspace access</h2>
        <p>
          This installation currently opens one configured personal workspace.
          The database separates records by workspace, but sign-in is not yet
          implemented. Database storage does not provide user authentication by
          itself. Account-based access must be added before offering this
          installation to other people.
        </p>
      </article>
    </main>
  );
}
