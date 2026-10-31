# Morning demonstration handoff

The real optical diagnostic works. Full physical commissioning remains incomplete.

## Launch and demonstrate

1. If the local station is stopped, run `npm start` from `application/`.
2. Run `npm run demo:preflight` from `application/` in a second terminal.
3. Open `http://127.0.0.1:4021`.
4. Keep the **LOCAL REHEARSAL** label visible.
5. Select **Reset presentation** for a fresh screen. Saved attempts remain intact.
6. Approve a work order and start a capture attempt.
7. Run the correct rehearsal to obtain REVIEW.
8. Start another attempt with a placement or contact defect to obtain REWORK.
9. Open **Judge evidence** to inspect the original paid report and transactions.
10. Find **Real device response · 72 of 72 optical symbols** and download its original diagnostic.

The default station does not actuate hardware or make payments. Rehearsal evidence cannot authorize installation.

From `application/`, run `npm run demo:integration` for the four reproducible fixture paths. Run `node --test test/hardware-diagnostic.test.js` to verify the actual device receipt offline. Run `npm test` for browser, negative-case, concurrency, and restart checks.

## Genuine evidence

- Cardano Preprod: useful paid REVIEW, result transaction, withdrawal, and positive seller receipt. The original input is synthetic.
- API3: two settled paid NVD responses, five deployed source checks, and a mined REJECTED decision. Full qualification remains unconfirmed because the saved false inspection predicate forces rejection independently of the CVE verdict.
- ESP32: signed 18-second diagnostic receipt. Offline Seeker recording analysis matched all 72 symbols. The last recorded manifest reported 62 claims. No fresh manifest read occurred in this continuation.

The evidence manifest in `application/submission/` owns exact identifiers. Judge evidence exposes reviewed originals and hashes. The original phone video stays private.

## Remaining work before recording

- Phone Chrome now saves a real station camera measurement through USB localhost forwarding. Select rear camera 2 after camera permission.
- Fix specimen placement and the LED sampling region before any new optical challenge. The observed guide region missed the board LED.
- Save camera measurement waits when the phone clock precedes the session start. Synchronize clocks if the wait persists.
- Enroll the physical runtime. Preserve the installed image, identity, and claim journal.
- Review button terminals and wiring before any contact test. Manual transitions require the owner.
- Preserve at least four claims. Stop hardware operations on failure. Never reset NVS or resend uncertain operations.
- Complete physical inspection input and installed-build provenance before claiming full acceptance.

## Video and release checklist

- Use the existing 150-second shot list and narration in `docs/ENGINEERING.md`.
- Keep diagnostic, historical paid evidence, and rehearsal labels visible.
- Record the real device response and the strongest genuinely verified result.
- Do not present REVIEW or REWORK as successful commissioning.
- Review `application/submission/devfolio-draft.json` against actual evidence.
- Check all public artifacts for secrets and personal information.
- Obtain owner authorization before public repository publication or Devfolio submission.

No new API3 paid calls fit the consumed 0.02 aUSD ceiling. Preserve at least 0.001 ETH. Existing paid evidence needs no replacement transaction.

## Recording backup

The private clip `.local/runtime/sessions/demonstrations/optical-diagnostic-backup/recorded-diagnostic.mp4` preserves 22 seconds of the real diagnostic recording. Its caption states that this is recorded diagnostic evidence, not installation acceptance. The adjacent `scope.json` records original and derived hashes. The clip contains no audio. It supplements the complete original video and does not replace the final product demonstration.

A 96.7-second private presentation backup now exists at `.local/runtime/sessions/demonstrations/recording-kEmQxS/presentation-backup-upright.mp4`. It combines an actual interface recording with the recorded real optical diagnostic. Captions distinguish local rehearsal, historical sponsor evidence, and diagnostic hardware evidence. It contains no audio and does not establish complete commissioning. The adjacent `scope.json` records the hashes and transforms. Run `npm run demo:record` from `application/` to recreate the interface segment with an isolated station.

## Physical setup correction

Offline production OpenCV replay detected both markers in all 90 sampled frames across the original 18-second challenge. All frames failed the current placement policy. The first frame estimated a 62 mm offset and nearly 180-degree device-marker rotation, assuming the declared 60 mm reference. The approved template requires 100 mm and zero degrees. Measure the printed reference before using metric guidance. Reposition the device marker to the approved target and place the board LED inside the highlighted sampling region. Do not change the approved template merely to make this setup pass. No new LED operation is needed to check marker guidance. Button wiring still requires electrical review and manual transitions.

## Recovery controls

- If camera permission does not resolve, select **Stop camera**. The other controls recover immediately.
- If `OUTCOME_UNKNOWN` appears, refresh to recover the saved attempt. The station blocks repeat actions until refresh.
- Camera guidance now shows the estimated offset and angle difference with their approved limits.
- Saved attempts retain their approved work orders after newer empty orders fill the recent-order list.

The local rehearsal station restarted with the recovery fixes. An actual rehearsal returned REVIEW, and browser refresh restored the same attempt. The station remains a rehearsal and historical-evidence demonstration until the physical setup corrections and runtime enrollment are complete.

Camera-choice enumeration does not block station controls. A late result cannot revive a stopped camera. Uncertain-operation recovery instructions remain visible until refresh, including after camera errors or Stop camera. Work-order changes stay blocked during that uncertainty.

The read-only preflight reports station availability, saved-evidence integrity, and remaining requirements. A successful rehearsal preflight is not physical acceptance. If it fails, follow its error before recording. The latest phone battery check reported 9 percent, USB charging, and no active camera session.

If you change or restart the camera, start a new capture attempt and save a passing placement measurement before the LED test. The browser blocks emission from an old camera measurement or a failed placement measurement.

The optical driver now refuses emission at four remaining claims and rejects invalid manifest counts. It also rejects a competing cooperating optical client. Do not bypass that reserve or use another tool to consume it without a new targeted owner decision. The installed firmware and original claim store remain unchanged.

## Real physical camera inspection

The optical-only physical station runs at `http://127.0.0.1:4022`. If it stops, run `python3 .local/private-config/hardware/optical-only-station-launch.py` from the repository root. Run `FIELDPROOF_PORT=4022 npm --prefix application run demo:preflight` to check it. The launcher reuses the original private build secret and verified receipt-key pin. It does not emit light or read contact input.

The real Seeker camera inspection returned REWORK. Open its saved attempt or download **physical camera rework packet** from Judge evidence. The original work-order digest was saved before capture, and packet verification passed. Contact and optical controls stayed blocked. The camera stopped afterward. This packet contains actual camera evidence, failed placement, and no device receipts. It is not a paid physical inspection or full commissioning result.

The sealed physical report now shows the saved offset and rotation with their approved limits. Its first correction is marker alignment before downstream monitor checks. The original negative packet and decision remain unchanged.
