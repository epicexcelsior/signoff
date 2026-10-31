# Proof of Ready

**Know before you approve.** Check the actual device before accepting the installation.

Proof of Ready binds an approved work order, camera measurements, signed device-test protocols, and a paid inspector report. Missing or failed evidence blocks acceptance.

## What the demonstration proves

- An actual Seeker camera measurement found incorrect placement and returned **REWORK**.
- An independent inspector reviewed that exact camera evidence and returned a useful **FAIL** report.
- Cardano Preprod escrow, result submission, withdrawal, and a positive seller receipt of **1 test USDM** verified.
- A separate ESP32 diagnostic returned a verified signature. A phone recording matched 72 of 72 optical symbols.
- Genuine paid NVD responses and deployed Base Sepolia signature checks exist. Four tamper cases replay successfully.

**API3 qualification is not established.** The original failed-inspection prerequisite forces REJECTED regardless of the authenticated CVE verdict. [Judge commands and the precise gap](docs/JUDGE.md) are provided.

**The physical installation is not accepted.** Correct placement, a complete fresh work-order-bound optical capture, button tests, and installed-build provenance remain incomplete.

The station is deterministic and operator-driven. It does not run autonomous LLM reasoning. Customer adoption, pricing, cost savings, and reduced revisits are unvalidated.

## Run locally

Use Node.js 24, Python 3, and a current desktop Chrome installation. The app binds to localhost. No wallet or service credentials are needed for the saved evidence and rehearsal.

```sh
cd application
npm ci
npm --prefix api3 ci
npm --prefix integrations/masumi ci
npm start
```

Open **http://127.0.0.1:4021/demo/** for saved real evidence. Wait for **Saved in this browser**. Select **Verify saved evidence**. After one load, this viewer can reopen without the coordinator. A Seeker Chrome saved load and offline hash check passed. Final portrait QA on the device remains unverified.

Open **http://127.0.0.1:4021/** for a labeled synthetic rehearsal. Confirm inspection requirements, choose a rehearsal condition, and select **Run rehearsal**. Rehearsal moves no funds and does not establish physical acceptance.

The saved viewer performs no capture, payment, or fresh chain verification. Explorer links require internet access. Actual hardware commissioning requires separately configured device identity and authorization. Private wallets and operator runtime records are not distributed.

## Check the source and evidence

```sh
cd application
npm test
npm run check
npm run format:check
npm run submission:check
npm run test:integrations
```

`submission:check` checks release boundaries and honest qualification status. It does not mean the submission is complete. Add `-- --require-ready` to fail when required submission evidence is missing.

For a browser outside the default Chrome path, set `FIELDPROOF_BROWSER_EXECUTABLE` to its executable path. Native firmware, Android, and contract builds are separate from the baseline browser demonstration.

## Evidence and trust

[Evidence index](docs/EVIDENCE.md) identifies the reviewed files. Original report, oracle, and payment proof files remain unchanged. The manifest designates the real-camera paid inspection separately from the earlier paid synthetic REVIEW.

Camera geometry trusts the declared reference size and common marker plane. A device signature identifies its key. It does not prove mounting or installed firmware. File hashes establish snapshot integrity, not fresh settlement or physical truth. The contract does not verify Cardano consensus.

This release excludes internal plans, account notes, operator handoffs, private documentation exports, credentials, runtime ledgers, and private Git history. Third-party licenses and OpenCV provenance remain with their source files.
