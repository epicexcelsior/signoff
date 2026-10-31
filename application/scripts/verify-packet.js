import { readFileSync } from "node:fs";
import { verifyPacket } from "../src/commissioning.js";

const [path, expectedWorkOrderDigest] = process.argv.slice(2);
if (!path) {
  console.error(
    "Usage: npm run verify:packet -- PACKET.json [APPROVED_WORK_ORDER_DIGEST]",
  );
  process.exitCode = 1;
} else {
  try {
    const packet = JSON.parse(readFileSync(path, "utf8"));
    console.log(
      JSON.stringify(verifyPacket(packet, expectedWorkOrderDigest), null, 2),
    );
  } catch (error) {
    console.error(
      `${error.code ?? "INVALID_PACKET"}: ${error instanceof SyntaxError ? "The packet is not valid JSON." : error.message}`,
    );
    process.exitCode = 1;
  }
}
