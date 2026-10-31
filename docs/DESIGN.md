# PROOF OF READY — DESIGN SYSTEM & EXPERIENCE STANDARD

**Version:** 1.0 · 31 October 2026 · Design authority for this submission and subsequent work.

**Design thesis:** **A field inspection instrument, not a crypto dashboard.** Proof of Ready should look and behave like a beautifully engineered tool used to decide whether contracted work can be accepted. Think quality-control station, annotated field report, calibration target, and unmistakable verdict. Not enterprise admin SaaS, AI chat, cyberpunk DeFi, or a slide full of integrations.

**Brand promise:** **Know before you approve.**

**First customer:** A commercial monitoring integrator / facility operator accepting door-monitoring equipment installed by outside contractors. **The user needs an answer:** “What did the device prove, what failed, and can I approve this installation?” The work order, camera and device readings, third-party paid inspection, and external security-policy decision are supporting evidence for that answer.

**Important:** Current real recorded evidence includes camera-detected REWORK, a genuinely paid Cardano inspection resulting in FAIL, and an independently verified optical LED diagnostic. A complete READY commissioning outcome is not yet established; do not redesign the app to fabricate one. API3's signed NVD evidence has been checked, but the demonstrated mined rejection may not independently depend on the NVD value. Product and visual claims must track the latest local evidence. See `research/EVIDENCE.md`, `application/submission/evidence-manifest.json`, and `MORNING_HANDOFF.md`; the local source may be newer than private GitHub `main`.

---

## 1. Non-negotiable experience rules

1. **A human understands the result in five seconds.** Every substantive screen answers: **What job? What happened? What's next?** No prior knowledge of Cardano, API3, or hardware required.
2. **Lead with the actual physical work.** The camera and evidence are the main visual, not charts, metrics, agents, wallets, transaction history, or API call counts.
3. **Make failures useful, not embarrassing.** REWORK is our flagship demonstration: visually explicit defect, measured reason, correction the contractor can take. Never turn a real failed check into a fake success.
4. **One primary action per context.** Other actions move into a clearly named “Evidence and details” disclosure. Avoid rows of ten small buttons.
5. **Show truth and uncertainty.** `REAL TEST`, `SAVED RECORDING`, `REHEARSAL`, `PENDING`, and `UNVERIFIED` are permanently visible provenance labels in the relevant modes. Don't convey cryptographic/financial proof through animation alone.
6. **Keep operator decision separate from specialist result.** `Inspection result: FAIL` is distinct from `Installation: REWORK`; Cardano inspection payment does not imply contractor payout.
7. **Progressive disclosure.** Default view is plain language. Expand for timestamps, addresses, exact signatures, raw source values, receipt hashes, limitations, and judge tests. Advanced details remain accessible within one click.
8. **Designed to be filmed.** At 1080p, headings, verdicts, measurements, and next actions must read at a glance. No microtext or tiny badges hiding the essential point.
9. **Design never overrides existing technical truth.** Only change labels and layout after checking what every action actually performs. Read-only actions are never labeled as new verification or payment.
10. **Preserve the working demo.** Apply styles progressively, protect existing event handlers/IDs/flows, regression-test the 4022 real station and offline Seeker viewer, and capture a before/after screenshot. No risky framework rewrite.

---

## 2. Visual direction: FIELD NOTE / QUALITY CONTROL

**Visual identity:** Warm technical paper × graphite instrumentation × safety yellow highlight × precise red/green evidence stamps. Distinctive enough for the thumbnail of a demo video; serious enough for an equipment business to purchase. Whitespace, measured annotation lines, registration marks, and typographic hierarchy create interest—not 3D blobs or glowing gradients.

**Deliberate anti-patterns:** No glassmorphism, gradient orbs, violet-on-black crypto look, pill-shaped SaaS metric cards, six competing accent colors, oversized emoji, synthetic sci-fi diagrams, avatar agent chat bubbles, neon circuit backgrounds, or gratuitous dashboards. Avoid “AI-powered”, “revolutionary”, “trustless”, “fully autonomous”, and “military-grade” unless literally and defensibly true.

**Signature motifs (used consistently):**
- **Registration corners:** four spare L-shaped marks around real camera subjects, inspired by calibration/fiducial targets. On static slides use them around *real* images, never to imply scanning when none occurred.
- **Proof stamp:** big rectangular `REWORK`, `REVIEW`, or `READY` set in condensed type, with a clear explanatory subline and an evidence count. Not a rounded pill.
- **Measurement leader:** a fine line from an observed marker to a numeric reading and tolerated range. Measurements come from real calculations, not decorative random numbers.
- **Job/file identity:** small mono `INSTALLATION / 014` and `EVIDENCE 03` at top edges, like field engineering drawings. No fake facility names or timestamps.
- **Rule/bar separators:** thin hairlines, squares, and asymmetric alignment. Minimal box shadows.

**Logo/wordmark:** `PROOF / OF READY`, stacked or single line in Barlow Condensed bold, small registration `⌜ ⌝` motif. Use a plain text mark if there isn't time for a vector logo. Do not create a pseudo-authority seal or certification mark.

---

## 3. Tokens: exact values, not inspiration

### Colors — authoritative palette

| Token | Hex | Role |
|---|---|---|
| `--por-canvas` | `#F5F1E8` | Warm paper body, film title cards |
| `--por-surface` | `#FFFFFF` | Inspection panel and report sheets |
| `--por-ink` | `#172424` | Headlines, critical text, dark field panel |
| `--por-muted` | `#52615E` | Secondary copy on light backgrounds (5.77:1 against canvas) |
| `--por-rule` | `#C7CDC5` | Thin rulers and panel boundaries |
| `--por-highlight` | `#F1CF54` | Physical target, current evidence, important accent; **dark text only** |
| `--por-accent` | `#216247` | Interactive links/buttons/confirmed technical evidence; not generic READY |
| `--por-darkpanel` | `#172424` | Camera shell, proof strip, video end card |
| `--por-rework` | `#A6362A` | Genuine defect and corrective action (5.85:1 against canvas) |
| `--por-rework-bg` | `#FFF2ED` | Light red evidence panel |
| `--por-review` | `#805511` | Missing/uncertain evidence, not defect |
| `--por-review-bg` | `#FFF6DD` | Light amber panel |
| `--por-ready` | `#216247` | Truly authorized complete acceptance only |
| `--por-ready-bg` | `#E7F5EA` | Actual ready state only |
| `--por-on-dark` | `#F5F1E8` | Text on dark panels |

**Accessibility:** Main text ≥4.5:1 and large UI text ≥3:1. Text colors above were checked for contrast against their primary backgrounds. Don't use highlight yellow as text on white. Status always carries a word + icon/shape + reason; never color alone. Never use green for a partially verified or merely paid task.

**Meaning rule:** Yellow is **brand/current action**, *not* success. Red is actual failure. Amber is review/insufficient evidence. Green is confirmed requirement satisfaction. Neutral ink is infrastructure that has no verdict.

### Typography — unusual but usable

- **Display, huge verdicts, numerical measurements:** `Barlow Condensed` weights 600/700. Editorial industrial lettering. No other decorative display font.
- **Body, controls, explanations, captions:** `Atkinson Hyperlegible Next` weights 400/600/700. Deliberately clear, approachable and distinguishable letterforms.
- **Technical evidence only:** system `ui-monospace, SFMono-Regular, Consolas, monospace` (no third network font). Use for truncated hashes, IDs, timestamps, source-mode labels, and the tiny calibrated numerals, **not prose**.
- Both named font families are open-source under SIL OFL; agent should download minimal self-hosted WOFF2 weights from verified upstream and preserve license notices, or use local system fallbacks. **No runtime CDN dependency** because offline Seeker mode must still render correctly.
- **Do not add any other fonts.** Fallbacks: `"Arial Narrow", sans-serif` for display; `system-ui, sans-serif` for body.

**Sizing for a 1920×1080 recording:** headline 48–64 px, large verdict 84–116 px, section 27–36 px, essential measurement 28–42 px, body 17–20 px, supporting 14–16 px, evidence label >=13 px. In normal responsive UI: body 16–18 px, button >=16 px, touch targets >=44 px. No 9–12 px text in the filmed primary experience; existing source uses many 9–12 px sizes and should be corrected.

**Rhythm:** 8px spacing base, use 8/12/16/24/32/48/64. Max content width 1420px, desktop gutters 48px (can shrink), document text max-width 70ch. Panels mostly squared or 6px corners; no 20px floating tiles. Borders 1px neutral or 2–4px semantic rail. Minimal shadows.

**Working CSS starter (adapt to existing names; do not break selectors):**

```css
:root {
  --por-canvas: #F5F1E8;
  --por-surface: #FFFFFF;
  --por-ink: #172424;
  --por-muted: #52615E;
  --por-rule: #C7CDC5;
  --por-highlight: #F1CF54;
  --por-accent: #216247;
  --por-darkpanel: #172424;
  --por-rework: #A6362A;
  --por-rework-bg: #FFF2ED;
  --por-review: #805511;
  --por-review-bg: #FFF6DD;
  --por-ready: #216247;
  --por-ready-bg: #E7F5EA;
  --por-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --por-body: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --por-mono: ui-monospace, Consolas, monospace;
  color-scheme: light;
}
body { background: var(--por-canvas); color: var(--por-ink); font-family: var(--por-body); }
h1,h2,.verdict,.measurement-hero { font-family: var(--por-display); }
:focus-visible { outline: 3px solid var(--por-ink); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

---

## 4. Information architecture — remove the dashboard maze

**Core navigation, in plain language:**

1. **Inspection** — actual job, live camera and evaluation; starting screen `/` or live station. This is the main product.
2. **Result** — one inspected attempt with what passed/failed and what to fix. Within the inspection flow, not a separate dashboard maze.
3. **Proof** — original paid inspection, original NVD/policy decision, signatures, linked source files, independent verification. Accessible as a disclosure/drawer.
4. **For judges** — read-only saved viewer (`/demo/`), API3 tamper console and exact commands, transcript/video. Separation from the customer's normal app.

Do not display historical `Observation lab` in primary navigation or default to it. Make older/rehearsal/internal test routes clearly “Developer tools.” Never mix synthetic rehearsal results with genuine physical records in one unlabeled timeline.

### Desktop inspection layout (most important camera/video frame)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [PROOF OF READY]     INSTALLATION 014 • DOOR MONITOR       REAL CAPTURE │
├────────────────────────────────────────────────────────────────────────┤
│  Contractor says the sensor is installed.  Does the evidence agree?    │
│                                                                        │
│ ┌──────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ REAL CAMERA + MARKER MEASURE     │ │ REWORK                       │ │
│ │                                  │ │ Placement doesn't match      │ │
│ │    0   [target]   10            │ │ the approved position.       │ │
│ │                                  │ │                              │ │
│ │  observed: XX mm / XX°           │ │ WHAT TO FIX                  │ │
│ │  allowed: ±8 mm / ±8°            │ │ Move / rotate device marker. │ │
│ └──────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                        │
│  WHAT WAS CHECKED   Placement ✕   Device identity ✓   Function —      │
│                    Inspection report FAIL   Cardano paid ✓             │
│                                                                        │
│  [View original report]  [Verify saved evidence] [Evidence & details] │
└────────────────────────────────────────────────────────────────────────┘
```

Use real actual readings in place of `XX`; when missing, show “Not measured,” never fake zeros. The main verdict summarizes the *installation*, not all receipts. If an optical diagnostic was real but separate, show it in “Other evidence” with its own attempt/date; don't visually merge independent runs into one successful attempt.

### Mandatory first-screen hierarchy

**Top:** a small job identifier, clear physical customer context and unmistakable source mode.
**Hero:** **camera left ~60%** / **verdict right ~40%** with one exact reason and next action.
**Next:** three human-readable checks: `Placement`, `Device response`, `Independent inspection`. Additional software policy detail goes underneath.
**Bottom:** real proof trail, initially condensed: `Camera record → Inspector report → Paid receipt → Security policy` with links, each tagged `Verified`, `Rejected`, `Missing`, or `Not evaluated` separately.

**Do not** render four equal-weight panels for blockchain, camera, mobile, agents. The customer values *inspection outcome*; supporting systems are subordinate.

### Offline Seeker saved viewer `/demo/`

The phone is a **portable inspection report**, not a second control panel. Hero:

`INSTALLATION REQUIRES REWORK`

`Placement did not match the approved position.`

One strong primary action: **`Verify saved evidence`**; then `Read inspector report`, `View payment receipt`, `How this was checked`. Persistent chip **`SAVED COPY · NOT LIVE`**. State clearly **“This verifies the saved files; it does not recheck the device or blockchain.”** Without internet show cached proof and disable explorer links gracefully. Do not clear/alter browser storage or disturb the existing offline path.

### Judge console — deliberately separate

Title: **“Try to change the evidence.”** Explainer: **“Only an authentic, fresh response for this exact request can change the contract's authorized state.”** Show five rows: `Valid / Edited value / Too old / Different request / Wrong signer`. Each row states exact expected and observed result. Give contract network/address and **`Submit your own response`** interface or documented script. Make it unambiguous which was a genuine signed Airnode response vs controlled fixture. A generic failed contract write does not mean API3 signed value controlled the real commissioning decision; avoid that implication unless separately demonstrated. Technical details can be expanded.

---

## 5. Copywriting: plain human language is part of the product

**Voice:** Quiet confidence, literal instructions, precise observations. No motivational marketing inside the instrument. Write like the technician and operator are busy, competent adults. Short subject–verb–object sentences; one thought per line. A specific failure reason is more important than an inspirational claim.

### Product brand

- **Hero:** `Know before you approve.`
- **Subhead:** `Check the actual device before accepting the installation.`
- **Customer category:** `Remote installation checks for connected equipment.`
- **Brand line for video/slides:** `Photos show the equipment. Proof of Ready checks what it did.`
- **Do not use as on-screen factual promise:** `AI makes all contractor work trustless`, `Never send an inspector again`, `Guaranteed safe device`, `Automatically pays the contractor`.

### Screens and actions (preferred exact labels)

| Current/technical label | Replace with | Reason |
|---|---|---|
| `Agent-orchestrated commissioning` | `Remote equipment inspection` | The current workflow isn't autonomous agent planning. |
| `Commission the work. Keep the proof.` | `Know before you approve.` | Problem/benefit precedes process. |
| `Define ready.` | `What should this installation pass?` | Human question. |
| `Approve work order` | `Confirm inspection requirements` | More accurate than approving contractor work. |
| `Show the installation.` | `Check the actual device.` | Explicit action. |
| `Capture signed optical test` | `Check the device's light response` | Jargon in evidence details only. |
| `Open real inspection` | `View the recorded inspection` (if saved) | Don't imply fresh execution. |
| `Check demo` | `Verify the saved record` | Read-only behavior. |
| `Verify packet` | `Verify evidence files` | Understandable. |
| `Test an edited packet` | `Try changing the evidence` | Explains test purpose. |
| `Paid FAIL` | `Inspection completed · Issues found` | A failed installation still yields a paid useful service. |
| `REVIEW` | `More evidence needed` | State + reason. |
| `REWORK` | `Fix required` with `REWORK` stamp | Next action. |
| `READY` | `Meets the approved checks` | Only when truly fully verified. |
| `Source unknown` | `We couldn't verify the source` | Clear consequence, no camouflage. |
| `Counter mismatch` | `This proof was already used` | Explain replay failures. |

**Important:** Keep wire-protocol enums and test selectors (`READY`, `REWORK`, `REVIEW`, `FAIL`, `sourceMode`) unchanged. Change *visible labels*, not API semantics, contracts or IDs without tests.

### Actionable messages

- Misplaced: **`Placement is outside the approved target.`** Subline: `Observed 37 mm from target; allowed ±8 mm. Move the device marker toward the target and measure again.` Only show actual measurement and tolerance if they correspond to this attempt.
- Wrong rotation: **`The device marker is facing the wrong way.`** `Rotate it until both markers point in the same direction.`
- Optical read success: **`Device response matched: 72 of 72 light changes.`** Label which test attempt and whether it is recorded/diagnostic.
- Contact missing: **`Door-contact test was not completed.`** `This installation cannot be accepted yet.`
- Payment done: **`Independent inspection paid on Cardano Preprod.`** `Open the original transaction` (when actually settled and receipted).
- Inspection fail: **`Inspector found an installation issue.`** `The report is complete; the installation needs correction.`
- Saved offline: **`Saved evidence is available on this phone.`** `This is a recorded result, not a new inspection.`
- Network error: **`Can't reach the verification service.`** `Your saved report is still available. Try again when connected.`
- External security: **`Security-policy check: review needed.`** `The available vulnerability data doesn't prove the installed firmware.`
- Privacy notice: **`Camera footage stays on this device unless you explicitly export evidence.`** Only if verified to be true for the actual flow; otherwise revise.

**Never say** `Cardano approved the installation` or `API3 proved the device is safe`. They prove narrower paid service and external source-authentication facts.

---

## 6. Components and interactions

**Header:** One small wordmark, asset/job id, proof-source badge, one `Evidence` link. Remove laboratory/debug links from the customer surface; keep them in a discreet developer area.

**Primary action:** dark ink or dark green solid rectangular button, generous padding; one per section. Yellow highlight used for focus/action marker but never as tiny text. Destructive/paid actions explicitly disclose effects, network/amount and confirmation. **Read-only actions should be safe to rerun.**

**Status component:** large condensed uppercase state; one-sentence description; severity rail; concise numbered fix when actionable. Preserve exact workflow status. `REWORK` vs `FAIL` vs `REVIEW` must not collapse into one ambiguous green/red dot.

**Evidence rows:** clear name, observed result, provenance and timestamp, `View source` disclosure. Examples: `Placement / FAILED / Camera measurement · 10:22`; `Inspector report / DONE, FAIL / Cardano-paid inspection`; `Software policy / REVIEW / Source data authenticated, installed build unproven`. No invented timestamps, balances or sensor readings.

**Camera module:** biggest element on the working screen. At most three layers: raw video, projected target+observed measurement, source badge. Crosshair registration marks and line to target, red when out-of-tolerance, green only if geometry passes. The board LED should be visible. Never overlay a giant glowing “verified” graphic on the raw camera feed.

**Disclosure order:** `What was checked` → `Why this result` → `Original evidence` → `Payment and blockchain records` → `Technical limits`. Code/JSON/address detail should not dominate the first viewport.

**Motion:** 120–200ms interface transitions; animate only real state changes, scan capture progress, and genuine optical waveform. No fake “AI thinking”, generated hash animation, animated payment completion without confirmed settlement, bouncing counters, particle effects, or cinematic intro that consumes video time. Respect `prefers-reduced-motion`.

**Keyboard and mobile:** Tab logical sequence, Enter activates, Escape closes dialogs, visible focus rings, `aria-live` on status messages, touch targets >=44px, minimum font 16px for inputs, avoid horizontal overflow. On <=760px stack verdict above or below camera depending on task, but **never hide the verdict**. Offline saved viewer should use single-column layout with readable buttons and explicit saved badge.

**Empty/loading/errors:** never blank card or spinner without a sentence. Show exactly which fact is waiting, timeout/action, and whether the user can leave. Do not silently convert failed external calls into success or erase the original evidence.

---

## 7. Slides, video, images and README — one identity

**Rule:** The product, 16:9 video title cards, booth pitch, Devfolio cover and diagram must look like the *same instrument*. No separately styled gradients, different deck font, or inconsistent claims.

### Slide/video visual templates

- **Title card:** paper background, oversized black `KNOW BEFORE YOU APPROVE.`, one yellow underline/registration-mark, small Proof of Ready wordmark. 
- **Problem card:** left `CONTRACTOR SAYS: DONE`, right `DEVICE SAYS: ?`; use real physical fixture photo (or neutral schematic clearly illustrative), never stock factory photo implied as a customer site.
- **Measurement card:** dark graphite panel with real camera crop and annotation; big number (`37 mm off target`), `Allowed: 8 mm`; this is the signature visual moment. Use only if measurement genuinely from relevant attempt.
- **Economic card:** `One bad handover → Another trip → Another invoice` (conceptual chain; no unsupported euro cost). `Detect it before acceptance.`
- **Architecture card:** `On-site evidence → Independent paid inspection (Cardano) → Authenticated external policy (API3) → Operator decision`, with distinct separate-chain captions and trusted coordination explicit if discussed.
- **Footer proof strip:** source/mode/time/chain in restrained mono, not hashes filling the screen.
- **End card:** brand, `Know before you approve.`, actual public repo link. No invented customer logos, savings or certification badges.

**Screenshots for Devfolio / README:** `01-real-camera-defect`, `02-inspector-report`, `03-paid-receipt`, `04-airnode-contract-tamper`, `05-offline-phone-proof`. Annotate raw screenshots only where captions support *actual* evidence. Never render a fake successful UI screenshot. Screenshots must match final product build and preserve source mode.

**Video readability:** exported 1920×1080, 16:9, huge legible main state and source/recorded labels, captions with dark solid backing when necessary; test viewing on phone. Avoid filming raw tiny terminal text unless the judge can pause; zoom on the relevant result. API3’s **valid + four attacks** must remain visibly distinct, and Cardano's original paid job must be shown as a completed prior transaction, not a fresh payment in a current run.

**Judge comprehension:** give each primary clip one plain-language result: device response, placement defect, paid inspection, software admission, tamper rejection, or reviewable evidence. Pair the result with actual footage. Keep addresses, request IDs, and long hashes in supporting evidence. Explain that a paid FAIL completes the inspector's service while installation acceptance stays blocked. Label the earlier LED diagnostic, later camera preview, original paid attempt, and software admission as separate real runs. A valid historical contract call permits work-order opening. The original mined transaction establishes the actual state change. Keep six primary clips separate for the owner's edit and retain detailed recordings as B-roll.

**Photography:** actual ESP32 board + target markers + laptop screen, simple neutral table, diffuse lighting, controlled background, marker and light visible. Product interface should echo physical registration marks. Do not generate fake photo proof.

**Documentation:** README's opening section uses the same problem, outcome, product screenshot, `Try the saved demo`, and 3-step explanation; deeper technical docs retain precision and raw source paths. Devfolio headline is benefit-first, sponsor details afterwards.

---

## 8. Implementation instructions and acceptance gates for Codex

**Inspect first:** The live local project, actual browser HTML/CSS/JS, `/demo/` saved viewer, current evidence and README, existing `data-*` selectors/tests, and README's exact demo and reset path. Private GitHub `main` could be stale. Do not invent a separate frontend framework. The old `application/public/commissioning.css`, `style.css`, and `overview.css` have conflicting blues, body fonts, and 9–12px text; unify tokens and core layout carefully. Newer local UI may already include focus mode and saved-proof pages: preserve them.

**Strict priorities — stop when screenshot-ready rather than redesigning the universe:**

1. **Freeze a known-good recording path.** Take screenshots of actual 4022 and phone viewer first. Run documented demo preflight, record baseline, preserve receipts/camera evidence. Do not alter the backend/firmware/payment path for a design-only task.
2. **Typography, colors, legibility.** Implement `--por-*` token sheet, display/body typography with self-hosted/offline fallback, larger labels, visible state and provenance. Apply to active inspection and saved viewer first. Keep resource load light.
3. **Main viewport hierarchy.** Put real camera/recorded inspection and large verdict with actionable next step above all technical detail. Collapse advanced developer/sponsor evidence without hiding it; reduce repeated cards and actions. Use exact `REWORK` cause and paid inspector distinction.
4. **Offline saved viewer.** Read-only mode obvious; `Verify saved evidence` visibly primary; works after USB disconnect without network; no re-verification claim, no local storage reset. Ensure `Inspect report`, `Payment`, `Copy proof link` or equivalent actions only if implemented.
5. **Judge console and screenshot assets.** A clear API3 tamper-result matrix with editable/custom input path if supported; don't visually lie about independent CVE causality. Capture real screenshot images for video/README and prepare matching title cards/slides after core UI works.
6. **Quality gate.** Browser QA at 1920×1080, 1366×768, 390×844 phone, and actual Seeker if accessible; direct screenshot inspection; keyboard/focus and contrast; loading/error/offline states; `npm` tests, lint/build, sponsor and camera preflight, no console errors. Compare visually with baseline. Repair regressions immediately.

**Non-goals today:** New authentication, custom design-system package, color-mode toggle, rebuilding app in React, excessive animations, onboarding wizard, avatar/chatbot UI, 3D city, redesigned firmware, new server endpoints unless necessary for existing demo stability. Never let styling block submission or leak `.local/` evidence.

**Quality checklist:**
- [ ] At first glance I can name the inspected asset, what failed, and what to fix.
- [ ] The camera or real captured evidence is larger than every blockchain widget.
- [ ] Main result is 72–116px when shown at 1080p; body >=16px; no critical tiny labels.
- [ ] REAL / SAVED / REHEARSAL modes distinguishable; no history presented as live.
- [ ] Cardano inspection payment and physical contractor acceptance are clearly separate.
- [ ] All three installation statuses remain honest, accessible, and exact.
- [ ] API3 displayed action and attack results match actual on-chain evidence.
- [ ] One obvious primary action, coherent navigation, details discoverable.
- [ ] Mobile/offline viewer tested; existing local recording/phone flows still work.
- [ ] Colors and type consistent across product, slides, screenshots and Devfolio hero.
- [ ] No credentials or `.local` content embedded in public assets.

**Definition of done:** A stranger can view one screenshot, correctly tell you **“that installation failed a specific check; an independent inspector was paid to report it”** without reading a paragraph, and the actual web app still works as documented.

---

## 9. Short design handoff to coding agent

> Implement `PROOF_OF_READY_DESIGN.md` as the single visual and interaction design authority. First inspect current local UI, README, evidence, tests and preserved 4022 real demo. Preserve function and source provenance. Apply the **field inspection instrument** direction: warm paper, graphite, safety yellow, unambiguous REWORK/REVIEW/READY states, Barlow Condensed display and Atkinson Hyperlegible Next body, large real camera and verdict, one clear next action, progressively disclosed sponsor receipts, consistent offline Seeker viewer. Replace generic AI/blockchain copy with precise human instructions and observable outcomes. Do not fabricate READY, autonomous agents, physical safety certification or CVE-driven authorization. Prioritize screenshot-ready active demo and saved phone viewer; then judge tamper panel, slides/video assets, and documentation. Directly inspect desktop/mobile rendering and run the full regression/test suite. Maintain granular commits. Never let a cosmetic refactor break the working capture, evidence or submission flow. Deliver before/after screenshots, exact verified changes, failing tests and a short morning-ready demo checklist.

