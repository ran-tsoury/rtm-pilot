import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimePackage } from "../runtime/authority/load-runtime-package.mjs";
import { RuntimeAuthorityError } from "../runtime/authority/authority-error.mjs";
import { RUNTIME_ASSET_REGISTRY } from "../runtime/package/registry.mjs";

const cloneAsset = (patch = {}) => ({ ...RUNTIME_ASSET_REGISTRY[0], ...patch });

test("loads the approved runtime package deterministically", () => {
  const first = loadRuntimePackage();
  const second = loadRuntimePackage();
  assert.equal(first.manifest.packageChecksum, second.manifest.packageChecksum);
  assert.equal(first.manifest.packageId, second.manifest.packageId);
  assert.deepEqual(first.manifest.loadOrder, ["core-operating-rules"]);
});

test("candidate manifest is tied to the observed source baseline", () => {
  const runtime = loadRuntimePackage();
  assert.equal(runtime.manifest.sourceBaseline, "6428f79fdd7858698f02128a0786bfa5f92c9e33");
  assert.equal(runtime.manifest.releaseStatus, "CANDIDATE");
  assert.equal(runtime.manifest.finalDeploymentIdentity, null);
});

test("manifest contains a real checksum for every packaged asset", () => {
  const runtime = loadRuntimePackage();
  assert.match(runtime.manifest.packageChecksum, /^[a-f0-9]{64}$/);
  for (const asset of runtime.manifest.assetInventory) {
    assert.match(asset.checksum, /^[a-f0-9]{64}$/);
  }
});

test("rejects DRAFT runtime authority", () => {
  assert.throws(
    () => loadRuntimePackage({ registry: [cloneAsset({ status: "DRAFT" })] }),
    (error) => error instanceof RuntimeAuthorityError && error.code === "RTM_AUTH_STATUS_REJECTED"
  );
});

test("rejects REVIEW runtime authority", () => {
  assert.throws(
    () => loadRuntimePackage({ registry: [cloneAsset({ status: "REVIEW" })] }),
    (error) => error instanceof RuntimeAuthorityError && error.code === "RTM_AUTH_STATUS_REJECTED"
  );
});

test("rejects Foundation/reference authority", () => {
  assert.throws(
    () => loadRuntimePackage({ registry: [cloneAsset({ authorityClass: "FOUNDATION" })] }),
    (error) => error instanceof RuntimeAuthorityError && error.code === "RTM_AUTH_CLASS_REJECTED"
  );
});

test("rejects duplicate asset identities", () => {
  assert.throws(
    () => loadRuntimePackage({ registry: [cloneAsset(), cloneAsset({ loadOrder: 101 })] }),
    (error) => error instanceof RuntimeAuthorityError && error.code === "RTM_AUTH_DUPLICATE_ASSET"
  );
});

test("fails closed when the registry is empty", () => {
  assert.throws(
    () => loadRuntimePackage({ registry: [] }),
    (error) => error instanceof RuntimeAuthorityError && error.code === "RTM_AUTH_EMPTY_REGISTRY"
  );
});

test("compiled runtime prompt preserves Safety precedence and no-catch-up constraints", () => {
  const runtime = loadRuntimePackage();
  assert.match(runtime.systemPrompt, /Safety overrides all ordinary RTM routes\./);
  assert.match(runtime.systemPrompt, /There is no streak pressure and no catch-up debt\./);
  assert.match(runtime.systemPrompt, /use TOOL FIRST/);
});
