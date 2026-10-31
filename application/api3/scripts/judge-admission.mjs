import { openSync, closeSync, fstatSync, readSync, constants } from "node:fs";
import { parseCandidate, MAX_CANDIDATE_FILE_BYTES } from "../src/candidate.mjs";
import {
  judgeAdmissionCandidate,
  createAdmissionReader,
} from "../src/admission.mjs";

function boundedFile(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    if (!fstatSync(fd).isFile()) throw new Error("Use regular JSON files.");
    const buffer = Buffer.alloc(limit + 1);
    let length = 0,
      read;
    while (
      length < buffer.length &&
      (read = readSync(fd, buffer, length, buffer.length - length, length)) > 0
    )
      length += read;
    if (length > limit)
      throw new Error("The JSON input exceeds its size limit.");
    return buffer.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}
try {
  const [contextFile, responseFile, extra] = process.argv.slice(2);
  if (!contextFile || !responseFile || extra)
    throw new Error("Use judge:admission -- CONTEXT_FILE RESPONSE_FILE.");
  const snapshot = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      boundedFile(contextFile, 32768),
    ),
  );
  const candidate = parseCandidate(
    boundedFile(responseFile, MAX_CANDIDATE_FILE_BYTES),
  );
  const client = createAdmissionReader();
  console.log(
    JSON.stringify(
      await judgeAdmissionCandidate({ client, snapshot, candidate }),
      null,
      2,
    ),
  );
} catch {
  console.error(
    JSON.stringify({
      observed: "INCONCLUSIVE",
      networkWrites: false,
      message:
        "Use the reviewed Base Sepolia context, a bounded response file, and a historical RPC. No transaction was sent.",
    }),
  );
  process.exitCode = 1;
}
