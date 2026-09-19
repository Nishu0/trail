"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  GitBranch,
  Mail,
  Check,
  Sparkles,
  ChevronDown,
  MoveUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mark } from "./mark";
const steps = [
  {
    label: "Find your people",
    title: "Good opportunities.\nA little closer to you.",
    text: "Bring your skills, projects, and the things you love building. Keep relevant startup roles from YC, X, and LinkedIn in one thoughtful shortlist.",
    icon: Search,
    detail: "A source for every opportunity. A reason for every match.",
  },
  {
    label: "Make it personal",
    title: "An introduction that\nsounds like you.",
    text: "Turn your shipped projects and writing samples into a personal introduction. Keep the details specific, edit every draft, and reach out when you’re ready.",
    icon: Mail,
    detail: "Your experience. Your voice. Always yours to review.",
  },
  {
    label: "Ship something useful",
    title: "Know the project.\nThen make your mark.",
    text: "Read contributor rules, learn from accepted pull requests, and understand the team before taking on an issue. Good contributions start with good context.",
    icon: GitBranch,
    detail: "Research the process before you open the pull request.",
  },
];
function TrailDivider({ sky = false }: { sky?: boolean }) {
  return (
    <div className={`trail-divider${sky ? " sky" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 128 30" fill="none">
        <path
          d="M0 15h36V7h16v16h16V7h16v8h44"
          stroke="currentColor"
          strokeWidth="1"
        />
        <rect className="trail-waypoint" x="58" y="13" width="4" height="4" />
      </svg>
    </div>
  );
}
function StepPreview({ step }: { step: number }) {
  return step === 0 ? (
    <>
      <div className="window-title">
        <span className="tiny-kicker">A THOUGHTFUL SHORTLIST</span>
        <h4>Good fits, worth a closer look.</h4>
        <p>A preview of your workspace</p>
      </div>
      {[
        {
          name: "A team building developer tools",
          role: "Developer experience",
          initial: "t",
          color: "mint",
          tags: "Databases · TypeScript",
        },
        {
          name: "A product you care about",
          role: "Product engineering",
          initial: "L",
          color: "violet",
          tags: "React · Product",
        },
        {
          name: "An open source team",
          role: "Developer infrastructure",
          initial: "i",
          color: "pink",
          tags: "Next.js · Open source",
        },
      ].map((c) => (
        <div key={c.name} className="preview-job">
          <span className={`company-icon ${c.color}`}>{c.initial}</span>
          <div>
            <strong>{c.name}</strong>
            <p>{c.role}</p>
          </div>
          <span className="preview-job-tags">{c.tags}</span>
          <ArrowUpRight size={15} />
        </div>
      ))}
      <div className="window-footer">
        <span className="green-dot" />
        Every lead has a source. Every introduction has context.
      </div>
    </>
  ) : step === 1 ? (
    <div className="email-preview">
      <div className="tiny-kicker">OUTREACH / A DRAFT STARTER</div>
      <h4>A note from one builder to another.</h4>
      <div className="email-meta">
        Subject <b>A small idea for your developer experience</b>
      </div>
      <p>Hi team,</p>
      <p>
        I’ve been exploring your project, and the way you approach developer
        tooling caught my attention.
      </p>
      <p>
        I’d love to share something I shipped and hear where it might be useful
        to your team.
      </p>
      <p>Let’s build something good.</p>
      <span className="draft-pill">
        <Mail size={13} /> Yours to edit. Yours to send.
      </span>
    </div>
  ) : (
    <div className="contribute-preview">
      <div className="tiny-kicker">CONTRIBUTE / CONTEXT FIRST</div>
      <h4>A good PR starts before the code.</h4>
      {[
        "Read the contribution guide",
        "Check contributor eligibility",
        "Learn from merged pull requests",
        "Reproduce the issue locally",
      ].map((s, i) => (
        <div key={s}>
          <span className={i < 2 ? "check-square" : "empty-square"}>
            {i < 2 ? <Check size={12} /> : i + 1}
          </span>
          {s}
        </div>
      ))}
      <p className="draft-pill">
        <GitBranch size={14} /> Small, considered contributions.
      </p>
    </div>
  );
}
export function Landing() {
  const [step, setStep] = useState(0);
  return (
    <main className="landing">
      <section className="land-hero">
        <div className="hero-landscape" />
        <div className="hero-grain" />
        <header className="land-header">
          <Link href="/" className="land-wordmark">
            <Mark />
            <span>trail</span>
          </Link>
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#built-for-builders">For builders</a>
            <Link href="/brand">
              Our world <ArrowUpRight size={12} />
            </Link>
          </nav>
          <Button asChild className="header-open">
            <Link href="/dashboard">
              Open workspace <ArrowUpRight />
            </Link>
          </Button>
        </header>
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span /> FOR PEOPLE WHO LOVE TO BUILD
          </div>
          <h1>
            Good work.
            <br />
            Your kind of people.
          </h1>
          <p>
            A quieter way to find your next role. <br />
            Follow the signal. Show your work. Make a connection.
          </p>
          <div className="hero-actions">
            <Button asChild className="orange-button">
              <Link href="/dashboard">
                Find your next chapter <ArrowUpRight />
              </Link>
            </Button>
            <a href="#how-it-works" className="hero-secondary">
              Take a look around <ArrowRight size={16} />
            </a>
          </div>
          <span className="hero-note">Less noise. More possibility.</span>
        </div>
        <div className="hero-bottom">
          <span>THE NEXT CHAPTER IS OUT THERE.</span>
          <a href="#how-it-works">
            LET’S FIND IT <ChevronDown size={14} />
          </a>
        </div>
      </section>
      <section id="how-it-works" className="land-process">
        <TrailDivider />
        <div className="land-container">
          <div className="section-kicker">
            <span>01 / A MORE THOUGHTFUL SEARCH</span>
            <span>BUILT AROUND YOU</span>
          </div>
          <div className="process-heading">
            <h2>
              You’re more than
              <br />a résumé.
            </h2>
            <p>
              The things you’ve built say more than a list of keywords. <br />
              Give them a place to open the right doors.
            </p>
          </div>
          <div className="process-layout">
            <div className="process-copy">
              <div
                className="process-tabs"
                role="tablist"
                aria-label="How Trail works"
              >
                {steps.map((s, i) => (
                  <button
                    key={s.label}
                    role="tab"
                    id={`step-${i}`}
                    aria-controls={`step-panel-${i}`}
                    aria-selected={i === step}
                    onClick={() => setStep(i)}
                  >
                    <span>0{i + 1}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="process-panels">
                {steps.map((s, i) => (
                  <div
                    key={s.label}
                    className="process-panel"
                    id={`step-panel-${i}`}
                    role="tabpanel"
                    aria-labelledby={`step-${i}`}
                    aria-hidden={i !== step}
                    inert={i !== step}
                    data-active={i === step}
                  >
                    <h3>
                      {s.title.split("\n").map((line, n) => (
                        <span key={line}>
                          {n > 0 && <br />}
                          {line}
                        </span>
                      ))}
                    </h3>
                    <p>{s.text}</p>
                    <div className="process-detail">
                      <Check size={15} />
                      {s.detail}
                    </div>
                    <Link
                      href={`/dashboard/${i === 1 ? "outreach" : i === 2 ? "contributions" : "discover"}`}
                      className="text-arrow"
                    >
                      Explore your workspace <ArrowUpRight size={17} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            <div className="product-window">
              <div className="window-chrome">
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <span>TRAIL / YOUR DAILY SIGNAL</span>
                <MoveUpRight size={13} />
              </div>
              <div className="preview-panels">
                {steps.map((s, i) => (
                  <div
                    key={s.label}
                    className="preview-panel"
                    aria-hidden={i !== step}
                    inert={i !== step}
                    data-active={i === step}
                  >
                    <StepPreview step={i} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="built-for-builders" className="builder-section">
        <TrailDivider />
        <div className="land-container">
          <div className="section-kicker">
            <span>02 / EVERYTHING IN ITS PLACE</span>
            <Sparkles size={16} />
          </div>
          <h2>
            A home for the search.
            <br />
            Headspace for the work.
          </h2>
          <div className="builder-grid">
            {[
              {
                n: "01",
                title: "Your story, in one place.",
                text: "GitHub, Devpost, Devfolio, ETHGlobal. Bring the projects you’re proud of and the stack you can ship with.",
                icon: GitBranch,
              },
              {
                n: "02",
                title: "Follow through, thoughtfully.",
                text: "Track email, X, and job-form applications. Keep follow-ups and conversations from falling through the cracks.",
                icon: Mail,
              },
              {
                n: "03",
                title: "Meet the company behind the role.",
                text: "Save founder profiles, team links, repository research, and the details that make a connection meaningful.",
                icon: Search,
              },
            ].map((f) => (
              <article key={f.n}>
                <div>
                  <span>{f.n}</span>
                  <f.icon size={21} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
          <div className="builder-foot">
            <span>
              FOR THE HACKATHON BUILDERS. THE OPEN SOURCE CONTRIBUTORS. THE
              CURIOUS ONES.
            </span>
            <Link href="/dashboard/profile">
              Bring your work <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="land-final">
        <TrailDivider sky />
        <div className="hero-grain" />
        <div className="final-copy">
          <span className="tiny-kicker">YOUR NEXT CHAPTER</span>
          <h2>
            Find your people today.
            <br />
            Build something good tomorrow.
          </h2>
          <Button asChild className="orange-button">
            <Link href="/dashboard">
              Make your next move <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <footer className="land-footer">
          <div className="footer-top">
            <div>
              <h3>
                Good work finds a way.
                <br />
                Keep a little room for possibility.
              </h3>
              <Link href="/dashboard" className="footer-signup">
                Start your trail <ArrowRight size={16} />
              </Link>
            </div>
            <div className="footer-links">
              <div>
                <span>WORKSPACE</span>
                <Link href="/dashboard/discover">Discover</Link>
                <Link href="/dashboard/applications">Applications</Link>
                <Link href="/dashboard/companies">Companies</Link>
              </div>
              <div>
                <span>BUILD</span>
                <Link href="/dashboard/contributions">Contributions</Link>
                <Link href="/dashboard/activity">Your GitHub</Link>
                <Link href="/dashboard/profile">Your story</Link>
              </div>
              <div>
                <span>EXPLORE</span>
                <Link href="/brand">Our brand</Link>
                <Link href="/about">How it works</Link>
                <Link href="/privacy">Your data</Link>
              </div>
            </div>
          </div>
          <div className="footer-wordmark">
            TAKE THE TRAIL
            <span className="footer-flower" aria-hidden="true" />
          </div>
          <div className="footer-bottom">
            <span>© 2026 TRAIL. BUILT FOR WHAT’S NEXT.</span>
            <div>
              <Link href="/privacy">PRIVACY</Link>
              <Link href="/brand">BRAND</Link>
              <span>
                <i className="green-dot" /> A LITTLE MORE HUMAN
              </span>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
