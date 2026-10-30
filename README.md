# Proof of Ready

Proof of Ready coordinates equipment commissioning. An operator approves a work order. A technician supplies camera measurements and fresh signed contact tests. An inspector explains the result and the remaining acceptance requirements.

The local commissioning station now supports immutable work orders, capture attempts, three-state contact tests, planar camera guidance, receiving-application checks, inspection reports, and verifiable evidence packets. Generated rehearsals demonstrate correct placement, misplaced devices, stuck contacts, and missing delivery.

**Current acceptance stays REVIEW or REWORK.** Physical optical binding, a paid Masumi seller receipt, an enrolled installed build, and a deployed policy decision remain missing. Local fixtures and contract tests do not establish those outcomes. No hardware operation, payment signature, external Task, or public deployment ran during this continuation.

## Run the commissioning station

Use Node.js 24 and npm. Browser tests require installed Google Chrome, or `FIELDPROOF_BROWSER_EXECUTABLE`.

```sh
cd application
npm ci
npm start
```

Open <http://127.0.0.1:4021>.

1. Enter the installation reference.
2. Select **Approve work order**.
3. Select a rehearsal condition.
4. Select **Run rehearsal**.
5. Inspect the predicates and installation decision.
6. Select **Verify packet** or **Test an edited packet**.
7. Select **Export evidence packet** to save the original evidence.

A correct rehearsal passes session, device, function, delivery, and placement checks. Optical binding remains REVIEW. A misplaced device or stuck contact returns REWORK. A corrected attempt preserves the previous record.

The work order fixes marker IDs 0 and 10, a 60 mm reference, and a target 100 mm to the right. Placement tolerances are 8 mm and 8 degrees. The receiving destination is the local owner monitor with a five-second deadline. These are prototype policy values.

## Use the laptop camera

Print [the supplied target](application/public/vision/target.svg) at actual size. Check its ruler and measured dimensions. Keep the reference and device markers in the same plane.

1. Approve the work order.
2. Select **Start laptop camera**.
3. Select **Start capture attempt**.
4. Align the markers with the guidance.
5. Select **Save camera measurement**.
6. In rehearsal mode, select **Run rehearsal** to complete the simulated contact sequence.

Camera frames stay in the browser. The server receives marker corners, measurements, camera/calibration identities, and a frame digest. It recomputes geometry. Planar guidance does not establish calibrated physical accuracy, mounting, or authenticated camera origin. Changed camera geometry invalidates the capture. Android remains later work.

The pinned local OpenCV.js Worker detects genuine generated markers in Chrome. The printable target also passes detector tests. Physical camera accuracy and the exact starter-kit components remain unverified.

## Verify an exported packet

```sh
npm run verify:packet -- /path/to/packet.json APPROVED_WORK_ORDER_DIGEST
```

Use the approved work-order digest from an independent trusted source. Without that argument, the verifier checks internal consistency only. It reconstructs receipt verification at the original capture time, placement, inspection, acceptance limits, and artifact digests. It rejects edited commitments. It does not establish independent owner approval, physical truth, live payment, or current contract state.

Artifacts use SHA-256 over sorted JSON with lowercase `0x` digests. Contact request identifiers derive from the work-order digest, capture identifier, and step. The signed receipt therefore binds to one attempt. Later inspection does not refresh the original reading.

## Verify the implementation

From `application/`:

```sh
npm run format:check
npm run check
npm test
npm audit --omit=dev --audit-level=high
```

Tests run serially to keep browser lifecycle checks isolated. They cover the retained observation lab, commissioning interface, tampering, concurrent capture, subprocess restart, marker detection, camera cleanup, and optical evaluation. The app serves browser modules directly. No compilation or type-check command exists.

Install the isolated integration dependencies before their checks:

```sh
npm --prefix integrations/masumi ci --ignore-scripts
npm --prefix api3 ci
npm run test:integrations
```

Both integration packages declare their own formatting, syntax, and audit commands. See [engineering](docs/ENGINEERING.md) for exact commands and interface details.

The Solidity suite requires the Foundry `forge` and `anvil` executables. Set `FIELDPROOF_FOUNDRY_BIN` to their directory for the actual local deployment test:

```sh
FIELDPROOF_FOUNDRY_BIN=/path/to/foundry/bin npm run test:contract
```

From `application/contracts/`, run that directory's Foundry executable with `fmt --check` and `test`. On this host, bare `forge` names an unrelated tool. Use the explicit Foundry path.

## Integration status

| Component | Verified local behavior | Remaining evidence |
|---|---|---|
| Coordinator | Immutable approval, fresh signed transitions, durable claims, export and independent reconstruction | Complete physical installation and external acceptance integration |
| Camera | Real OpenCV detection, planar guidance, calibration-change rejection, cleanup, printable target | Measured physical accuracy and authenticated optical execution |
| Masumi | Useful deterministic inspector, exact transport hashes, durable Task/payment recovery, seller-receipt checks, refund fixtures | Authorized account/resources, actual execution, settlement, seller receipt and refund collection |
| API3 | Native verifier, bounded CVE evaluator, commissioning contract, unsigned calls, pinned commitment reader, actual local Anvil deployment | Genuine paid CVE response, deployed target contract and live rejection evidence |
| Direct Cardano baseline | Original x402 adapter, payment ledger and restart checks | Live Preprod settlement and physical-board compatibility |

The Masumi adapter remains separate from direct x402. Its fixture runner returns a useful FAIL report with `sellerPaid:false`. The adapter trusts the configured Masumi Payment Service for signed terms. It does not independently verify their COSE signature.

The API3 policy addresses **CVE-2025-62235 only** for explicitly enrolled NimBLE reference builds. A 1.9.0 result does not establish general software security. The current board's installed build remains unknown. Contract inspection/payment records are operator assertions about Cardano. They do not verify Cardano consensus.

## Retained observation lab

Open <http://127.0.0.1:4021/observation.html> for the original paid-observation interface. Its direct Preprod adapter uses 2 tADA per observation plus fees. Simulation moves no funds.

The lab retains the original P-256 verifier, direct-payment ledger, Python Bluetooth reader, buyer CLI, and ten-second dispatch expiry. Its open-contact DISPATCH mapping does not establish commissioning acceptance or safe physical dispatch. No decision actuates equipment.

The [configuration example](application/.env.example) describes the separately authorized physical/direct-payment path. Keep receipt pins, board secrets, wallets, provider keys, and runtime records outside source. Both server and buyer require `FIELDPROOF_SPEND_AUTHORIZED=true` before payment. See [engineering](docs/ENGINEERING.md) for recovery rules.

Runtime data defaults to the user state directory. `FIELDPROOF_STATE_DIR` selects another location. Use a separate directory for a changed mode, provider, key, or payment recipient. Preserve unresolved payment records. No destructive reset exists.

## Current execution index

The [implementation plan](PROOF_OF_READY_IMPLEMENTATION_PLAN.md) defines the full target and owner decisions. The [execution directive](PROOF_OF_READY_AGENT_HANDOFF.md) defines ownership. [Engineering](docs/ENGINEERING.md) defines actual interfaces. [Evidence](research/EVIDENCE.md) records verified facts and limits.

Continue with board identification and a measured camera test, then a board-specific optical driver. Prepare authorized Masumi resources and genuine API3 data independently. Connect the resulting paid report and pinned contract decision to coordinator acceptance. The current interface does not expose a shortcut to READY.

A full starter kit is available. Its exact board and components remain unknown. Laptop webcam comes first. Equipment connection can wait. Commercial validation remains a hypothesis and does not block engineering.

Reviewed source and documentation remain in a private GitHub repository. Original inputs, private historical notes, secrets, and runtime records remain local. Preserve the sibling FieldProof and capmesh projects. Public release, payments, account/resource creation, hardware flashing, actuation, deployment, and submission require targeted authorization.
