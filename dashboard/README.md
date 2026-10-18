# dashboard

React + TypeScript skeleton for the results dashboard. Layout and placeholders only; no data is fetched yet.

```bash
cd dashboard && npm install
npm run dev        # http://localhost:5173, /api is proxied to the game server on :8000
npm run build      # typecheck + production build
```

Tabs: Overview (session summary), Game results, Gait, Progress (previous sessions). Each panel lists its planned features.

Open items:
- Gait data has no server endpoint yet; `gait.py` writes CSV and video under `out/`.
- Confirm the `Session` row fields in `src/types.ts` against `server/store.py`.
