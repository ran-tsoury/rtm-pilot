import { createHash } from "node:crypto";
import { RuntimeAuthorityError } from "./authority-error.mjs";
import {
  APPROVED_RUNTIME_STATUSES,
  FORBIDDEN_AUTHORITY_CLASSES,
  RUNTIME_ASSET_REGISTRY,
} from "../package/registry.mjs";
import { createRuntimeManifest } from "../package/manifest.mjs";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fail(code, message, details) {
  throw new RuntimeAuthorityError(code, message, details);
}

function validateAsset(asset, seenIds) {
  if (!asset || typeof asset !== "object") {
    fail("RTM_AUTH_INVALID_ASSET", "Runtime asset must be an object.");
  }
  for (const key of ["id", "code", "version", "owner", "status", "authorityClass", "content"]) {
    if (typeof asset[key] !== "string" || asset[key].trim() === "") {
      fail("RTM_AUTH_MISSING_FIELD", `Runtime asset is missing ${key}.`, { id: asset.id ?? null, key });
    }
  }
  if (!Number.isInteger(asset.loadOrder)) {
    fail("RTM_AUTH_INVALID_LOAD_ORDER", "Runtime asset loadOrder must be an integer.", { id: asset.id });
  }
  if (seenIds.has(asset.id)) {
    fail("RTM_AUTH_DUPLICATE_ASSET", "Duplicate runtime asset id.", { id: asset.id });
  }
  seenIds.add(asset.id);

  if (!APPROVED_RUNTIME_STATUSES.includes(asset.status)) {
    fail("RTM_AUTH_STATUS_REJECTED", "Runtime asset status is not authorized.", {
      id: asset.id,
      status: asset.status,
    });
  }
  if (FORBIDDEN_AUTHORITY_CLASSES.includes(asset.authorityClass)) {
    fail("RTM_AUTH_CLASS_REJECTED", "Runtime asset authority class is forbidden.", {
      id: asset.id,
      authorityClass: asset.authorityClass,
    });
  }
}

export function loadRuntimePackage({ registry = RUNTIME_ASSET_REGISTRY } = {}) {
  if (!Array.isArray(registry) || registry.length === 0) {
    fail("RTM_AUTH_EMPTY_REGISTRY", "Runtime asset registry must contain at least one approved asset.");
  }

  const seenIds = new Set();
  for (const asset of registry) validateAsset(asset, seenIds);

  const assets = [...registry].sort(
    (a, b) => a.loadOrder - b.loadOrder || a.id.localeCompare(b.id)
  );
  const manifest = createRuntimeManifest(assets);

  for (const assetRecord of manifest.assetInventory) {
    const asset = assets.find((candidate) => candidate.id === assetRecord.id);
    if (!asset || sha256(asset.content) !== assetRecord.checksum) {
      fail("RTM_AUTH_CHECKSUM_MISMATCH", "Runtime asset checksum mismatch.", {
        id: assetRecord.id,
      });
    }
  }

  const systemPrompt = assets.map((asset) => asset.content.trim()).join("\n\n");
  if (!systemPrompt) {
    fail("RTM_AUTH_EMPTY_PACKAGE", "Runtime package resolved to empty content.");
  }

  return Object.freeze({
    manifest,
    assets: Object.freeze(assets),
    systemPrompt,
  });
}
