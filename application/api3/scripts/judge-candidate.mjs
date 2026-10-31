import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { AccessError, fail } from "../src/access-policy.mjs";
import {
  MAX_CANDIDATE_FILE_BYTES,
  parseCandidate,
  submissionCandidateSnapshot,
  judgeCandidate,
} from "../src/candidate.mjs";

const original = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../submission/evidence/${name}`, import.meta.url)),
  );
try {
  const [file, extra] = process.argv.slice(2);
  if (!file || extra)
    fail("CANDIDATE_USAGE", "Use judge:candidate -- RESPONSE_FILE.");
  const fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
  let bytes;
  try {
    if (!fstatSync(fd).isFile())
      fail("CANDIDATE_INPUT", "Use a regular bounded JSON response file.");
    const buffer = Buffer.alloc(MAX_CANDIDATE_FILE_BYTES + 1);
    let length = 0,
      read;
    while (
      length < buffer.length &&
      (read = readSync(fd, buffer, length, buffer.length - length, length)) > 0
    )
      length += read;
    bytes = buffer.subarray(0, length);
  } finally {
    closeSync(fd);
  }
  const candidate = parseCandidate(bytes);
  const snapshot = submissionCandidateSnapshot({
    deployment: original("deployment.json"),
    check: original("api3-five-deployed-cases.json"),
    evaluation: original("api3-policy-evaluation.json"),
  });
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org", {
      retryCount: 0,
      timeout: 20000,
    }),
  });
  console.log(
    JSON.stringify(
      await judgeCandidate({ client, snapshot, candidate }),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      networkWrites: false,
      observed: "INCONCLUSIVE",
      code:
        error instanceof AccessError ? error.code : "CANDIDATE_CHECK_FAILED",
      message:
        error instanceof AccessError
          ? error.message
          : "Check the input file and historical RPC availability. No transaction was sent.",
    }),
  );
  process.exitCode = 1;
}
