# signoff

**Know before you approve.** Check the actual device before accepting the installation.

signoff provides remote acceptance tests for monitoring equipment installed by independent contractors. A facility operator reviews defect evidence and a paid inspector report before accepting the handover. Missing or failed checks block acceptance.

## What the demonstration proves

- An actual Seeker camera measurement found incorrect placement and returned **REWORK**.
- An independent inspector reviewed that exact camera evidence and returned a useful **FAIL** report.
- Cardano Preprod escrow, result submission, withdrawal, and a positive seller receipt of **1 test USDM** verified.
- A separate ESP32 diagnostic returned a verified signature. A phone recording matched 72 of 72 optical symbols.
- Genuine paid NVD responses and deployed Base Sepolia signature checks exist. Four tamper cases replay successfully.

**Software admission verified on Base Sepolia.** Fresh authenticated NVD data opened a software-gated work order before inspection. The four tamper cases reject. This admission covers a declared reference build and does not approve physical installation. [Judge commands and original artifacts](docs/JUDGE.md) preserve both the new admission and the earlier rejection.

**The physical installation is not accepted.** Correct placement, a complete fresh work-order-bound optical capture, button tests, and installed-build provenance remain incomplete.

The station is deterministic and operator-driven. It does not run autonomous LLM reasoning. Customer adoption, pricing, cost savings, and reduced revisits are unvalidated.

## API3 tamper test

Run `npm --prefix application/api3 run judge:admission:submission` from the repository root. [Judge commands and five response files](docs/JUDGE.md) cover valid admission and edited, stale, different-request, and wrong-key rejection. The commands read deployed Base Sepolia code and send no transaction. RPC failures are inconclusive.

## Run locally

Use Node.js 24, Python 3, and a current desktop Chrome installation. The app binds to localhost. No wallet or service credentials are needed for the saved evidence and rehearsal.

```sh
cd application
npm ci
npm --prefix api3 ci
npm --prefix integrations/masumi ci
npm start
```

Open **http://127.0.0.1:4021/demo/** for saved real evidence. Wait for **Saved in this browser**. Select **Verify saved evidence**. After one load, this viewer can reopen without the coordinator. The physical Seeker passed portrait rendering, offline reload, and all six file hashes with browser networking disabled.

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

The current source tree excludes internal plans, account notes, operator handoffs, private exports, credentials, and runtime ledgers. Earlier commits preserve development history. Third-party licenses and OpenCV provenance remain with their source files.
