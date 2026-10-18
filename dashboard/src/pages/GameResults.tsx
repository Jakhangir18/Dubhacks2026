import Panel from "../components/Panel";

export default function GameResults() {
  return (
    <div className="grid">
      <Panel
        title="Game results"
        planned={["Flowers hit %, seeds dodged %, form %", "Cadence over the session", "Rewards earned"]}
      />
      <Panel title="High steps" planned={["Average lift height, left vs right, against the target line"]} />
      <Panel title="Act breakdown" wide planned={["Results per act: walk home, garden, seeds"]} />
    </div>
  );
}
