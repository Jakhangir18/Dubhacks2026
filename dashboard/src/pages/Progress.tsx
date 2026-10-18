import Panel from "../components/Panel";

export default function Progress() {
  return (
    <div className="grid">
      <Panel
        title="Progress over time"
        wide
        planned={["Trend charts: cadence, form %, lift height, gait asymmetry", "Compare to the player's own baseline"]}
      />
      <Panel
        title="Previous sessions"
        wide
        planned={["Table of past sessions (GET /api/sessions/{name}): date, duration, key stats", "Open a past session in the other tabs"]}
      >
        <table>
          <thead>
            <tr><th>Date</th><th>Duration</th><th>Steps</th><th>Cadence</th><th>Form</th></tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i} className="placeholder-row"><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
