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

## Demo accounts (team only)

The eight library personas have saved citizen accounts. **These logins are intentionally not shown anywhere in the app** (no persona list on the citizen sign-in screen, no case picker on the demo stage): sign in with them on the phone like any citizen would. All people, documents and numbers are fictional; the passwords are demo-only.

| Persona | Who they are | Scenario it shows | Document number (sign-in) | Password |
|---|---|---|---|---|
| Giulia Ferraro | Italian master's student in Madrid (24) | Passport chip + face check, basic level in minutes; an officer approves the advanced level live (video 0:40–2:00) | `DEMO-P-IT-482913` | `giulia-demo` |
| Daniel Mwangi | Kenyan master's student with a TIE (23) | Non-EU student, TIE chip + face check from the phone instead of an office appointment | `DEMO-TIE-Y0042719-K` | `daniel-demo` |
| Rafael Medina | The neighbour: 80, no smartphone, helped by his daughter | Assisted mode on Lucía's phone; he does the face check himself (video 3:40–4:20) | `DEMO-TIE-X0019583-R` | `rafael-demo` |
| Noah Becker | German minor (16) registering with his mother | Mother signs in with her German eID and confirms him; an officer confirms the link | `DEMO-P-DE-C01X58` | `noah-demo` |
| Yusuf Haddad | International protection applicant with a red card (31) | Policy proposal: no chip, straight to a video call with an officer | `DEMO-RC-0117-H` | `yusuf-demo` |
| Ivo Petrov (claimed) | Deepfake attempt: someone else's passport, synthetic face video | Liveness fails, the engine stops it and an officer refuses with a reason (video 2:50–3:40) | `DEMO-P-BG-391027` | `ivo-demo` |
| Hana Kovač (claimed) | Fake document: cloned and edited passport chip | Chip signature invalid, high risk; the officer refuses with "Chip signature invalid" | `DEMO-P-HR-005521` | `hana-demo` |
| Lin Wei | Engineer with a TIE who moved last month (29) | Refused for "Residence not found", she corrects her padrón, presses "I have corrected it" and is approved | `DEMO-TIE-Z0088104-W` | `linwei-demo` |

Sign-in ignores letter case and spaces in the document number. Anyone can also press **Create account** and register a new (fictional) person: the app assigns a `DEMO-…` sign-in number on the spot, and every simulated check passes for those accounts. **Reset all demo data** removes every account created this way, signs the phone out and puts the eight personas back at the start.

### How to record each case

1. Open the demo stage (`/#/demo`) at 1440 × 900, full screen, and press **Reset all demo data** before each take.
2. Sign the officer in on the laptop frame (Laura Navarro).
3. On the phone frame, sign in with the persona's document number and password from the table above (type them off-camera or crop the first seconds), then follow the route assistant → verification → status.
4. The laptop updates live: open the case from the queue and approve, request information, complete the video call or refuse with a reason, depending on the scenario.
5. Press **Sign out** in the phone header before the next persona. For the closing numbers switch the right screen to the dashboard (simulated figures).


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

The whole suite in one go (dev server on PORT, review specs against a preview): `REVIEW_BASE=http://localhost:4180 npx playwright test`. `REVIEW_BASE`, `REVIEW_OUTPUT` and `REVIEW_SHOTS` let a second copy run on other ports and folders.
