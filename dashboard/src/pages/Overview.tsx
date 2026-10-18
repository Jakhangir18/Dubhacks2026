import Panel from "../components/Panel";

export default function Overview() {
  return (
    <div className="grid">
      <Panel
        title="Session summary"
        wide
        planned={[
          "Headline stats for the latest session: duration, steps, cadence",
          "Plain-language summary written for the parent or therapist",
          "Coach note from the session",
        ]}
      />
      <Panel
        title="Highlights"
        planned={["Best result this session", "Area to focus on next time", "Walk clip with QR code (from /api/clip)"]}
      />
      <Panel title="Player" planned={["Player picker (GET /api/players)", "Therapist limits for this player (GET /api/limits/{name})"]} />
    </div>
  );
}
