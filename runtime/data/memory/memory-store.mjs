export const MEMORY_STATUS = Object.freeze({
  KNOWN: "KNOWN",
  UNKNOWN: "UNKNOWN",
  STALE: "STALE",
  CONTRADICTED: "CONTRADICTED",
  SUPERSEDED: "SUPERSEDED",
});

const VALID_STATUSES = new Set(
  Object.values(MEMORY_STATUS)
);

function requireNonEmptyString(value, field) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      "Optional string field must be a string or null"
    );
  }

  const normalized = value.trim();

  return normalized === "" ? null : normalized;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      "confidence must be between 0 and 1"
    );
  }

  return value;
}

export function createMemoryRecord({
  source,
  context = null,
  status = MEMORY_STATUS.UNKNOWN,
  confidence = null,
  value = null,
  observedAt = null,
  supersedesId = null,
} = {}) {
  const normalizedSource =
    requireNonEmptyString(source, "source");

  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `Unsupported memory status: ${status}`
    );
  }

  if (
    status === MEMORY_STATUS.UNKNOWN &&
    value !== null &&
    value !== undefined
  ) {
    throw new Error(
      "UNKNOWN memory cannot carry an inferred value"
    );
  }

  return Object.freeze({
    source: normalizedSource,
    context: normalizeOptionalString(context),
    status,
    confidence: normalizeConfidence(confidence),
    value:
      value === undefined
        ? null
        : value,
    observedAt:
      observedAt === undefined
        ? null
        : observedAt,
    supersedesId:
      normalizeOptionalString(supersedesId),
  });
}

export function supersedeMemoryRecord(
  previousRecord,
  replacementInput
) {
  if (
    !previousRecord ||
    typeof previousRecord !== "object"
  ) {
    throw new Error(
      "previous memory record is required"
    );
  }

  const previousId =
    requireNonEmptyString(
      previousRecord.id,
      "previousRecord.id"
    );

  const replacement =
    createMemoryRecord({
      ...replacementInput,
      supersedesId: previousId,
    });

  return Object.freeze({
    previous: Object.freeze({
      ...previousRecord,
      status: MEMORY_STATUS.SUPERSEDED,
    }),
    replacement,
  });
}

export function isMemoryApplicable({
  record,
  currentContext = null,
} = {}) {
  if (!record || typeof record !== "object") {
    return false;
  }

  if (
    record.status === MEMORY_STATUS.UNKNOWN ||
    record.status === MEMORY_STATUS.STALE ||
    record.status === MEMORY_STATUS.CONTRADICTED ||
    record.status === MEMORY_STATUS.SUPERSEDED
  ) {
    return false;
  }

  if (
    record.context &&
    currentContext &&
    record.context !== currentContext
  ) {
    return false;
  }

  return record.status === MEMORY_STATUS.KNOWN;
}