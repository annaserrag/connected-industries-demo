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

## Citizen accounts (team only)

The eight library personas have saved citizen accounts. **These logins are intentionally not shown anywhere in the app**: sign in on `/#/citizen` with **Applicant number and password** like any citizen would. All people, documents and numbers are fictional (DNI/NIE-shaped numbers carry a deliberately wrong check letter, so they fail the real check-letter test); the passwords are for the prototype only.

| Persona | Who they are | Scenario it shows | Applicant number (sign-in) | Password |
|---|---|---|---|---|
| Giulia Ferraro | Italian master's student in Madrid (24) | Passport chip + face check, basic level in minutes; an officer approves the advanced level live (video 0:40–2:00) | `YB4829137` | `giulia-demo` |
| Daniel Mwangi | Kenyan master's student with a TIE (23) | Non-EU student, TIE chip + face check from the phone instead of an office appointment | `Y8042719P` | `daniel-demo` |
| Ernesto Medina | The neighbour: 80, no smartphone, helped by his daughter | Assisted mode on Lucía's phone: helper form, hand-over message in large text, one face retry for reflections, his own mobile for the answer, and Lucía's last screen without the result (video 3:40–4:20) | `X9019583W` | `rafael-demo` |
| Noah Becker | German minor (16) registering with his mother | Mother signs in with her German eID and confirms him; an officer confirms the link | `C01X58RT2` | `noah-demo` |
| Yusuf Haddad | International protection applicant with a red card (31) | Policy proposal: no chip, straight to a video call with an officer | `Y9117004D` | `yusuf-demo` |
| Ivo Petrov (identity claimed by an impostor) | Deepfake attempt: someone else's passport, synthetic face video | Liveness fails, the engine stops it and an officer refuses with a reason (video 2:50–3:40) | `391027844` | `ivo-demo` |
| Hana Kovač (identity on a forged passport) | Fake document: cloned and edited passport chip | Chip signature invalid, high risk; the officer refuses with "Chip signature invalid" | `205521963` | `hana-demo` |
| Lin Wei | Engineer with a TIE who moved last month (29) | Refused for "Residence not found", she corrects her padrón, presses "I have corrected it" and is approved | `Z9088104B` | `linwei-demo` |

Sign-in ignores letter case and spaces. Anyone can also choose **Create an account** and register a new (fictional) person: the platform assigns an applicant number on the spot in a realistic shape (DNI 8 digits + letter, TIE / NIE / red card X|Y|Z + 7 digits + letter — always with a wrong check letter —, passport 2 letters + 7 digits, EU eID 9 alphanumerics), and every check passes for those accounts.

## Staff accounts

Staff sign in at `/#/officer` like on the real Cl@ve gateway, with one of two method cards: **Electronic certificate** (pick a certificate, then type its PIN) or **User and password**. For recording, the sign-in page also shows a **Demo access** box with Laura Navarro's certificate PIN and her user and password (all fictional). Everything is fictional: the DNI numbers below carry a deliberately wrong check letter, so they can never belong to a real person. Every attempt goes to the audit trail with the method used, never the PIN or password.

Certificates (the picker lists all five):

| Holder | Certificate | PIN | Expected outcome |
|---|---|---|---|
| Laura Navarro (`50731842J`) | Public employee certificate (cryptocard), Tax Agency, valid until 30 Jun 2028 | `2580` | First time: job details form, then the console. Afterwards straight to the console |
| Javier Prieto (`29640157H`) | Electronic DNI (DNIe), valid until 14 Feb 2029 | `1357` | First time: job details form (he picks organisation, office and post himself), then the console |
| Marta Gil Herrero (`71385096A`) | Public employee certificate (cryptocard), Government Delegation, valid until 2 Nov 2027 | `4826` | First time: job details form, then the console |
| Diego Romero (`33918274C`) | Personal certificate, valid until 20 May 2027 | `9031` | Refused: not staff of a Cl@ve registration authority |
| Laura Navarro (`50731842J`) | Public employee certificate, expired 30 Jun 2025 | `2580` | Refused: certificate expired (shown only after the right PIN) |

A wrong PIN gives a generic "The PIN is not correct" with the attempts left, and reveals nothing about the certificate (not even that it expired). After three wrong PINs the field pauses for 30 seconds; it never locks for good.

Staff users (second card):

| User ID | Password | Expected outcome |
|---|---|---|
| `lnavarro` | `Navarro-2026` | Laura Navarro: job details the first time, then the console |
| `jprieto` | `Prieto-2026` | Javier Prieto: job details the first time, then the console |
| `mgil` | `GilHerrero-2026` | Marta Gil Herrero: job details the first time, then the console |
| `dromero` | `Romero-2026` | Refused: not staff of a Cl@ve registration authority |

A wrong user ID or password always gives the same message ("The user or password is not correct"). The user ID ignores letter case.

Personnel number (NRP) to type on the first sign-in: the officer's own DNI number and letter, `A`, and a 4-digit body code. Any 4-digit body code works, but the DNI part must be the officer's own:

| Officer | NRP |
|---|---|
| Laura Navarro | `50731842JA0611` |
| Javier Prieto | `29640157HA0384` |
| Marta Gil Herrero | `71385096AA0952` |

An NRP built on a DNI with the real check letter is refused, like any real-looking number. Job details are saved per officer, so the second sign-in (by either method) goes straight to the console.

### How to record each case

1. Delete the data in this browser (`/#/privacy`) before each take.
2. Window 1 (1440 × 900): `/#/officer`, sign the officer in. Window 2 (phone size, or a phone-sized window): `/#/citizen`.
3. Sign in with the persona's applicant number and password from the table above (type them off-camera or crop the first seconds), then follow route assistant → verification → status.
4. The staff window updates live: open the case from the queue and approve, request information, complete the video call or refuse with a reason, depending on the scenario.
5. Press **Sign out** in the citizen header before the next persona.
6. **Hard cases with any account** (cases 2, 6, 7 and 8): on the verification screen, open **Demo: simulate a result** at the bottom and pick *Chip cannot be read* (two failed reads, then the case moves to a video call), *Chip signature invalid* or *Liveness check fails* (high risk, an officer refuses with a reason the citizen sees and can appeal) or *Data does not match* (refuse with "Residence not found", the citizen presses "I have corrected it" and the officer re-approves). Leave it on *No failure* for a normal run.
7. **Minor** (case 4): on the last assistant question choose *I am registering a minor in my care* and fill in the minor's name and age. **Red card** (case 5): sign up with a non-EU country and *Red card*. Route B, the Fallback video call for foreigners, the red card and assisted mode all carry the tag *Proposed rule, not yet in force*.
8. Staff menu: **Appeals** and **Advanced-level review** list those cases on their own. An approved citizen sees **Download receipt (PDF)** (marked as a prototype with no official value) and **Open Cl@ve Móvil** (explains that the prototype opens no app). For the closing numbers open `/#/dashboard` (Service statistics; its weekly numbers are invented, as disclosed on About).

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
