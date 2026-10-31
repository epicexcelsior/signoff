# Demo walkthrough

## Use the phone without the laptop

1. Reconnect the Seeker through the existing USB setup.
2. Open **http://127.0.0.1:4022/demo/** in phone Chrome.
3. Wait for **Saved in this browser**.
4. Select **Verify saved files**.
5. Keep this tab or bookmark it before disconnecting USB.

The saved viewer shows actual camera evidence, the useful paid FAIL report, and original receipts. Its automated browser test stops the coordinator before offline reload. On-device offline loading remains untested because the phone was disconnected before installation. Do not clear Chrome storage before the demo. If storage is missing or damaged, reconnect USB and reload once.

The saved viewer does not make new tests or recheck current chain state. Explorer links require internet access. Fresh device tests still require the laptop coordinator. Fully phone-only commissioning is not implemented.

If forwarding disappeared after reconnection, restore it with the Seeker's explicit serial:

```sh
adb -s YOUR_SEEKER_SERIAL reverse tcp:4022 tcp:4022
```

## Show the story

1. Show **Camera found a defect** and **REWORK**.
2. Explain: “The installation cannot pass with incorrect placement or missing tests.”
3. Show **Inspector received payment**.
4. Expand **Read the original inspector report · FAIL**.
5. Open **Inspector payment** to show its original Cardano Preprod transaction.
6. Select **Verify saved files**.
7. Open **The pitch in 20 seconds** for the short equipment-handover pitch.

The starting wedge is facility teams accepting contractor-installed monitoring equipment. Other industries remain proposed applications. Customer demand and pricing are unvalidated.

## Use the live station

Open **http://127.0.0.1:4022**. Select **Open real inspection**, then **Check demo**. **Focus view** simplifies recording. The proof-trail cards open measurements, paid evidence, and the decision. Camera controls stay under **Camera setup and new inspection**.

**Check demo** verifies the packet and rechecks the original payment through external readers. It starts no payment or device operation. Missing services return REVIEW with a recovery message. Use the saved phone viewer if a service is unavailable. Do not create a replacement paid Task.

If `OUTCOME_UNKNOWN` appears, refresh before another operation. If camera permission stalls, select **Stop camera**. After **Reset presentation**, select **Open real inspection** to restore the reviewed attempt.

If the station stops, run this command from the repository root:

```sh
python3 .local/private-config/hardware/optical-only-station-launch.py
```

Prepare and check the generated phone viewer:

```sh
npm --prefix application run demo:prepare
FIELDPROOF_PORT=4022 npm --prefix application run demo:preflight
```

The MPS payment service exited twice with an upstream cancellation error. It was restarted only after both original payments verified as Withdrawn with no requested action. The upstream fault remains unresolved. Do not restart or resend uncertain payment operations blindly. The saved viewer remains independent of this service.

## Physical work that remains

- Move the board and ID10 marker together toward the blue target, 100 mm right of ID0.
- Keep both printed markers visible, upright in the same direction, and uncovered.
- Keep the onboard LED inside the yellow sampling box. Do not change wiring.
- Save a passing camera measurement before another signed optical test.
- Complete the continuous optical commissioning capture and preserve at least four claims.
- Review button terminals and wiring before any contact test.

The last observed phone preview still failed at about 37 mm offset and 179° rotation. It does not prove corrected placement. Contact input remains disabled. Software-policy acceptance remains REVIEW. The earlier signed ESP32 diagnostic matched 72 of 72 recorded symbols, but it is not a fresh commissioning test.

## Recording and release

Create a silent saved-real-evidence walkthrough with `npm --prefix application run demo:record:real`. Its private output includes a scope file. It contains no synthetic capture, new device test, payment, or fresh chain verification.

Use the 150-second shot list in [Engineering](docs/ENGINEERING.md). The private backup video includes labeled rehearsal footage. It is not a real-only final submission video. [Evidence](research/EVIDENCE.md) owns recording paths and verification results.

Public publication and Devfolio submission still require owner authorization.
