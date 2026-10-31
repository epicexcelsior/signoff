# Morning demonstration handoff

The real optical diagnostic works. Full physical commissioning remains incomplete.

## Launch and demonstrate

1. From `application/`, run `npm start`.
2. Open `http://127.0.0.1:4021`.
3. Keep the **LOCAL REHEARSAL** label visible.
4. Approve a work order and start a capture attempt.
5. Run the correct rehearsal to obtain REVIEW.
6. Start another attempt with a placement or contact defect to obtain REWORK.
7. Open **Judge evidence** to inspect the original paid report and transactions.
8. Find **Real device response · 72 of 72 optical symbols** and download its original diagnostic.

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
