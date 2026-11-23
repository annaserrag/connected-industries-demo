# Get your Cl@ve

Student prototype (IE University, Connected Industries, Smart Cities & E-Government, Group 10). Not an official Government of Spain service.

The platform looks and behaves like a real Spanish e-government service (style inspired by clave.gob.es and the Cl@ve sign-in gateway, with no official logos). There is **no demo mode** and no "Simulated" labels on the screens: everything that is simulated (AI engine, eIDAS, chip read, face check, residence check, staff certificates, the statistics page numbers), the two policy proposals and the open assumptions are listed once, on **About this platform** (`/#/about`). Every page has the footer line "© 2026 Get your Cl@ve · Academic prototype of IE University".

## Run it

Needs Node 20+.

```
npm run demo
```

Then open http://localhost:4173. Fonts (Nunito Sans, Merriweather) are bundled with the app; nothing is loaded from the internet at runtime.

**Citizen and staff side by side:** open http://localhost:4173/#/citizen and http://localhost:4173/#/officer in two windows of the *same browser* (live sync uses BroadcastChannel + localStorage). To start over, use **Privacy → Delete the data in this browser** (`/#/privacy`): it removes accounts created on the form, signs everyone out and puts the eight personas back at the start.

Pages: `/` home · `/citizen` sign in / create account (gateway-style method cards) · `/officer` staff console · `/dashboard` service statistics (linked from the menu only) · `/help` · `/about` · `/accessibility` · `/legal` · `/privacy`.

## Public URL (Hugging Face Space)

The app is a static site (relative paths, hash routing), so it runs as a Hugging Face **static Space** with no server.

1. Create a token with **write** access at huggingface.co/settings/tokens.
2. From the repo folder:

   ```
   HF_TOKEN=hf_xxx HF_SPACE=<your-user>/get-your-clave npm run deploy:hf
   ```

   The script builds the app, creates the Space (public, SDK "static") if it does not exist, and uploads the build. Run it again after every change to redeploy. The token is read from the environment only; it is never saved to disk or committed.
3. Share `https://huggingface.co/spaces/<your-user>/get-your-clave`. For the side-by-side recording, use the direct link shown at the end of the script (`https://<your-user>-get-your-clave.static.hf.space`), so both windows share the same browser storage: `…static.hf.space/#/citizen` and `…static.hf.space/#/officer`.

## How the prototype decides

No result is scripted per person. Each case ends where the general rules of the plan take it, from:

1. what the applicant types (account data, answers, uploads, contact details);
2. what the **simulated registers** return for that document: whether its chip can be read, whether the chip signature is valid, the data stored in the chip, the expiry date and the residence record;
3. what the **simulated camera** sees on each attempt, chosen on the camera screen: *Real person*, *Reflections or low light* or *Synthetic video*;
4. the rules (two failed chip reads → video call; two failed face checks → video call offered; invalid chip signature or printed data ≠ chip → officer; residence not found or different → officer; minor or red card → always an officer; otherwise automatic basic level, and advanced level to review on routes B and C);
5. an officer's decision. Only an officer refuses, always with a reason from the closed list (REJ-01…08), and a review request is decided by a different officer.

Any document that is not in the registers behaves as a genuine, readable document with a matching residence record, so a person typed in from scratch (Giulia) is approved by the rules if nothing else fails.

## Citizen accounts (team only)

These people are preloaded **without having started**: sign in on `/#/citizen` with *Applicant number and password* and do the process live. Giulia is not preloaded: create her with **Create an account** during the demo. All people, documents and numbers are fictional; DNI/NIE-shaped numbers carry a deliberately wrong check letter.

| Case | Person | Applicant number | Password | What the registers say | What to do to show the case |
|---|---|---|---|---|---|
| GYC-01 | Giulia Ferri, 24, Italy (create her) | type `CA48213KF` (EU eID), born 2002-04-18, expiry 2031-03-14 | choose one, e.g. `giulia-demo` | not in the registers: genuine eID, matching residence | Route A, eID login, consent, SMS `123456` → approved basic automatically |
| GYC-02 | Kenji Mori, 26, Japan | `Y4126021A` | `kenji-demo` | TIE chip cannot be read | Read chip twice → video call → officer starts the call and approves basic; advanced goes to review |
| GYC-03 | Ernesto Navarro, 80, Spain | `05218734H` | `ernesto-demo` | DNI, normal | "I am helping someone" (helper Marta Navarro, her mobile `+34 600 000 102`), camera *Reflections* first, then *Real person*; his own mobile `+34 600 000 002` → basic now, advanced to review; Marta sees only the end-of-session screen |
| GYC-04 | Laura Ruiz → her son Mateo Ruiz, 16, Argentina | `X9318254H` | `laura-demo` | TIE each, normal | "A child I am responsible for", upload a proof photo (one edge cut), Mateo's TIE `X9318277H` → officer asks for a new photo → Laura uploads it → officer approves |
| GYC-05 | Daniel Herrera, 34, Venezuela | `VE1441730` | `daniel-demo` | passport normal; the red card has no register | Document "Red card", passport chip + face, upload the red card (number `DEMO-0005`) → an officer always checks it and approves |
| GYC-06 | Applicant X with Ana Costa's passport | `CB2918470` | `applicantx-demo` | genuine passport | Camera *Synthetic video* twice → "Come back later" → high risk → officer refuses REJ-07. With *Real person* the same passport is approved: it is the camera, not the person |
| GYC-07 | Rafael Duarte, 37, Brazil | `Y7350418F` | `rafael-demo` | chip signature invalid; chip says DUARTE SOUZA, 1988-03-14 vs printed DUARTE, 1988-04-13 | Read chip → a person reviews → officer refuses REJ-06 |
| GYC-08 | Valentina Rojas Gómez, 27, Colombia | `Z1846203M` | `valentina-demo` | residence record has only "ROJAS" | All checks pass but the residence name differs → officer Vega refuses REJ-05 → she asks for a review with a passport photo → Vega cannot decide it → officer Ortiz approves |

The SMS code is always `123456` (shown on screen as a demo code). Sign-in ignores letter case and spaces.

## Staff accounts

Staff sign in at `/#/officer` with **Electronic certificate** (pick it, then type the PIN) or **User and password**. The sign-in page shows a *Demo access* box with these fictional credentials.

| Officer | Certificate PIN | User | Password | Role in the demo |
|---|---|---|---|---|
| Lucía Vega | `2580` | `lvega` | `Vega-2026` | First decisions (queue, video calls, refusals) |
| Andrés Ortiz | `1357` | `aortiz` | `Ortiz-2026` | Reviews (appeals must be decided by a different officer) |
| Marta Gil Herrero | `4826` | `mgil` | `GilHerrero-2026` | Another authorised officer |
| Diego Romero | `9031` | `dromero` | `Romero-2026` | Refused: not staff of a registration authority |

The first sign-in asks for job details; the personnel number (NRP) is the officer's own DNI number and letter + `A` + any 4 digits (see the officer's profile for the DNI). A wrong PIN or password never says which part was wrong; three wrong PINs pause the field for 30 seconds.

### How to record each case

1. Delete the data in this browser (`/#/privacy`) before each take.
2. Window 1 (1440 × 900): `/#/officer`, sign in as Lucía Vega. Window 2 (phone size): `/#/citizen`.
3. Sign in with the person's applicant number and password (or create Giulia), then follow the route assistant → consent → verification → contact and SMS → review → status.
4. The staff window updates live: open the case from the queue, *Appeals* or *Advanced-level review* and act (start the video call, approve, request information, or reject with a reason).
5. For a review (GYC-08), sign out and sign in as Andrés Ortiz.
6. Route B, C-assisted, the red card and the video call for foreigners carry the tag *Proposed rule, not yet in force*.

## Structure

- `src/contract/` — types, seed cases, rules, rejection reasons, reference-sheet figures (single source of truth)
- `src/core/` — store, simulated engine, cross-tab sync, routing, audit log
- `src/citizen/` — home, sign-in/up, screens 2–5 and the info pages (`src/citizen/info/`) · `src/officer/` — screens 6–8 · `src/dashboard/` — screen 9 · `src/ui/` — design system (tokens, kit, `GovHeader` / `GovFooter` site chrome, gateway-style cards)
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
