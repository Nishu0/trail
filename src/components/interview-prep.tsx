"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Code,
  Handshake,
  ListChecks,
  MessageCircleQuestion,
  PhoneCall,
  Quote,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace, request } from "./workspace";
import { Field, CompanyIcon, localDate } from "./shared";
import { WorkspaceSelect } from "./ui/select";
import {
  STAGES,
  readInvite,
  stageGuide,
  type PersonalPrep,
  type StageGuide,
  type StageId,
  type TopQuestion,
} from "@/lib/interview-prep";
import {
  NEETCODE_150,
  NEETCODE_LIST_URL,
  PATTERNS,
  CORE_PATTERNS,
  problemUrl,
  recommendProblems,
  type Pattern,
} from "@/lib/neetcode";

const icons = { intro: PhoneCall, tech: Code, hr: Handshake };
const SAVED = "trail.interview.preps.v1";
const TICKS = "trail.interview.ticks.v1";
const SOLVED = "trail.interview.neetcode.v1";
const steps = [
  "Reading the invite…",
  "Searching Glassdoor interview reports…",
  "Writing your questions…",
];
// Prep sheets stay in this browser. They are working notes, not workspace records.
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved) as T);
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);
  return [value, setValue] as const;
}

export function InterviewPrep() {
  const { data, run } = useWorkspace();
  const [stage, setStage] = useState<StageId>("intro");
  const [saved, setSaved] = useStored<PersonalPrep[]>(SAVED, []);
  const [activeId, setActiveId] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [choice, setChoice] = useState<"auto" | StageId>("auto");
  const [jobId, setJobId] = useState("");
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState(0);
  const filled = useRef({ company: "", role: "" });
  const sheet = useRef<HTMLDivElement>(null);
  const invite = useMemo(() => readInvite(email), [email]);
  const prep = saved.find((item) => item.id === activeId) || null;
  const guide = stageGuide(prep?.stage || stage);
  const jobs = (data?.jobs || []).filter(
    (job) => !job.sample && job.stage !== "Archived",
  );
  useEffect(() => {
    if (!working) return;
    setStep(0);
    const timer = setInterval(
      () => setStep((value) => Math.min(value + 1, steps.length - 1)),
      3500,
    );
    return () => clearInterval(timer);
  }, [working]);
  function readEmail(value: string) {
    setEmail(value);
    const facts = readInvite(value);
    // Fill a field from the invite only while it still holds what the invite put there.
    if (facts.company && (!company || company === filled.current.company)) {
      setCompany(facts.company);
      filled.current.company = facts.company;
    }
    if (facts.role && (!role || role === filled.current.role)) {
      setRole(facts.role);
      filled.current.role = facts.role;
    }
  }
  function chooseJob(id: string) {
    setJobId(id);
    const job = jobs.find((item) => item.id === id);
    if (!job) return;
    setCompany(job.company);
    setRole(job.role);
    setDescription(job.description);
  }
  function show() {
    requestAnimationFrame(() =>
      sheet.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function build() {
    setWorking(true);
    try {
      await run(async () => {
        const result = await request<PersonalPrep>("/api/interview-prep", {
          method: "POST",
          signal: AbortSignal.timeout(100000),
          body: JSON.stringify({
            company,
            role,
            description,
            email,
            ...(choice === "auto" ? {} : { stage: choice }),
          }),
        });
        setSaved((items) => [result, ...items].slice(0, 12));
        setActiveId(result.id);
        show();
      });
    } finally {
      setWorking(false);
    }
  }
  const detected = [
    invite.stage && stageGuide(invite.stage).label,
    invite.minutes && `${invite.minutes} min`,
    invite.platform,
    invite.interviewer && `with ${invite.interviewer}`,
  ].filter(Boolean);
  return (
    <div className="prep-page">
      <div className="prep-stages" role="tablist" aria-label="Interview stage">
        {STAGES.map((item) => {
          const Icon = icons[item.id];
          const active = guide.id === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              className={`prep-stage ${active ? "active" : ""}`}
              onClick={() => {
                setStage(item.id);
                setActiveId("");
              }}
            >
              <span className="prep-stage-top">
                <span className="tiny-kicker">
                  {item.step} · {item.label.toUpperCase()}
                </span>
                <span className="prep-stage-icon">
                  <Icon size={16} />
                </span>
              </span>
              <b>{item.title}</b>
              <span className="prep-stage-line">{item.line}</span>
              <span className="prep-stage-meta">
                <span>
                  <Clock3 size={11} />
                  {item.length}
                </span>
                <span>
                  <UserRound size={11} />
                  {item.who}
                </span>
                <i>
                  {active && !prep ? "Open below" : "Open playbook"}
                  <ArrowRight size={11} />
                </i>
              </span>
            </button>
          );
        })}
      </div>
      <div className="prep-layout">
        <div className="prep-side">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Prep for a real call</h2>
                <p>Paste the invite. Trail reads it and builds your sheet.</p>
              </div>
              <Sparkles size={17} />
            </div>
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                build();
              }}
            >
              <Field label="Interview invite email">
                <textarea
                  rows={5}
                  value={email}
                  maxLength={12000}
                  placeholder="Paste the email from the recruiter here (optional)"
                  onChange={(event) => readEmail(event.target.value)}
                />
              </Field>
              {detected.length > 0 && (
                <div className="prep-detected" aria-live="polite">
                  <span className="tiny-kicker">FROM THE INVITE</span>
                  {detected.map((item) => (
                    <span key={String(item)} className="prep-chip">
                      {item}
                    </span>
                  ))}
                </div>
              )}
              {jobs.length > 0 && (
                <Field label="Or start from a saved opportunity">
                  <WorkspaceSelect
                    label="Saved opportunity"
                    value={jobId}
                    onValueChange={chooseJob}
                    options={[
                      { value: "", label: "Not from my list" },
                      ...jobs.map((job) => ({
                        value: job.id,
                        label: `${job.company} · ${job.role}`,
                      })),
                    ]}
                  />
                </Field>
              )}
              <Field label="Company">
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={company}
                  placeholder="Company name"
                  onChange={(event) => setCompany(event.target.value)}
                />
              </Field>
              <Field label="Role">
                <input
                  maxLength={200}
                  value={role}
                  placeholder="Role title"
                  onChange={(event) => setRole(event.target.value)}
                />
              </Field>
              <Field
                label="Role description"
                hint="Paste the job description for questions that match the role."
              >
                <textarea
                  rows={4}
                  maxLength={20000}
                  value={description}
                  placeholder="Paste the job description (optional)"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <div className="field">
                <span>Which call is it?</span>
                <div className="prep-segment" role="radiogroup">
                  {(
                    [
                      [
                        "auto",
                        invite.stage
                          ? `Auto · ${stageGuide(invite.stage).label}`
                          : "Auto",
                      ],
                      ["intro", "Intro"],
                      ["tech", "Tech"],
                      ["hr", "HR"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      role="radio"
                      aria-checked={choice === value}
                      className={choice === value ? "active" : ""}
                      onClick={() => setChoice(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="submit"
                className="orange-button"
                disabled={working || company.trim().length < 2}
              >
                <Sparkles size={14} />
                {working ? steps[step] : "Build my prep sheet"}
              </Button>
              <p className="form-hint">
                Trail searches Glassdoor interview reports for the company, then
                sends them with the invite, the role and your story to your AI
                model. Sheets are kept in this browser.
              </p>
            </form>
          </section>
          {saved.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  Your prep sheets{" "}
                  <span className="count-pill">{saved.length}</span>
                </h2>
                <ListChecks size={17} />
              </div>
              {saved.map((item) => (
                <div
                  key={item.id}
                  className={`prep-saved ${item.id === activeId ? "active" : ""}`}
                >
                  <button
                    onClick={() => {
                      setActiveId(item.id);
                      show();
                    }}
                  >
                    <CompanyIcon name={item.company} />
                    <span>
                      <b>{item.company}</b>
                      <small>
                        {stageGuide(item.stage).label} ·{" "}
                        {localDate(item.createdAt)}
                      </small>
                    </span>
                  </button>
                  <button
                    aria-label={`Delete the ${item.company} prep sheet`}
                    onClick={() => {
                      setSaved((items) =>
                        items.filter((other) => other.id !== item.id),
                      );
                      if (item.id === activeId) setActiveId("");
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
        <div ref={sheet} className="prep-sheet-anchor">
          <Sheet key={prep?.id || guide.id} guide={guide} prep={prep} />
        </div>
      </div>
    </div>
  );
}

function Sheet({
  guide,
  prep,
}: {
  guide: StageGuide;
  prep: PersonalPrep | null;
}) {
  const [ticks, setTicks] = useStored<Record<string, boolean>>(TICKS, {});
  const book = prep || guide;
  const scope = prep?.id || guide.id;
  const done = book.checklist.filter((item) => ticks[`${scope}:${item}`]);
  const groups = [...new Set(book.general.map((item) => item.category))];
  const Icon = icons[guide.id];
  return (
    <div className="prep-sheet">
      <section className="panel prep-hero">
        <div className="prep-hero-top">
          {prep ? (
            <CompanyIcon name={prep.company} large />
          ) : (
            <span className="prep-hero-icon">
              <Icon size={22} />
            </span>
          )}
          <div>
            <span className="tiny-kicker">
              {prep
                ? `YOUR ${guide.label.toUpperCase()}`
                : `${guide.step} · ${guide.label.toUpperCase()} PLAYBOOK`}
            </span>
            <h2>
              {prep
                ? `${prep.company}${prep.role ? ` · ${prep.role}` : ""}`
                : guide.title}
            </h2>
          </div>
        </div>
        <div className="prep-chips">
          {prep ? (
            <>
              <span className="prep-chip strong">{guide.label}</span>
              <span className="prep-chip">
                <Clock3 size={11} />
                {prep.minutes ? `${prep.minutes} min` : guide.length}
              </span>
              {prep.platform && (
                <span className="prep-chip">
                  <Video size={11} />
                  {prep.platform}
                </span>
              )}
              {prep.interviewer && (
                <span className="prep-chip">
                  <UserRound size={11} />
                  {prep.interviewer}
                </span>
              )}
            </>
          ) : (
            guide.checks.map((check) => (
              <span key={check} className="prep-chip">
                <Target size={11} />
                {check}
              </span>
            ))
          )}
        </div>
        <p className="prep-brief">{prep?.brief || guide.brief}</p>
        {prep?.note && <p className="prep-note">{prep.note}</p>}
      </section>

      {prep && prep.sources.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                What candidates report{" "}
                <span className="count-pill">{prep.sources.length}</span>
              </h2>
              <p>
                Anonymous Glassdoor reports. Useful signal, not a promise of
                what you will be asked.
              </p>
            </div>
            <Quote size={17} />
          </div>
          <div className="prep-reported">
            {prep.reported && <p>{prep.reported}</p>}
            <div className="prep-sources">
              {prep.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  title={source.snippet}
                >
                  {source.title}
                  <ArrowUpRight size={11} />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Top 5 to prepare first <span className="count-pill">5</span>
            </h2>
            <p>
              {prep
                ? "The questions most likely in this call. Say each answer out loud once."
                : "If you only have twenty minutes, prepare these."}
            </p>
          </div>
          <Sparkles size={17} />
        </div>
        <ol className="prep-top">
          {book.top.map((item, index) => (
            <TopCard key={item.question} item={item} index={index} />
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              General questions{" "}
              <span className="count-pill">{book.general.length}</span>
            </h2>
            <p>Have a short answer ready for each one.</p>
          </div>
          <MessageCircleQuestion size={17} />
        </div>
        <div className="prep-general">
          {groups.map((group) => (
            <div key={group}>
              <span className="tiny-kicker">{group.toUpperCase()}</span>
              <ul>
                {book.general
                  .filter((item) => item.category === group)
                  .map((item) => (
                    <li key={item.question}>{item.question}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {guide.id !== "hr" && (prep || guide.id === "tech") && (
        <NeetCode
          patterns={prep?.patterns || CORE_PATTERNS}
          topics={prep?.topics || []}
          company={prep?.company}
          ahead={guide.id === "intro"}
        />
      )}

      <div className="prep-pair">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Questions to ask them</h2>
              <p>Pick two or three. Asking nothing reads as low interest.</p>
            </div>
            <MessageCircleQuestion size={17} />
          </div>
          <ul className="prep-ask">
            {book.ask.map((item) => (
              <li key={item}>
                <ArrowRight size={12} />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Before the call{" "}
                <span className="count-pill">
                  {done.length}/{book.checklist.length}
                </span>
              </h2>
              <p>Tick these off the day before.</p>
            </div>
            <ListChecks size={17} />
          </div>
          <div className="prep-checklist">
            {book.checklist.map((item) => {
              const key = `${scope}:${item}`;
              return (
                <label key={item} className={ticks[key] ? "done" : ""}>
                  <input
                    type="checkbox"
                    checked={!!ticks[key]}
                    onChange={(event) =>
                      setTicks((all) => ({
                        ...all,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  <span className="prep-box">
                    <Check size={11} />
                  </span>
                  {item}
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function TopCard({ item, index }: { item: TopQuestion; index: number }) {
  return (
    <li className="prep-top-card">
      <span className="prep-top-number">{index + 1}</span>
      <div>
        <div className="prep-top-head">
          <h3>{item.question}</h3>
          {item.basis === "reported" && item.sourceUrl ? (
            <a
              className="prep-basis reported"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Reported on Glassdoor
              <ArrowUpRight size={10} />
            </a>
          ) : (
            <span className="prep-basis">
              {item.basis === "role" ? "From the role" : "Common at this stage"}
            </span>
          )}
        </div>
        <p className="prep-why">{item.why}</p>
        <p className="prep-angle">
          <b>How to answer</b>
          {item.angle}
        </p>
      </div>
    </li>
  );
}

function NeetCode({
  patterns,
  topics,
  company,
  ahead,
}: {
  patterns: Pattern[];
  topics: string[];
  company?: string;
  ahead: boolean;
}) {
  const [solved, setSolved] = useStored<Record<string, boolean>>(SOLVED, {});
  const [filter, setFilter] = useState<"picks" | Pattern>("picks");
  const picks = useMemo(() => recommendProblems(patterns, 12), [patterns]);
  const problems =
    filter === "picks"
      ? picks
      : NEETCODE_150.filter((problem) => problem.pattern === filter);
  // Recommended patterns lead; the rest of the 150 stays one tap away.
  const ordered = [
    ...patterns,
    ...PATTERNS.filter((pattern) => !patterns.includes(pattern)),
  ];
  const count = NEETCODE_150.filter((problem) => solved[problem.slug]).length;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            {ahead
              ? "Get ahead of the tech round"
              : "Practice from NeetCode 150"}{" "}
            <span className="count-pill">{count}/150 solved</span>
          </h2>
          <p>
            {company
              ? `Patterns picked for ${company} from the role and candidate reports. Each problem opens on neetcode.io.`
              : "Start with the core patterns. Each problem opens on neetcode.io."}
          </p>
        </div>
        <a href={NEETCODE_LIST_URL} target="_blank" rel="noreferrer">
          Full list <ArrowUpRight size={11} />
        </a>
      </div>
      {topics.length > 0 && (
        <div className="prep-topics">
          <span className="tiny-kicker">ALSO REVISE FOR THIS ROLE</span>
          {topics.map((topic) => (
            <span key={topic} className="prep-chip">
              {topic}
            </span>
          ))}
        </div>
      )}
      <div className="prep-filters" role="tablist" aria-label="Pattern">
        <button
          role="tab"
          aria-selected={filter === "picks"}
          className={filter === "picks" ? "active" : ""}
          onClick={() => setFilter("picks")}
        >
          Recommended · {picks.length}
        </button>
        {ordered.map((pattern) => (
          <button
            key={pattern}
            role="tab"
            aria-selected={filter === pattern}
            className={`${filter === pattern ? "active" : ""} ${patterns.includes(pattern) ? "picked" : ""}`}
            onClick={() => setFilter(pattern)}
          >
            {pattern}
          </button>
        ))}
      </div>
      <div className="prep-problems">
        {problems.map((problem) => (
          <div
            key={problem.slug}
            className={`prep-problem ${solved[problem.slug] ? "done" : ""}`}
          >
            <label>
              <input
                type="checkbox"
                aria-label={`Mark ${problem.name} as solved`}
                checked={!!solved[problem.slug]}
                onChange={(event) =>
                  setSolved((all) => ({
                    ...all,
                    [problem.slug]: event.target.checked,
                  }))
                }
              />
              <span className="prep-box">
                <Check size={11} />
              </span>
            </label>
            <a href={problemUrl(problem)} target="_blank" rel="noreferrer">
              <b>{problem.name}</b>
              <small>{problem.pattern}</small>
            </a>
            <span className={`prep-level ${problem.difficulty.toLowerCase()}`}>
              {problem.difficulty}
            </span>
            <a
              className="prep-open"
              href={problemUrl(problem)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Practise ${problem.name} on NeetCode`}
            >
              Practise <ArrowUpRight size={11} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
