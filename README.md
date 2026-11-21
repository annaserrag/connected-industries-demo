# Get your Cl@ve — demo prototype

Student prototype (IE University, Smart Cities & E-Government, Group 10). Not an official Government of Spain service.
Everything is simulated: people, documents, AI engine, eIDAS, chip read and face check.

## Run it

Needs Node 20+.

```
npm run demo
```

Then open http://localhost:4173. The demo stage is at http://localhost:4173/#/demo.

Live sync works between tabs of the same browser (BroadcastChannel + localStorage), so record the citizen and officer views in one browser — the demo stage does this for you.

## Structure

- `src/contract/` — types, seed cases, rules, rejection reasons, reference-sheet figures (single source of truth)
- `src/core/` — store, simulated engine, cross-tab sync, routing, audit log
- `src/citizen/` — screens 1–5 · `src/officer/` — screens 6–8 · `src/dashboard/` — screen 9 · `src/ui/` — design system + demo stage
- `docs/PLAN.md` — the project plan extract the app is built from

## Tests

```
npx playwright install chromium
npx playwright test                                   # builders' suites (starts a dev server)
npm run build && npx vite preview --port 4180 &        # then:
npx playwright test --config tests/review/review.config.ts   # independent review suite
PORT=4180 npx playwright test tests/integration
```
