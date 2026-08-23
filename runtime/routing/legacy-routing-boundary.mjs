import { RuntimeAuthorityError } from "../authority/authority-error.mjs";

export const LEGACY_ROUTING_BOUNDARY = Object.freeze({
  authoritative: false,
  mayOverrideRuntimePackage: false,
  fallbackAllowed: false,
});

export function rejectLegacyRuntimeFallback(reason = "Legacy runtime fallback is not authorized.") {
  throw new RuntimeAuthorityError(
    "RTM_LEGACY_FALLBACK_REJECTED",
    reason,
    LEGACY_ROUTING_BOUNDARY
  );
}
