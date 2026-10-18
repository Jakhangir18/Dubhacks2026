import Panel from "../components/Panel";

// Source: gait.py GaitTracker (side camera). A server endpoint to store and serve this data does not exist yet.
export default function Gait() {
  return (
    <div className="grid">
      <Panel
        title="Gait summary"
        planned={["Cadence, walking direction, foot strikes per leg", "Stride time per leg", "Left/right asymmetry"]}
      />
      <Panel title="Knee angle" planned={["Peak knee bend per leg", "Knee angle over time (from the gait CSV)"]} />
      <Panel title="Side-view video" wide planned={["Annotated clip from gait.py with the skeleton overlay", "Step markers on a timeline"]} />
    </div>
  );
}
