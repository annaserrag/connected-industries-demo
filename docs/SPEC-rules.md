# Get your Cl@ve — rules-driven prototype (spec v3)

Source of truth for behaviour: the group's project plan (case library GYC-01…08, message bank, rejection list).
Plain-text copy for builders: `/tmp/claude-0/-home-claude/972a25e8-7708-58b1-9ad6-57a1a06e7d96/scratchpad/plan.txt`
(sections 2 = cases, 3 = message bank, 4 = accessibility, 5 = AI assistant). Never commit that file.

## 0. The one principle

**No outcome is scripted per person.** What a case ends in comes only from:

1. what the applicant types (sign-up data, answers, uploads, contact details),
2. what the *simulated outside world* returns for that data (document registry = the chip, residence registry),
3. what the *simulated camera* sees on each attempt (chosen on the camera screen),
4. the general rules below (Roberto's table as written in the plan),
5. what an officer decides (only an officer refuses, always with a reason from the closed list).

The old `simulation.attempts` scripts, `SIM_FAILURES` and the "Demo: simulate a result" panel are removed.

## 1. Simulated outside world — `src/contract/world.ts`

```ts
interface PersonData { givenNames: string; surnames: string; dateOfBirth: string /* YYYY-MM-DD */ }
interface ChipRecord { readable: boolean; signatureValid: boolean; data: PersonData; expiry: string }
interface DocumentRecord { type: DocumentType; number: string; nationality: string; chip: ChipRecord | null /* null = no chip */ }
interface ResidenceRecord { data: PersonData; municipality: string }
DOCUMENT_REGISTRY: Record<string /* normalised number */, DocumentRecord>
RESIDENCE_REGISTRY: Record<string /* normalised number */, ResidenceRecord | null /* null = no record */>
lookupDocument(typed: TypedDocument): DocumentRecord     // registry hit, else DEFAULT: chip readable, signature valid, chip data = typed data, expiry = typed expiry; RED_CARD/NIE_PAPER → chip null
lookupResidence(docNumber, typed: PersonData): ResidenceRecord | null  // registry hit (may be null), else DEFAULT: a record equal to the typed data, municipality 'Madrid'
```

The defaults are a stated assumption (About page): *for any other fictional document, the simulated registers answer as a genuine, readable document and a matching residence record.* So a brand-new account (e.g. Giulia typed in live) is approved by the rules if nothing else fails.

Registry entries (demo data, only world facts, never outcomes):

| Case | Document (fictional) | World facts |
|---|---|---|
| GYC-02 Kenji Mori, 26, Japanese | TIE | chip **not readable** (damaged / blocked) |
| GYC-05 Daniel Herrera, 34, Venezuelan | passport (+ red card typed in the flow) | normal |
| GYC-06 Ana Costa, 41, Portuguese | passport | normal, genuine (the attack comes from the camera) |
| GYC-07 Rafael Duarte, 37, Brazilian | TIE | chip readable, **signature invalid**, chip data name/DOB **differ** from printed (e.g. chip `DUARTE SOUZA, RAFAEL 1988-03-14` vs printed `DUARTE, RAFAEL 1988-04-13`) |
| GYC-08 Valentina Rojas Gómez, 27, Colombian | TIE | residence record surnames **`ROJAS`** only |
| GYC-04 Mateo Ruiz 16 / Laura Ruiz 44, Argentine | TIE each | normal |
| GYC-03 Ernesto Navarro, 80, Spanish | DNI (wrong check letter) | normal |

All DNI/NIE-shaped numbers keep a deliberately wrong check letter (`fictionalDniNie`). Sign-up refuses any DNI/NIE with a valid letter (existing rule).

## 2. Session inputs stored on the case

```ts
case.session = {
  route: 'A'|'B'|'C'|'F'|'X' ,                // F = Fallback, X = red card / NIE paper
  who: 'self'|'helping'|'child', nfc: 'yes'|'no'|'unsure'|null, euEid: 'yes'|'no'|'unsure'|null,
  consents: { face?: boolean; residence?: boolean; declined?: boolean; at?: string },
  chipReads: Array<'ok'|'failed'>,            // one entry per "Read chip" press
  faceAttempts: CameraInput[],               // one per face-check attempt (route B/X/guardian)
  videoAttempts: CameraInput[],              // DNI video attempts (route C)
  helper?: { name: string; relation: 'family'|'friend'|'support' },
  minor?: { givenNames, surnames, dateOfBirth, document: TypedDocument },
  guardianChecks?: 'passed',                 // guardian's own chip + face (does not register her)
  uploads: { proof?: Upload; redCard?: Upload & { number: string; expiry: string }; appeal?: Upload; info?: Upload },
  passport?: TypedDocument,                  // route X: the passport whose chip is read
  contact?: { mobile: string; email?: string; smsConfirmed: boolean },
  fallback?: { offered: 'chip'|'face'|'no_nfc'|'consent'|'no_passport'; joined: boolean; comeBackLater?: boolean },
  videoCall?: { state: 'waiting'|'live'|'ended'; officerId?: string; startedAt?: string },
  confirmedReview?: boolean,                 // MSG-AI-04 box ticked
}
type CameraInput = 'person' | 'reflections' | 'synthetic'
type Upload = { name: string; dataUrl: string /* small image, ≤ 1.5 MB, stored in state */; at: string }
```

Camera screen: a neutral silhouette frame (never a real person) + a small control **"Cámara simulada: qué hay delante"** with three options: *Persona real* (default), *Reflejos o poca luz*, *Vídeo sintético*. It is an input, not an outcome.

## 3. Checks computed by the engine — `src/core/engine.ts`

| Check | Computed from |
|---|---|
| `eidas_login` (A) | typed data returned by the mock national eID page = pass |
| `chip_read` (B, X, guardian, minor) | last `chipReads` entry; read result = `chip.readable` |
| `chip_signature` | `chip.signatureValid` |
| `printed_vs_chip` | typed (printed) name/surnames/DOB vs chip data → list of differing fields |
| `document_validity` | expiry (chip expiry, else typed) ≥ today |
| `liveness` / `face_match` | camera input of the last face attempt: person → pass (scores 0.93–0.97 from a hash of the doc number); reflections → liveness incomplete (no score) → retry; synthetic → liveness fail 0.2x, face match 0.6x. Scores always shown with "valores simulados". |
| `dni_video` (C) | last `videoAttempts`: person → pass; reflections → retry (MSG-VER-06); synthetic → fail |
| `residence` | `lookupResidence` vs typed data: match / mismatch (fields) / not found. Skipped when consent not given (then officer). Not run on route X (replaced by card check note). |
| `guardian_link` | proof uploaded → `pending_officer` always |
| `red_card` | card uploaded → `pending_officer` always |
| `officer_video` | video call state |

## 4. Decision rules (in order; first match wins). Key rule: the platform may approve; **only an officer refuses or revokes**, always with a REJ reason, and the citizen can always ask for a review.

1. **Consent declined** → no checks; MSG-CON-06 (Volver · Videollamada). Video call = Fallback.
2. **Chip read failed twice** (route B/X) → status 3 + MSG-VER-04 / MSG-FALL-01, `fallback.offered='chip'`. Queue tier P5 video call, risk Medium, AI reason "Chip could not be read twice; document integrity not verified". Officer: Start video call → Approve basic level → status 4B (advanced queued to Advanced review).
3. **NFC = No**, or document "No lo sé" → Fallback (MSG-RA-07F).
4. **Face check failed twice** (two attempts not passing) → status 3 + MSG-FALL-01 (`fallback.offered='face'`). If the citizen presses *Volver más tarde* (or never joins), the case waits for an officer: risk **High** when any attempt was synthetic (AI reason "The live-person check failed on every attempt and the face match stayed low. The document itself is genuine."), Medium otherwise. Never auto-refused.
5. **Chip signature invalid or printed≠chip** → officer, risk High, citizen sees MSG-VER-07 + status 2. No score, no "fraud" word to the citizen. AI reason names the differing fields.
6. **Document expired** → officer, risk Medium, suggested REJ-01.
7. **Residence not found** → officer, Medium, suggested REJ-04. **Residence mismatch** → officer, Medium, discrepancy table, suggested REJ-05.
8. **Minor** (`who='child'`) → always officer (proof check), flag "Minor: proof of parental authority to check", Medium. Officer usually *Request more information* first (MSG-COR-01 template).
9. **Route X** (red card / NIE paper) → always officer, flag "Red card cannot be verified automatically; passport chip and face match passed", Medium, tag Proposed rule.
10. **All passed**: route A → auto **basic** (MSG-STA-4), no advanced offered. Route B → auto basic + advanced to *Advanced review* (MSG-STA-4B). Route C → auto basic + advanced to review (4B); assisted adds badge "Assisted session". Audit: "Approved automatically: Route A, eID verified (Italy), residence record matched, basic level" + rule id.
11. A case that was refused and then gets a review request goes to **Appeals**; it must be decided by an officer **other than** the one who refused (core throws otherwise). Approve → MSG-COR-06 + 4/4B. Uphold → MSG-COR-07.
12. Request more information → status 3 + MSG-COR-01 (officer text fills `[what we need]`); citizen replies (text and/or upload) → MSG-COR-02 → status 2 → officer. Approval after info → MSG-COR-08.

Risk = max flag severity. Priority tiers keep the current order (P1 high … P6 advanced), no age bump across tiers.

## 5. Citizen journey and screens (messages by ID; ES uses "tú")

- Landing: "Soy ciudadano/a" · "Soy empleado/a público/a", EN/ES switch. MSG-RA-01 hero.
- **Sign-up** (fields of MSG-AI-02): given names, surnames (separately), date of birth, nationality, document type, document number, expiry date, password. Help text MSG-AI-02, MSG-AI-01 line. Real DNI/NIE letters refused.
- **Route assistant**: RA-02 nationality → RA-03 document (+ "No lo sé") → RA-04 EU eID (EU only; Sí/No/No lo sé) → RA-05 who (Me registro yo · Ayudo a otra persona · Registro a un menor a mi cargo; "Ayudo" switches to large text ≥ 20 px) → RA-06 NFC (only when route B is possible). Result: RA-07A/B/C/F/X with its button and the yellow **"Norma propuesta, aún no vigente"** tag on B, C-assisted, X and F-for-foreigners. MSG-AI-01 on the first screen.
- **Assisted (GYC-03)**: helper form (name + relation: Familiar · Amistad o vecindad · Trabajo social u otra persona de apoyo) → MSG-ASS-01 with big green "Sí, quiero registrarme yo" and big grey "No, parar" → header "Se registra: Ernesto Navarro. Ayuda: Marta Navarro (familiar)" until the end → consent with **Leer en voz alta** (speechSynthesis) → DNI video (camera input) → own mobile (MSG-ASS-02; the helper's number is refused) → SMS code → helper sees MSG-ASS-03 only, never the result.
- **Minor (GYC-04)**: MSG-MIN-01 ("Lo entiendo y continúo") → guardian's own chip + face (one screen, does not register her) → upload "Documento de patria potestad" (image) → minor's data + MSG-MIN-02 → consent CON-03/04 → minor chip + face → contact (minor's own mobile, guardian email) → submit.
- **Red card (GYC-05)**: RA-07X → consent CON-01/02/03 (no CON-04; note "una persona revisará tu tarjeta roja") → passport number + expiry → passport chip + face → upload "Foto de tu tarjeta roja" + "Número de la tarjeta" + expiry date → submit.
- **Consent**: CON-01, CON-02 always; CON-03 (face checkbox) on B/X/C; CON-04 (residence checkbox) except X. Every checkbox starts unticked; "Acepto y continúo" disabled until all ticked; "No acepto" → CON-06. CON-05 line with privacy link.
- **Chip**: VER-01 "Leer chip" → success "Chip leído: válido" / VER-03 "Intentarlo de nuevo" / VER-04 "Unirme a la videollamada" · "Volver más tarde". On signature/printed failure → VER-07.
- **Face**: VER-02, camera frame + simulated-camera control; failure → VER-05; second failure → MSG-FALL-01 with "Unirme a la videollamada" · "Volver más tarde".
- **DNI video (C)**: VER-06 on reflections.
- **Contact**: mobile + email, "Enviar código", banner **"Código de demo: 123456"**, then code field. MSG-AI-02 help.
- **Review**: summary of the typed data + MSG-AI-04 checkbox + "Enviar mi solicitud".
- **Tracker**: STA-1 … STA-5 texts verbatim, status 2 label "En comprobación" and the add-on line when a person reviews; result screens STA-4 / 4B / 4C with "Descargar justificante (PDF)" · "Abrir Cl@ve Móvil"; STA-5 + MSG-REJ-0x + "Pedir una revisión".
- **Review request**: MSG-COR-03 form (≤ 500 chars + optional image) → COR-04 → status 2 + COR-05 → COR-06 / COR-07.
- **More info**: COR-01 with officer text + "Enviarlo ahora" (text/upload) → COR-02.
- **Video call room** (Fallback): FALL-01 "Unirme a la videollamada" → waiting room "Una persona de la Administración se unirá en breve" → when the officer presses *Iniciar videollamada* in the console, an officer tile (placeholder, name "Empleada pública Vega") appears live; ends when the officer approves or ends the call. FALL-02 "Pedir cita" as last option.
- **Help**: MSG-HELP-01 panel on every citizen screen ("¿Necesitas ayuda?") with a Large-text toggle.

## 6. Officer console

- Queue with risk tag, tier, **AI reason** sentence, checks icons. Lists: Cola · **Apelaciones** · **Revisión del nivel avanzado** (existing menu items).
- Case: **checks table** (✓/✗/pending with simulated values note), AI reason text, **discrepancy table** (field · document/chip · records) highlighting differences, **printed vs chip** side by side, **proof / red-card viewer** (uploaded image, number, expiry highlighted if < 30 days), assisted badge + helper name/relation + "SMS confirmed from applicant's own number; helper's number not linked", attempts list (chip reads, face attempts with camera input), consents with time.
- Actions: **Iniciar videollamada** (when a video call is waiting or useful), **Aprobar nivel básico** / **Aprobar nivel avanzado** (context), **Pedir más información** (free text + COR-01 template), **Rechazar con motivo** (closed list REJ-01…08, internal note the citizen never sees). Appeals: **Aprobar** / **Pedir más información** / **Mantener la denegación** (reason). Second-officer rule enforced with a clear message.
- Officer names in the plan: *Vega* (first decisions) and *Ortiz* (appeals). Staff accounts: `lvega` / `Vega-2026`, certificate PIN 2580 (Lucía Vega); `aortiz` / `Ortiz-2026`, PIN 1357 (Andrés Ortiz). Keep Marta Gil and Diego Romero (not authorised). Visible demo-access box stays.
- Audit trail: every check, rule id, decision, officer, evidence viewed, "Refusal corrected on review" tag.
- Dashboard counters computed live from state (automatic approvals, needed an officer, refusals by reason, corrected on review, decided under proposed rules) + the published reference figures with year and source.

## 7. Seed

- Preloaded accounts, **all in draft** (nobody has done anything yet): Kenji, Ernesto, Laura Ruiz (for Mateo), Daniel, "Applicant X" (account typed with Ana Costa's passport data), Rafael Duarte, Valentina. Giulia is **not** preloaded (typed live). Passwords in README.
- Background cases (bg-*) stay as queue filler, already decided or waiting.
- `resetDemo` restores this seed; bump `STATE_VERSION`.

## 8. Honesty markers (unchanged)

Own logo only; footer "Prototipo académico de IE University" → About; About lists everything simulated incl. the registers, the camera control, the SMS code, uploads stay in this browser; "valores simulados" next to scores; Proposed-rule tag; no real personal data; demo code banner says "demo".
