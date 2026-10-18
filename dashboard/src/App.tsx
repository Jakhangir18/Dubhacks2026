import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { compare } from "./improvements.ts";
import { fmt, groupMetrics, isPending, metricIndex, reviewState, sideName, sourceLine, suggestions } from "./review.ts";
import { SESSIONS } from "./seed.ts";
import type { GaitReview, ReviewMetric, Session } from "./types";

// A GET /api/sessions/{player} row (server/api.py): the gait summary trimmed; /api/session/{id} has it all.
type Row = Omit<Session, "gait" | "videos"> & { gait?: { summary?: Session["gait"] } | null };

const getJSON = async <T,>(path: string): Promise<T> => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
};

const toSession = (r: Row): Session => ({
  id: r.id, player: r.player, ts: r.ts, verified: r.verified, note: r.note, summary: r.summary,
  gait: r.gait?.summary ?? null,
  videos: { game: null, gait: null },
  gaitReview: r.gaitReview ?? null,
});

const keyOf = (s: Session) => s.id ?? `ts:${s.ts}`;   // older sessions have no id
const POLL_MS = 3000;     // a review on its way: look again this often
const REFRESH_MS = 20000; // the session list: a new walk shows up within this

// ?session=ID opens that walk (the game links here when its review is done); ?player=NAME, else the first player.
// The sample sessions stand in, labelled, when the server has nothing to show.
async function loadSessions(): Promise<{ player: string; sessions: Session[]; live: boolean }> {
  try {
    const q = new URLSearchParams(location.search);
    const wanted = q.get("session");
    const opened = wanted ? await getJSON<Row>(`/api/session/${encodeURIComponent(wanted)}`).catch(() => null) : null;
    const name = q.get("player") ?? opened?.player ?? (await getJSON<string[]>("/api/players"))[0];
    if (!name) throw new Error("no players yet");
    const rows = (await getJSON<Row[]>(`/api/sessions/${encodeURIComponent(name)}`)).map(toSession);
    if (opened && !rows.some((s) => s.id === opened.id)) rows.push(toSession(opened));   // older than the list reaches
    if (!rows.length) throw new Error("no sessions yet");
    return { player: name, sessions: rows.sort((a, b) => b.ts - a.ts), live: true };
  } catch {
    return { player: SESSIONS[0].player, sessions: SESSIONS, live: false };
  }
}

const date = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const duration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const show = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${v}${unit}`);

function Card({ cls, i, eyebrow, title, children }: { cls: string; i: number; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className={`shell reveal ${cls}`} style={{ "--i": i } as CSSProperties}>
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

// One chip per number the review cites: its label and value; the tooltip has the typical value and the trust.
function Evidence({ ids, index }: { ids: string[] | undefined; index: Map<string, ReviewMetric> }) {
  if (!ids?.length) return null;
  return (
    <div className="evidence">
      {ids.map((id) => {
        const m = index.get(id);
        const title = m ? [m.typical && `typical ${m.typical}`, `trust ${m.trust}`, m.prev !== null && `earlier ${fmt(m.prev)}`].filter(Boolean).join(" · ") : id;
        return (
          <span key={id} className={`chip ev${m?.trust === "low" ? " low" : ""}`} title={title}>
            {m ? `${m.label}: ${fmt(m.value)}${m.unit ? ` ${m.unit}` : ""}` : id}
          </span>
        );
      })}
    </div>
  );
}

function StateChip({ g }: { g: GaitReview | null | undefined }) {
  const { label, tone } = reviewState(g);
  return <span className={`chip ${tone}`}>{label}</span>;
}

// The review card while there is no finished review: say why, and show the coach's note meanwhile.
function ReviewPending({ s }: { s: Session }) {
  const g = s.gaitReview;
  const why = !g ? "No side camera recorded this walk, so there is no gait review."
    : g.status === "waiting" ? "Waiting for the side camera's walk…"
      : g.status === "reviewing" ? "The coach is reviewing the walk…"
        : `The review failed${g.reason ? `: ${g.reason}` : ""}.`;
  return (
    <>
      {isPending(g) ? <div className="skeleton" aria-label="Review on its way"><span /><span /><span /><span /></div> : null}
      <p className="hint">{why}</p>
      {s.note && <p className="lead small">{s.note}</p>}
      {s.note && <p className="hint">The coach's note after this walk.</p>}
    </>
  );
}

function GameResults({ s }: { s: Session["summary"] }) {
  const pair = (o: { L: number | null; R: number | null } | null | undefined, unit = "") => (o ? `left ${fmt(o.L)}${unit} · right ${fmt(o.R)}${unit}` : null);
  const lane = (o: { L: [number, number]; R: [number, number] } | undefined) => (o && o.L[1] + o.R[1] > 0 ? `left ${o.L[0]}/${o.L[1]} · right ${o.R[0]}/${o.R[1]}` : null);
  const rows: [string, string | number | null | undefined][] = [
    ["Mode", s.shoeMode ? "shoe camera (feet.py)" : "lift sensor"],
    ["Time", s.wallSeconds !== undefined ? `${fmt(s.wallSeconds)} s (${s.seconds} s playing)` : `${s.seconds} s`],
    ["Steps", `${s.steps}${s.stepsByFoot ? ` (left ${s.stepsByFoot.L}, right ${s.stepsByFoot.R})` : ""}`],
    ["Pace at the end", s.cadence !== null ? `${s.cadence} steps/min` : null],
    ["Even left/right", s.asymmetryPct !== null && s.asymmetryPct !== undefined ? `${Math.max(0, 100 - s.asymmetryPct)}%` : null],
    ["Flowers stepped on", s.stompPct !== null ? `${s.stompPct}%` : null], ["Flowers per lane", lane(s.byLane?.flower)],
    ["Golden flowers", s.goldenPct !== null && s.goldenPct !== undefined ? `${s.goldenPct}%` : null], ["Petals", s.petals],
    ["Seeds avoided", s.seedAct === false || s.dodgePct === null ? null : `${s.dodgePct}%`], ["Seeds per lane", lane(s.byLane?.seed)],
    ["Shoe to flower", pair(s.placementCm, " cm")], ["Forward swing per step", pair(s.swingCm, " cm")],
    ["Lift timing (+ = late)", pair(s.timingS, " s")], ["Form", s.formPct !== null ? `${s.formPct}%` : null],
    ["Score", s.score], ["Rounds", s.rounds],
  ];
  return (
    <table className="kv">
      <tbody>
        {rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
          <tr key={k}><th>{k}</th><td>{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Measurements({ g }: { g: GaitReview }) {
  const groups = groupMetrics(g.metrics);
  return (
    <>
      {groups.map(({ key, name, rows }, n) => (
        <details key={key} className="group" open={n === 0}>
          <summary>{name} <span className="dim">· {rows.length}</span></summary>
          <table className="metrics">
            <thead><tr><th>Metric</th><th>Side</th><th>Value</th><th>Typical</th><th>Trust</th><th>Earlier</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={m.trust === "low" ? "low" : ""}>
                  <td>{m.label}</td><td>{sideName(m.side)}</td><td className="num">{fmt(m.value)} {m.unit}</td>
                  <td className="dim">{m.typical ?? ""}</td><td>{m.trust}</td><td className="num dim">{m.prev === null ? "" : fmt(m.prev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
      {g.withheld?.length ? (
        <details className="group">
          <summary>Not used <span className="dim">· the camera could not measure them reliably</span></summary>
          <ul className="plain">{g.withheld.map((w) => <li key={w.id}><code>{w.id}</code>: {w.reason}</li>)}</ul>
        </details>
      ) : null}
    </>
  );
}

export default function App() {
  const [data, setData] = useState<{ player: string; sessions: Session[]; live: boolean } | null>(null);
  const [picked, setPicked] = useState<string | null>(() => new URLSearchParams(location.search).get("session"));
  const [full, setFull] = useState<Record<string, Session>>({});   // /api/session/{id} rows: gait summary included

  useEffect(() => { loadSessions().then(setData); }, []);

  // A new walk shows up by itself; the walk on screen stays unless the page follows the latest one.
  useEffect(() => {
    if (!data?.live) return;
    const t = window.setInterval(() => {
      getJSON<Row[]>(`/api/sessions/${encodeURIComponent(data.player)}`)
        .then((rows) => setData((d) => (d ? { ...d, sessions: mergeRows(d.sessions, rows.map(toSession)) } : d)))
        .catch(() => {});
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [data?.live, data?.player]);

  const sessions = data?.sessions ?? [];
  const at = Math.max(0, sessions.findIndex((s) => keyOf(s) === picked));
  const row = sessions[at];
  const prevRow = sessions[at + 1];
  const current = row ? full[keyOf(row)] ?? row : undefined;
  const previous = prevRow ? full[keyOf(prevRow)] ?? prevRow : undefined;

  // The two compared walks need the full gait summary; a review on its way is fetched again until it is done.
  useEffect(() => {
    if (!data?.live) return;
    let stop = false;
    let t = 0;
    const fetchOne = (s: Session | undefined) => (s?.id ? getJSON<Row>(`/api/session/${encodeURIComponent(s.id)}`).then(toSession) : Promise.resolve(null));
    const tick = async () => {
      const [a, b] = await Promise.all([fetchOne(row), fetchOne(prevRow)]).catch(() => [null, null]);
      if (stop) return;
      setFull((f) => ({ ...f, ...(a ? { [keyOf(a)]: a } : {}), ...(b ? { [keyOf(b)]: b } : {}) }));
      if (a && isPending(a.gaitReview)) t = window.setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stop = true; window.clearTimeout(t); };
  }, [data?.live, row && keyOf(row), prevRow && keyOf(prevRow)]);

  const pick = (s: Session) => {
    setPicked(keyOf(s));
    const q = new URLSearchParams(location.search);
    if (s.id) q.set("session", s.id); else q.delete("session");
    if (data?.live) q.set("player", s.player);
    history.replaceState(null, "", `?${q}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!data || !current) return <main className="page"><p className="hint">Loading sessions…</p></main>;
  const { live } = data;
  const g = current.gaitReview;
  const done = g?.status === "done" && g.review ? g : null;
  const v = done?.review;
  const index = metricIndex(done?.metrics);
  const changes = previous ? compare(current, previous) : [];
  const next = suggestions(v?.nextSession);
  const latest = at === 0;
  let i = 1;   // entry stagger

  return (
    <main className="page">
      <header className="hero reveal" style={{ "--i": 0 } as CSSProperties}>
        <span className="eyebrow">{latest ? "Latest session" : "Earlier session"}</span>
        <h1>
          {current.player}'s walk <span className="dim">{date(current.ts)} · {time(current.ts)}</span>
        </h1>
        <p className="meta">
          <span>{duration(current.summary.wallSeconds ?? current.summary.seconds)} min</span>
          <span>{current.summary.steps} steps</span>
          <span className={current.verified ? "chip ok" : "chip"}>{current.verified ? "Verified walking" : "Not verified"}</span>
          <StateChip g={g} />
          {done?.dataQuality && <span className={`chip ${done.dataQuality.level === "poor" ? "bad" : ""}`}>Data quality {done.dataQuality.level}</span>}
          {!live && <span className="chip">Sample data: game server not reachable or no sessions yet</span>}
        </p>
        {live && (
          <p className="links">
            {current.id && <a href={`/report.html?id=${encodeURIComponent(current.id)}`} target="_blank" rel="noreferrer">Printable report</a>}
            <a href="/therapist.html" target="_blank" rel="noreferrer">Therapist panel</a>
            {!latest && <button type="button" className="link" onClick={() => pick(sessions[0])}>Latest walk</button>}
          </p>
        )}
      </header>

      <div className="bento">
        <Card cls="span-8" i={i++} eyebrow="AI gait review" title="Coach's read">
          {v ? (
            <>
              <p className="lead">{v.overview}</p>
              <p className="hint">{sourceLine(done)}</p>
              {done.dataQuality?.issues.length ? <ul className="plain hint">{done.dataQuality.issues.map((x) => <li key={x}>{x}</li>)}</ul> : null}
            </>
          ) : <ReviewPending s={current} />}
        </Card>

        <Card cls="span-4" i={i++} eyebrow="Next time" title="Focus">
          {v ? (
            <>
              <p className="lead">{v.focus.text}</p>
              {v.focus.why && <p className="hint">Why: {v.focus.why}</p>}
              <Evidence ids={v.focus.evidence} index={index} />
              {next.length > 0 && (
                <p className="suggest">
                  Suggested: {next.map((x) => `${x.label} ${x.value} ${x.unit}`).join(", ")}
                  {v.nextSession.why && <span className="dim"> ({v.nextSession.why})</span>}
                  <span className="hint block">Changes nothing until the therapist applies it in the panel.</span>
                </p>
              )}
              {v.cues.length > 0 && <ul className="cues">{v.cues.map((c) => <li key={c}>“{c}”</li>)}</ul>}
            </>
          ) : <p className="hint">The focus for next time comes with the review.</p>}
        </Card>

        {v && (
          <>
            <Card cls="span-7" i={i++} eyebrow="What we saw" title="Findings">
              {v.findings.length ? (
                <ul className="items">
                  {v.findings.map((f) => (
                    <li key={f.text}>
                      <span className="tag">{f.area}{f.side !== "none" ? ` · ${sideName(f.side)}` : ""} · confidence {f.confidence}</span>
                      <p>{f.text}</p>
                      <Evidence ids={f.evidence} index={index} />
                    </li>
                  ))}
                </ul>
              ) : <p className="hint">Nothing stood out in this walk.</p>}
            </Card>
            <Card cls="span-5" i={i++} eyebrow="Went well" title="Strengths">
              {v.strengths.length ? (
                <ul className="items">
                  {v.strengths.map((x) => <li key={x.text}><p>{x.text}</p><Evidence ids={x.evidence} index={index} /></li>)}
                </ul>
              ) : <p className="hint">No strengths named for this walk.</p>}
            </Card>
            {(v.gameVsGait.length > 0 || v.actComparison || v.trend) && (
              <Card cls="span-12" i={i++} eyebrow="Putting it together" title="The game and the walk">
                <div className="cols">
                  {v.gameVsGait.length > 0 && (
                    <div>
                      <h3>Game and gait</h3>
                      <ul className="items">{v.gameVsGait.map((x) => <li key={x.text}><p>{x.text}</p><Evidence ids={x.evidence} index={index} /></li>)}</ul>
                    </div>
                  )}
                  {v.actComparison && <div><h3>Walking, flowers, seeds</h3><p>{v.actComparison}</p></div>}
                  {v.trend && <div><h3>Compared with earlier walks</h3><p>{v.trend}</p></div>}
                </div>
              </Card>
            )}
            <Card cls="span-12" i={i++} eyebrow="Notes" title="For each reader">
              <div className="notes">
                <div><h3>For the player</h3><p>{v.playerFeedback}</p></div>
                <div><h3>For the parent</h3><p>{v.parentNote}</p></div>
                <div><h3>For the therapist</h3><p className="mono">{v.therapistNote}</p></div>
                <div><h3>Next recording</h3><p>{v.nextRecording}</p></div>
              </div>
            </Card>
          </>
        )}

        <Card cls="span-12" i={i++} eyebrow="Since last session" title={previous ? `Compared with ${date(previous.ts)}` : "First session"}>
          {changes.length ? (
            <div className="tiles">
              {changes.map(({ metric, now, delta, improved }) => (
                <div className="tile" key={metric.label} title={metric.lowTrust ? "Less certain: it depends on the leg farther from the side camera." : undefined}>
                  <span className="tile-label">{metric.label}{metric.lowTrust ? " *" : ""}</span>
                  <span className="tile-value">
                    {show(now)}
                    <small>{metric.unit}</small>
                  </span>
                  <span className={improved === null ? "delta" : improved ? "delta up" : "delta down"}>
                    {delta === null ? "no data" : `${delta > 0 ? "+" : ""}${delta} ${delta === 0 ? "same" : improved === null ? "change" : improved ? "better" : "lower"}`}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="hint">The first walk sets the starting point.</p>}
          {changes.some((c) => c.metric.lowTrust) && <p className="hint">* Less certain: it depends on the leg farther from the side camera.</p>}
        </Card>

        {done && (
          <Card cls="span-12" i={i++} eyebrow="Measurements" title="Every number the review used">
            <Measurements g={done} />
          </Card>
        )}

        <Card cls="span-5" i={i++} eyebrow="Game" title="Game results">
          <GameResults s={current.summary} />
        </Card>
        <Card cls="span-7 replay" i={i++} eyebrow="Replay" title="This session">
          <div className="videos">
            <Video label="Game" src={current.videos.game} />
            <Video label="Side view" src={current.videos.gait} />
          </div>
        </Card>

        <Card cls="span-12 history" i={i++} eyebrow="History" title="Sessions">
          <ol className="history-list">
            {sessions.map((s, idx) => (
              <li key={keyOf(s)} className={idx === at ? "selected" : ""}>
                <button type="button" className="session" onClick={() => pick(s)} aria-current={idx === at}>
                  <div className="row">
                    <span className="when">{date(s.ts)} <span className="dim">{time(s.ts)}</span></span>
                    {idx === 0 && <span className="chip ok">Latest</span>}
                    {!s.verified && <span className="chip">Not verified</span>}
                    <StateChip g={s.gaitReview} />
                    <span className="stats">
                      {duration(s.summary.seconds)} · {s.summary.steps} steps · {show(s.summary.cadence)} spm · form {show(s.summary.formPct, "%")}
                    </span>
                  </div>
                  <p className="note">{s.gaitReview?.status === "done" ? s.gaitReview.review?.focus?.text && `Focus: ${s.gaitReview.review.focus.text}` : s.note}</p>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <p className="hint footer">Wellness observations, not a medical assessment.</p>
    </main>
  );
}

// Fresh list rows win, but a fuller row fetched earlier keeps its place until the list catches up.
function mergeRows(old: Session[], fresh: Session[]): Session[] {
  const known = new Map(old.map((s) => [keyOf(s), s]));
  const merged = fresh.map((s) => ({ ...known.get(keyOf(s)), ...s }));
  for (const s of old) if (!merged.some((m) => keyOf(m) === keyOf(s))) merged.push(s);
  return merged.sort((a, b) => b.ts - a.ts);
}
