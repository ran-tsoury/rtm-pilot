import { CORE_OPERATING_RULES_V1 } from "../assets/core-operating-rules.v1.mjs";

export const APPROVED_RUNTIME_STATUSES = Object.freeze([
  "APPROVED FINAL",
  "LOCKED_PILOT",
]);

export const FORBIDDEN_AUTHORITY_CLASSES = Object.freeze([
  "FOUNDATION",
  "REFERENCE_ONLY",
  "AUDIT",
  "DRAFT",
  "REVIEW",
  "SUPERSEDED",
]);

export const RUNTIME_ASSET_REGISTRY = Object.freeze([
  CORE_OPERATING_RULES_V1,
]);
