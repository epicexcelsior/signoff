import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodePacked,
  keccak256,
  toHex,
  encodeEventTopics,
  parseAbi,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  createNvdAccess,
  probeNvd,
  validateRequired,
  makePlan,
  encodeHeader,
  decodeHeader,
  confirmAccessPayment,
  AUSD,
  PAY_TO,
  ACCESS_NETWORK,
  NVD_URL,
  REQUEST_TEXT,
} from "../src/access.mjs";
import { verifyNvdResponse, NVD_REQUEST_HASH } from "../src/index.mjs";

const probe = JSON.parse(
  readFileSync(new URL("fixtures/nvd-payment-required.json", import.meta.url)),
);
const projected = JSON.parse(
  readFileSync(
    new URL("fixtures/nvd-cve-unsigned-projection.json", import.meta.url),
  ),
);
const now =
  Math.floor(Date.parse(projected.sourceGeneratedAt + "Z") / 1000) + 1;
const payer = privateKeyToAccount(generatePrivateKey());
const source = privateKeyToAccount(generatePrivateKey());
const tx = `0x${"ab".repeat(32)}`;
const abi = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "event AuthorizationUsed(address indexed authorizer,bytes32 indexed nonce)",
]);
async function sourceResponse({
  signer = source,
  requestHash = NVD_REQUEST_HASH,
  timestamp = now,
  edited = false,
} = {}) {
  const data = JSON.stringify(projected);
  const signature = await signer.signMessage({
    message: {
      raw: keccak256(
        encodePacked(
          ["bytes32", "uint256", "bytes"],
          [requestHash, BigInt(timestamp), toHex(data)],
        ),
      ),
    },
  });
  return {
    airnode: signer.address,
    requestHash,
    timestamp: String(timestamp),
    data: edited ? data + " " : data,
    signature,
  };
}
const settlement = () =>
  encodeHeader({
    success: true,
    network: ACCESS_NETWORK,
    payer: payer.address,
    transaction: tx,
  });
function receipt(plan) {
  const authorization = plan.typedData.message;
  return {
    transactionHash: tx,
    status: "success",
    blockNumber: 100n,
    blockHash: `0x${"cd".repeat(32)}`,
    logs: [
      {
        address: AUSD,
        topics: encodeEventTopics({
          abi,
          eventName: "Transfer",
          args: { from: payer.address, to: PAY_TO },
        }),
        data: encodeAbiParameters([{ type: "uint256" }], [10000n]),
      },
      {
        address: AUSD,
        topics: encodeEventTopics({
          abi,
          eventName: "AuthorizationUsed",
          args: { authorizer: payer.address, nonce: authorization.nonce },
        }),
        data: "0x",
      },
    ],
  };
}
function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "por-api3-access-"));
  const ledgerFile = join(dir, "access.sqlite");
  let current = now;
  const options = {
    ledgerFile,
    payer: payer.address,
    now: () => current,
    paymentsAuthorized: true,
    verifyResponse: (response, options) =>
      verifyNvdResponse(response, { ...options, signer: source.address }),
    ...overrides,
  };
  const service = createNvdAccess(options);
  t.after(() => {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    service,
    ledgerFile,
    options,
    setNow: (value) => {
      current = value;
    },
  };
}

test("unpaid probe sends only the pinned NVD request and preserves the actual original terms", async () => {
  let calls = 0;
  const result = await probeNvd({
    now: () => now,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, NVD_URL);
      assert.equal(options.body, REQUEST_TEXT);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers["payment-signature"], undefined);
      return new Response(probe.responseText, {
        status: 402,
        headers: {
          "content-type": "application/json",
          "payment-required": probe.requiredHeader,
        },
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.paid, false);
  assert.equal(result.requiredHeader, probe.requiredHeader);
  assert.equal(result.requestHash, NVD_REQUEST_HASH);
});

test("altered quote terms, unsupported transfer methods and malformed headers reject before preparation", () => {
  validateRequired(probe.required);
  for (const edit of [
    (t) => {
      t.scheme = "upto";
    },
    (t) => {
      t.network = "eip155:1";
    },
    (t) => {
      t.asset = `0x${"11".repeat(20)}`;
    },
    (t) => {
      t.payTo = payer.address;
    },
    (t) => {
      t.amount = "10001";
    },
    (t) => {
      t.amount = 10000;
    },
    (t) => {
      t.maxTimeoutSeconds = 301;
    },
    (t) => {
      t.extra.name = "USD Coin";
    },
    (t) => {
      t.extra.version = "2";
    },
    (t) => {
      t.extra.assetTransferMethod = "permit2";
    },
    (t) => {
      t.surprise = true;
    },
  ]) {
    const required = structuredClone(probe.required);
    edit(required.accepts[0]);
    assert.throws(() => validateRequired(required));
  }
  const other = structuredClone(probe.required);
  other.resource.url = "https://other.invalid/";
  assert.throws(() => validateRequired(other));
  assert.throws(() => decodeHeader("not base64"));
  assert.throws(() =>
    makePlan({ ...probe, requestText: "{}" }, payer.address, now),
  );
});

test("unsigned plans remain idempotent and budget/identity/concurrent writers cannot create replacement authorizations", (t) => {
  const f = fixture(t, { budgetAtomicUnits: "10000" });
  const prepared = f.service.prepare("first-probe", probe);
  assert.equal(prepared.stage, "PREPARED");
  assert.equal(prepared.plan.authorization, "UNSIGNED");
  assert.equal(prepared.payment, null);
  assert.equal(statSync(f.ledgerFile).mode & 0o777, 0o600);
  assert.deepEqual(f.service.prepare("first-probe", probe).plan, prepared.plan);
  assert.throws(() => f.service.prepare("replacement-probe", probe), {
    code: "ACCESS_UNRESOLVED",
  });
  const concurrent = createNvdAccess(f.options);
  try {
    assert.equal(concurrent.prepare("first-probe", probe).id, prepared.id);
    assert.throws(() => concurrent.prepare("new-intent-probe", probe), {
      code: "ACCESS_UNRESOLVED",
    });
  } finally {
    concurrent.close();
  }
  assert.throws(
    () => createNvdAccess({ ...f.options, payer: source.address }),
    { code: "ACCESS_CONFIG_MISMATCH" },
  );
  f.setNow(now + 301);
  assert.throws(() => f.service.prepare("after-expiry", probe), {
    code: "ACCESS_BUDGET",
  });
});

test("authorization gates stop signing/import/submission before a signer or HTTP call", async (t) => {
  let signatures = 0,
    fetches = 0;
  const f = fixture(t, {
    paymentsAuthorized: false,
    fetcher: async () => {
      fetches++;
      throw Error("must not run");
    },
  });
  const state = f.service.prepare("disabled-payment", probe);
  await assert.rejects(
    f.service.sign(state.id, {
      address: payer.address,
      signTypedData: async () => {
        signatures++;
        return "0x";
      },
    }),
    { code: "ACCESS_PAYMENT_DISABLED" },
  );
  await assert.rejects(
    f.service.importSignature(state.id, `0x${"00".repeat(65)}`),
    { code: "ACCESS_PAYMENT_DISABLED" },
  );
  await assert.rejects(f.service.send(state.id), {
    code: "ACCESS_PAYMENT_DISABLED",
  });
  assert.equal(signatures, 0);
  assert.equal(fetches, 0);
  assert.equal(f.service.get(state.id).stage, "PREPARED");
});

test("one paid HTTP retry preserves exact signed data and independently confirms the original token/nonce transfer", async (t) => {
  const response = await sourceResponse();
  let fetches = 0;
  let prepared;
  const client = {
    getChainId: async () => 84532,
    getTransactionReceipt: async () => receipt(prepared.plan),
    getBlockNumber: async () => 101n,
  };
  const f = fixture(t, {
    client,
    fetcher: async (url, options) => {
      fetches++;
      assert.equal(url, NVD_URL);
      assert.equal(options.body, REQUEST_TEXT);
      const payload = decodeHeader(options.headers["payment-signature"]);
      assert.equal(
        payload.payload.authorization.nonce,
        prepared.plan.typedData.message.nonce,
      );
      return new Response(JSON.stringify(response), {
        headers: {
          "content-type": "application/json",
          "payment-response": settlement(),
        },
      });
    },
  });
  prepared = f.service.prepare("real-shaped-response", probe);
  const signed = await f.service.sign(prepared.id, payer);
  assert.equal(signed.stage, "SIGNED");
  const delivered = await f.service.send(prepared.id);
  assert.equal(delivered.stage, "DELIVERED");
  assert.equal(delivered.source.verification.authenticated, true);
  assert.equal(delivered.source.response.data, response.data);
  assert.equal(delivered.rawResponseText, JSON.stringify(response));
  const settled = await f.service.reconcile(prepared.id);
  assert.equal(settled.stage, "SETTLED");
  assert.equal(settled.paymentCurrentlyVerified, true);
  assert.equal(settled.paymentConfirmation.transaction, tx);
  assert.equal(
    settled.paymentConfirmation.nonce,
    prepared.plan.typedData.message.nonce,
  );
  await assert.rejects(f.service.send(prepared.id), {
    code: "ACCESS_SUBMISSION_CLAIMED",
  });
  assert.equal(fetches, 1);
});

test("edited, wrong-request, wrong-key and stale signed source results remain unresolved without another paid call", async (t) => {
  const cases = [
    { edited: true },
    { requestHash: `0x${"11".repeat(32)}` },
    { signer: privateKeyToAccount(generatePrivateKey()) },
    { timestamp: now - 301 },
  ];
  for (const [index, variant] of cases.entries()) {
    let calls = 0;
    const response = await sourceResponse(variant);
    const f = fixture(t, {
      fetcher: async () => {
        calls++;
        return new Response(JSON.stringify(response), {
          headers: {
            "content-type": "application/json",
            "payment-response": settlement(),
          },
        });
      },
    });
    const prepared = f.service.prepare(`invalid-source-${index}`, probe);
    await f.service.sign(prepared.id, payer);
    const result = await f.service.send(prepared.id);
    assert.equal(result.stage, "UNRESOLVED");
    assert.equal(result.source, null);
    assert.equal(result.rawResponseText, JSON.stringify(response));
    await assert.rejects(f.service.send(prepared.id), {
      code: "ACCESS_SUBMISSION_CLAIMED",
    });
    assert.equal(calls, 1);
  }
});

test("lost signing and paid delivery survive restart and cannot mint a replacement nonce", async (t) => {
  const f = fixture(t, {
    fetcher: async () => {
      throw Error("lost response after send");
    },
  });
  const prepared = f.service.prepare("lost-response", probe);
  await f.service.sign(prepared.id, payer);
  const unknown = await f.service.send(prepared.id);
  assert.equal(unknown.stage, "UNRESOLVED");
  const restarted = createNvdAccess({
    ...f.options,
    fetcher: async () => {
      throw Error("REPEATED");
    },
  });
  try {
    const saved = restarted.get(prepared.id);
    assert.equal(saved.payment.encodedHeader, unknown.payment.encodedHeader);
    assert.equal(
      restarted.prepare("lost-response", probe).plan.typedData.message.nonce,
      prepared.plan.typedData.message.nonce,
    );
    assert.throws(() => restarted.prepare("new-payment-after-timeout", probe), {
      code: "ACCESS_UNRESOLVED",
    });
    await assert.rejects(restarted.send(prepared.id), {
      code: "ACCESS_SUBMISSION_CLAIMED",
    });
  } finally {
    restarted.close();
  }
  const another = fixture(t);
  const pending = another.service.prepare("lost-signature", probe);
  let calls = 0;
  await assert.rejects(
    another.service.sign(pending.id, {
      address: payer.address,
      signTypedData: async () => {
        calls++;
        throw Error("interrupted signer");
      },
    }),
  );
  assert.equal(another.service.get(pending.id).stage, "SIGNING");
  await assert.rejects(another.service.sign(pending.id, payer), {
    code: "ACCESS_SIGNING_CLAIMED",
  });
  const signature = await payer.signTypedData(pending.plan.typedData);
  assert.equal(
    (await another.service.importSignature(pending.id, signature)).stage,
    "SIGNED",
  );
  assert.equal(calls, 1);
});

test("payment reconciliation rejects altered token outputs, original nonce, chain, status and confirmation depth", async () => {
  const plan = makePlan(probe, payer.address, now);
  const original = receipt(plan);
  const check = async (edited, chain = 84532, head = 101n) =>
    confirmAccessPayment({
      client: {
        getChainId: async () => chain,
        getTransactionReceipt: async () => edited,
        getBlockNumber: async () => head,
      },
      plan,
      transaction: tx,
    });
  assert.equal((await check(original)).verified, true);
  await assert.rejects(check(original, 1));
  await assert.rejects(check(original, 84532, 100n));
  await assert.rejects(check({ ...original, status: "reverted" }));
  for (const change of [
    (r) => {
      r.logs[0].address = payer.address;
    },
    (r) => {
      r.logs[0].data = encodeAbiParameters([{ type: "uint256" }], [9999n]);
    },
    (r) => {
      r.logs[1].topics[2] = `0x${"00".repeat(32)}`;
    },
    (r) => {
      r.logs[0].topics[2] = encodeEventTopics({
        abi,
        eventName: "Transfer",
        args: { from: payer.address, to: source.address },
      })[2];
    },
  ]) {
    const altered = structuredClone(original);
    change(altered);
    await assert.rejects(check(altered));
  }
});

test("concurrent connections claim signing and submission exactly once", async (t) => {
  let releaseSign;
  const signWait = new Promise((resolve) => {
    releaseSign = resolve;
  });
  let releaseFetch;
  const fetchWait = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  let calls = 0;
  const response = await sourceResponse();
  const f = fixture(t, {
    fetcher: async () => {
      calls++;
      await fetchWait;
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  const second = createNvdAccess(f.options);
  try {
    const prepared = f.service.prepare("concurrent-claims", probe);
    const signing = f.service.sign(prepared.id, {
      address: payer.address,
      signTypedData: async (data) => {
        await signWait;
        return payer.signTypedData(data);
      },
    });
    await assert.rejects(second.sign(prepared.id, payer), {
      code: "ACCESS_SIGNING_CLAIMED",
    });
    releaseSign();
    await signing;
    const sending = f.service.send(prepared.id);
    await assert.rejects(second.send(prepared.id), {
      code: "ACCESS_SUBMISSION_CLAIMED",
    });
    releaseFetch();
    assert.equal((await sending).stage, "DELIVERED");
    assert.equal(calls, 1);
  } finally {
    releaseSign();
    releaseFetch();
    second.close();
  }
});

test("malformed settlement header remains saved for uncertain-payment recovery", async (t) => {
  const original = "malformed original settlement header";
  const f = fixture(t, {
    fetcher: async () =>
      new Response("undelivered", {
        headers: { "payment-response": original },
      }),
  });
  const state = f.service.prepare("malformed-settlement", probe);
  await f.service.sign(state.id, payer);
  const result = await f.service.send(state.id);
  assert.equal(result.stage, "UNRESOLVED");
  assert.equal(result.rawPaymentResponseHeader, original);
  await assert.rejects(f.service.send(state.id), {
    code: "ACCESS_SUBMISSION_CLAIMED",
  });
});
