import { useState } from "react";
import GameResults from "./pages/GameResults";
import Gait from "./pages/Gait";
import Overview from "./pages/Overview";
import Progress from "./pages/Progress";

const TABS = {
  Overview: <Overview />,
  "Game results": <GameResults />,
  Gait: <Gait />,
  Progress: <Progress />,
} as const;
type Tab = keyof typeof TABS;

export default function App() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <>
      <header>
        <h1>Session dashboard</h1>
        <nav>
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main>{TABS[tab]}</main>
    </>
  );
}
