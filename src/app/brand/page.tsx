import Link from "next/link";
import {
  ArrowUpRight,
  Search,
  Mail,
  GitBranch,
  GitPullRequest,
  Bell,
  UserRound,
  Building2,
  Bookmark,
} from "lucide-react";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
export default function Brand() {
  return (
    <main className="brand-page">
      <header>
        <Link className="brand-wordmark" href="/">
          <Mark />
          trail
        </Link>
        <Link href="/dashboard">
          Into the workspace <ArrowUpRight size={14} />
        </Link>
      </header>
      <div className="brand-intro">
        <h1>
          A little character.
          <br />A clear direction.
        </h1>
        <p>
          Trail is a quieter home for your next chapter. An identity inspired by
          open landscapes, thoughtful work, and the small connections that lead
          somewhere good.
        </p>
      </div>
      <div className="brand-panels">
        <section className="brand-panel">
          <div className="brand-panel-heading">
            <h2>
              Our
              <br />
              colours.
            </h2>
            <p>
              A warm invitation, a little fresh air, and room to think. Colour
              gives each part of Trail its place.
            </p>
          </div>
          <div className="brand-colors">
            {[
              { name: "Trail Orange", hex: "#E97432" },
              { name: "Open Sky", hex: "#BBD FEE".replace(" ", "") },
              { name: "Paper", hex: "#FFFEF9" },
            ].map((c) => (
              <div key={c.name}>
                <div
                  className="swatch"
                  style={{
                    background: c.hex,
                    color: c.name === "Trail Orange" ? "white" : "#68836c",
                  }}
                >
                  <Mark />
                </div>
                <b>{c.name}</b>
                <p>{c.hex}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="brand-panel">
          <div className="brand-panel-heading">
            <h2>
              Words with
              <br />a little room.
            </h2>
            <p>
              Geist is clear, familiar, and human. Large headings create space.
              Compact labels keep the details in focus.
            </p>
          </div>
          <span className="brand-type-tag">FOR THE STORY & THE DETAILS</span>
          <div className="brand-font-name">Geist + Geist Mono</div>
          <div className="type-specimen">AaBbCc</div>
        </section>
        <section className="brand-panel">
          <div className="brand-panel-heading">
            <h2>
              A home
              <br />
              for the work.
            </h2>
            <p>
              Quiet borders. Useful hierarchy. Soft surfaces. The workspace puts
              the next meaningful step within reach.
            </p>
          </div>
          <div className="brand-frame-example">
            <div>TRAIL / YOUR NEXT CHAPTER</div>
            <div>
              <h3>Follow the signal.</h3>
              <p>
                A thoughtful shortlist. A personal introduction.
                <br />
                Something worth building together.
              </p>
              <Button asChild className="orange-button">
                <Link href="/dashboard">
                  Find your people <ArrowUpRight size={13} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="brand-panel">
          <div className="brand-panel-heading">
            <h2>
              Small signs.
              <br />
              Clear meaning.
            </h2>
            <p>
              Our pixel mark brings a little character. Simple line icons help
              you find your way without getting in the way.
            </p>
          </div>
          <div className="brand-icon-grid">
            {[
              { Icon: Search, name: "DISCOVER" },
              { Icon: Mail, name: "INTRODUCE" },
              { Icon: GitBranch, name: "BUILD" },
              { Icon: GitPullRequest, name: "CONTRIBUTE" },
              { Icon: Bell, name: "FOLLOW UP" },
              { Icon: UserRound, name: "YOUR STORY" },
              { Icon: Building2, name: "YOUR PEOPLE" },
              { Icon: Bookmark, name: "SAVE SIGNAL" },
            ].map(({ Icon, name }) => (
              <div key={name}>
                <Icon size={28} strokeWidth={1.2} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="brand-tagline">
        Good work.
        <br />
        Your kind of people.
      </div>
      <footer>
        <span>TRAIL / A BETTER PATH TO YOUR NEXT ROLE</span>
        <Link href="/">BACK TO THE LANDSCAPE ↗</Link>
      </footer>
    </main>
  );
}
