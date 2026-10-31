import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fetchPersonalWorkspaceAccess,
  ensurePersonalWorkspace,
  verifyPersonalWorkspace,
} from "../node_modules/@masumi_network/sokosumi/dist/src/api/services/personal-workspace-service.js";
import { readRuntimeCredential } from "../node_modules/@masumi_network/sokosumi/dist/src/coworker/runtime-credentials.js";

test("pinned published CLI discovers the existing Personal Workspace without the removed access route or another write", async () => {
  const declared = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  const installed = JSON.parse(
    readFileSync(
      new URL(
        "../node_modules/@masumi_network/sokosumi/package.json",
        import.meta.url,
      ),
    ),
  );
  assert.equal(declared.dependencies["@masumi_network/sokosumi"], "1.1.0");
  assert.equal(installed.version, "1.1.0");
  const paths = [];
  const client = {
    get: async (path) => {
      paths.push(path);
      assert.equal(path, "/v1/users/me/workspaces");
      return {
        data: { workspaces: [{ id: "original-personal", kind: "personal" }] },
      };
    },
    post: async () =>
      assert.fail("The existing Personal Workspace must not be recreated."),
  };
  assert.equal(await fetchPersonalWorkspaceAccess(client), true);
  await ensurePersonalWorkspace(client);
  assert.equal(paths.length, 2);
});
test("published Personal Workspace verification rejects malformed responses and organization substitutions", async () => {
  await assert.rejects(
    fetchPersonalWorkspaceAccess({
      get: async () => ({ data: { hasPersonalWorkspace: true } }),
    }),
    /workspaces array/,
  );
  await assert.rejects(
    verifyPersonalWorkspace(
      { get: async () => ({ data: { organizationId: "other-organization" } }) },
      "01a18d31-87ab-7319-8a3d-90ecbd3de855",
    ),
    /personal Workspace/,
  );
});
test("published CLI retains the original Coworker credential format without creating a replacement key", () => {
  const key = "coworker_original-test-key";
  assert.equal(
    readRuntimeCredential("original-coworker", {
      isSupported: true,
      read: () => ({ apiKey: key }),
    }),
    key,
  );
});
