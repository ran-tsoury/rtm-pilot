import { createHash } from "node:crypto";

const SOURCE_BASELINE = "6428f79fdd7858698f02128a0786bfa5f92c9e33";
const WAVE = "D-05-WAVE1";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableAssetRecord(asset) {
  return {
    id: asset.id,
    code: asset.code,
    version: asset.version,
    owner: asset.owner,
    status: asset.status,
    authorityClass: asset.authorityClass,
    loadOrder: asset.loadOrder,
    checksum: sha256(asset.content),
  };
}

export function createRuntimeManifest(assets) {
  const inventory = [...assets]
    .sort((a, b) => a.loadOrder - b.loadOrder || a.id.localeCompare(b.id))
    .map(stableAssetRecord);

  const packageMaterial = JSON.stringify({
    wave: WAVE,
    sourceBaseline: SOURCE_BASELINE,
    inventory,
  });
  const packageChecksum = sha256(packageMaterial);

  return Object.freeze({
    manifestVersion: "1.0",
    releaseStatus: "CANDIDATE",
    wave: WAVE,
    sourceBaseline: SOURCE_BASELINE,
    packageId: `${WAVE}-${packageChecksum.slice(0, 16)}`,
    packageChecksum,
    assetInventory: Object.freeze(inventory.map(Object.freeze)),
    loadOrder: Object.freeze(inventory.map((asset) => asset.id)),
    finalDeploymentIdentity: null,
    environment: null,
    appVersionOrCommit: null,
    modelConfigVersion: null,
    dbMigrationOrSchemaVersion: null,
    rollbackTarget: null,
  });
}
