import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Mark } from "@/components/mark";
export default function About() {
  return (
    <main className="info-page">
      <header>
        <Link href="/">
          <Mark />
          trail
        </Link>
        <Link href="/dashboard">
          Open workspace <ArrowUpRight size={14} />
        </Link>
      </header>
      <article>
        <h1>
          A thoughtful search.
          <br />
          Built around your work.
        </h1>
        <p>
          Trail brings the job search into one place: your evidence, your
          shortlist, your introductions, and your next steps.
        </p>
        <h2>Start with your builder story</h2>
        <p>
          Add your experience, skills, work preferences, GitHub username, and
          projects from Devpost, Devfolio, or ETHGlobal. Paste a few of your own
          writing samples for style-aware drafting. Every detail remains
          editable in <Link href="/dashboard/profile">Your story</Link>.
        </p>
        <h2>Follow a real source</h2>
        <p>
          Discovery reads YC’s public job index and matches your saved keywords.
          It is a focused snapshot of that page, not every YC vacancy. X and
          LinkedIn leads can be saved manually with their original links;
          automated access needs an authorized integration. Check each source
          for location, experience, and eligibility.
        </p>
        <h2>Make the introduction personal</h2>
        <p>
          Create a starter draft from your evidence, or enable AI writing with a
          server key to use your writing samples. Edit it, check its claims,
          copy it, or download an email draft. No outreach is sent
          automatically.
        </p>
        <h2>Keep the next step visible</h2>
        <p>
          Log applications by email, X, or job form. Move opportunities between
          Saved, Applied, Interview, and Offer. Add a follow-up date. Due
          reminders appear inside the workspace while it is open.
        </p>
        <h2>Understand the company before contributing</h2>
        <p>
          Keep a company notebook with product notes, founder and team profiles,
          and verification sources. Repository research reads contribution
          documents, relevant policies, recently merged PRs, and open issues.
          Review source files and PR discussions before coding. Issues are not
          marked as tested or reproduced by Trail.
        </p>
        <h2>See the work you’re doing</h2>
        <p>
          GitHub activity shows your latest public repository updates,
          languages, descriptions, and source links. The focus is what you are
          building, at repository level.
        </p>
        <p style={{ marginTop: 35 }}>
          <Link href="/dashboard">Start your trail ↗</Link>
        </p>
      </article>
    </main>
  );
}
