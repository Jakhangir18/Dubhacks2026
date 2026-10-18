# dashboard

One-page results dashboard (React + TypeScript). Shows the last recorded walking session: replay, AI summary
placeholder, change since the previous session, and history. Data is seeded in `src/seed.ts`; nothing is fetched yet.

```bash
cd dashboard && npm install
npm run dev        # http://localhost:5173, /api is proxied to the game server on :8000
npm run build      # typecheck + production build
npm test           # checks the since-last-session comparison
```


Open items:
- Gait data has no server endpoint yet; `gait.py` writes CSV and video under `out/`.
- Confirm the `Session` row fields in `src/types.ts` against `server/store.py`.
