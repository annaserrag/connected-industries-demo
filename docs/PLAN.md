# Get your Cl@ve — project plan (extract)

Source: "Group 10 – Get your Cl@ve – Project plan" (IE University, Smart Cities & E-Government). Copied verbatim where it matters.

## Overview
We are redesigning registration in Cl@ve, the Spanish government's digital login, so that a foreigner gets it the same way and in the same time as a Spaniard: from their phone, with no physical appointment.

The problem today: a Spaniard with a DNI can register by video call in minutes. Video registration is only for Spaniards with a DNI, so EU and non-EU foreigners must go in person with original documents. People holding only an NIE paper or the red card of international protection applicants cannot register at all.

Our redesign: one single platform used by both sides, with the same live case seen from a citizen view and a government officer view, and one AI engine behind both:
- Route A – EU digital ID (eIDAS): EU citizens log in with their own national eID, which Cl@ve already accepts.
- Route B – Passport or TIE chip (NFC) + face check: the phone reads the document's chip, the AI checks liveness and matches the face to the chip photo, and the platform checks residence records with consent.
- Route C – DNI video call: today's route for Spaniards, kept as it is.
- Fallback – Video call with an officer, and only then an office appointment, for cases that fail or look like fraud.

The key rule: the platform can grant access automatically, but only a person can refuse or revoke it, always with a reason the citizen sees and a way to appeal.

Two policy changes we propose openly: opening video identification to foreign documents, and including red-card and NIE-paper holders. We present both as rule changes, not as things the app solves by itself.

## Part 1 – Prototype: screens
1. Landing + login: choose "I am a citizen" or "I am an officer".
2. Citizen – route assistant: a few questions (nationality, document held, has an EU eID?) and the recommended route with the reason.
3. Citizen – verification: simulated eIDAS login, or simulated passport/TIE chip read + face check + residence check with a consent screen.
4. Citizen – status tracker: the five statuses from the reference sheet, with the citizen messages.
5. Citizen – result: basic level granted, advanced level pending review, or not approved with the reason and an appeal button.
6. Officer – case queue: cases sorted by risk, each showing which checks passed or failed and why the AI flagged it.
7. Officer – case detail: approve, request more information, or refuse with a mandatory reason from the list.
8. Officer – audit trail: who decided what, when, and on which evidence.
9. Dashboard: indicators, with demo numbers clearly marked as simulated.

Must include: the same case updating live in both views, the deepfake case stopped, a rejection corrected and approved, and the assisted case (the neighbour on his daughter's phone).

Done when: anyone can open the URL, log in as either side and run every case in the library without help.

## Launch video structure (the demo will be recorded for this)
- 0:00–0:40 Today: Giulia's "before": office, originals, appointment, weeks of waiting
- 0:40–2:00 Giulia's new journey: route assistant, chip read, face check, live status; on the laptop the case appears and is approved
- 2:00–2:50 The officer's day: queue sorted by risk, a flagged case, the AI's reasons, a decision with a mandatory reason
- 2:50–3:40 A hard case: the deepfake stopped, or a rejection that the citizen corrects and gets approved
- 3:40–4:20 Nobody left behind: the neighbour registering on his daughter's phone
- 4:20–5:00 Launch message: what changes and the dashboard numbers

## Indicators for the dashboard
Time to reach the advanced level (foreigners vs Spaniards), share of registrations still needing an office visit, rejections later corrected, appeals and their outcome.

## Shared reference sheet (source of truth)
Names: service "Get your Cl@ve" · citizen persona Giulia (Italian master's student in Madrid) · the neighbour (80, no smartphone, helped by his daughter) · other cases from the case library.

Routes: A – EU digital ID (eIDAS) · B – Passport or TIE chip + face check · C – DNI video call · Fallback – video call with an officer, then office.

Statuses (citizen view): 1. Received → 2. Checking → 3. We need something from you → 4. Approved (basic / advanced level) → 5. Not approved, with the reason and how to appeal.

Key rule: the platform can approve automatically; only an officer can refuse or revoke, always with a reason and a way to appeal.

Key numbers (only use these, with their year):
| Figure | Value | Year | Source |
|---|---|---|---|
| Registered Cl@ve users | 21,558,192 (+10.4%) | 2024 | OBSAE |
| Logins through the Cl@ve gateway | 1,020,194,629 (+26%) | 2024 | OBSAE |
| Cl@ve Móvil logins | 9,235,043 → 41,383,759 | 2023 → 2024 | OBSAE |
| Cl@ve PIN logins | 53,362,134 → 47,920,189 | 2023 → 2024 | OBSAE |
| Logins with another EU country's ID (eIDAS) | 71,063 | 2024 | OBSAE |
| Residence checks between administrations | 29,521,948 (+53%) | 2024 | OBSAE |
| People 16–74 who dealt with the administration online | 80.7% | 2025 | INE TIC-H |
| Spaniards who used their eID | 54.43% (EU 41.11%) | 2023 | Digital Decade |
| Spaniards without an eID, so didn't use one | 13.99% | 2023 | Digital Decade |
| Digital public services score for citizens | 88.75 (EU 82.32) | 2024 | Digital Decade |

Not to be claimed until confirmed: that the TIE chip is readable by phone, and that MiDNI allows online login. Dashboard numbers in the prototype are simulated and must be labelled as such.
