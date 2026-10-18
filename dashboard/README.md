# dashboard

One-page results dashboard (React + TypeScript). Shows the last recorded walking session: replay, the AI review or coach
note, change since the previous session, and history. Data comes from the game server (`/api/sessions/{player}`,
`/api/session/{id}`); `?player=NAME` picks the player, else the first one. With no server or no sessions it shows the
sample sessions in `src/seed.ts`, labelled. After `npm run build`, the game server serves it at `/dashboard/`.

```bash
cd dashboard && npm install
npm run dev        # http://localhost:5173, /api is proxied to the game server on :8000
npm run build      # typecheck + production build
npm test           # checks the since-last-session comparison
```


Open item: replay videos are not linked to sessions yet.
