import type { CSSProperties, ReactNode } from "react";
import { compare } from "./improvements";
import { SESSIONS } from "./seed";

const date = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const show = (v: number | null, unit = "") => (v === null ? "—" : `${v}${unit}`);

function Card({ area, i, eyebrow, title, children }: { area: string; i: number; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className={`shell reveal ${area}`} style={{ "--i": i } as CSSProperties}>
      <div className="core">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Video({ label, src }: { label: string; src: string | null }) {
  return (
    <figure className="video">
      {src ? (
        <video src={src} controls preload="metadata" playsInline />
      ) : (
        <div className="video-empty">
          <span className="play" aria-hidden />
          <span>No recording linked yet</span>
        </div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function App() {
  const [current, previous] = SESSIONS; // newest first; the current session is the last recorded walk
  const changes = previous ? compare(current, previous) : [];

  return (
    <main className="page">
      <header className="hero reveal" style={{ "--i": 0 } as CSSProperties}>
        <span className="eyebrow">Latest session</span>
        <h1>
          {current.player}'s walk <span className="dim">{date(current.ts)}</span>
        </h1>
        <p className="meta">
          <span>{duration(current.summary.seconds)} min</span>
          <span>{current.summary.steps} steps</span>
          <span className={current.verified ? "chip ok" : "chip"}>{current.verified ? "Verified walking" : "Not verified"}</span>
        </p>
      </header>

      <div className="bento">
        <Card area="replay" i={1} eyebrow="Replay" title="This session">
          <div className="videos">
            <Video label="Game" src={current.videos.game} />
            <Video label="Side view" src={current.videos.gait} />
          </div>
        </Card>

        <Card area="summary" i={2} eyebrow="AI summary" title="Coach's read">
          <div className="skeleton" aria-label="Summary not generated yet">
            <span /><span /><span /><span />
          </div>
          <p className="hint">Written by the AI coach after each session. Placeholder until it is connected.</p>
        </Card>

        <Card area="improve" i={3} eyebrow="Since last session" title={previous ? `Compared with ${date(previous.ts)}` : "First session"}>
          <div className="tiles">
            {changes.map(({ metric, now, delta, improved }) => (
              <div className="tile" key={metric.label}>
                <span className="tile-label">{metric.label}</span>
                <span className="tile-value">
                  {show(now)}
                  <small>{metric.unit}</small>
                </span>
                <span className={improved === null ? "delta" : improved ? "delta up" : "delta down"}>
                  {delta === null ? "no data" : `${delta > 0 ? "+" : ""}${delta} ${improved === null ? "same" : improved ? "better" : "lower"}`}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card area="history" i={4} eyebrow="History" title="Previous sessions">
          <ol className="history-list">
            {SESSIONS.map((s, idx) => (
              <li key={s.ts}>
                <div className="row">
                  <span className="when">{date(s.ts)}</span>
                  {idx === 0 && <span className="chip ok">Latest</span>}
                  {!s.verified && <span className="chip">Not verified</span>}
                  <span className="stats">
                    {duration(s.summary.seconds)} · {s.summary.steps} steps · {show(s.summary.cadence)} spm · form {show(s.summary.formPct, "%")}
                  </span>
                </div>
                <p className="note">{s.note}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </main>
  );
}
