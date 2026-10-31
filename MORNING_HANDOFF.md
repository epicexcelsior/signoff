# Demo walkthrough

Open **http://127.0.0.1:4022**. This is the real-evidence demo.

## Show the demo

1. Show **REWORK** and the failed placement measurement.
2. Explain: “The camera found incorrect placement, so the installation is not accepted.”
3. Show **paid inspection · PASS**.
4. Explain: “The inspector reviewed this actual camera evidence and received payment on Cardano Preprod.”
5. Open **Judge evidence**.
6. Expand **Read the real-camera inspection report · FAIL**.
7. Open **Escrow transaction**, **Result transaction**, or **Inspector payment** to show the original transaction.
8. Select **Verify packet** to check the saved evidence.
9. Select **Export evidence packet** to download it.

**Check external acceptance** repeats the real, read-only payment verification. It requires internet access. It does not purchase another inspection.

## What is real

- The Seeker supplied the saved camera measurement.
- The paid inspector delivered this camera inspection's FAIL report.
- Escrow, result submission, withdrawal, and positive seller collection are verified.
- The current report's paid-inspection PASS uses the original Task and fresh payment readers.
- The original ESP32 diagnostic has a verified signature and 72 matching recorded optical symbols.
- The API3 evidence contains genuine paid NVD responses and deployed contract checks.

The hardware diagnostic and API3 evidence retain their original recording times and limits. They are not fresh tests of this current attempt.

## What remains incomplete

The current placement fails. Contact input is disabled. A complete fresh signed optical commissioning capture does not exist. Software-policy acceptance remains REVIEW.

Do not present REWORK as successful commissioning. Do not describe the recorded LED diagnostic as a live commissioning test. Port 4021 is a separate, labeled rehearsal.

## Recover without losing evidence

- If the page looks wrong, refresh it.
- After **Reset presentation**, select **Bench placement check · optical-only board** under **Saved attempts**.
- If `OUTCOME_UNKNOWN` appears, refresh before another operation.
- If camera permission stalls, select **Stop camera**.
- Do not create a replacement paid Task. Seller collection is complete.

If the station stops, run this command from the repository root:

```sh
python3 .local/private-config/hardware/optical-only-station-launch.py
```

Check the local station with:

```sh
FIELDPROOF_PORT=4022 npm --prefix application run demo:preflight
```

The launcher reuses the saved private enrollment. It does not flash firmware, read contact input, or emit light.

## Before a new live device test

Correct the marker and LED placement first. Keep both markers visible. A camera change requires a new attempt and passing camera measurement. Preserve at least four claims. Stop after failure or an uncertain operation. Button wiring requires electrical review.

## Recording and release

Use the 150-second shot list in `docs/ENGINEERING.md`. Show the real inspection, payment, and original device evidence with their scope labels. The private 96.7-second backup includes labeled rehearsal footage and is not a real-only final submission video. Its path and original evidence details remain in `research/EVIDENCE.md` and the private demonstration directory.

Public publication and Devfolio submission still require owner authorization.
