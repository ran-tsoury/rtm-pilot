export const EXPERIENCE_STATUS = Object.freeze({
  SUGGESTED: "SUGGESTED",
  SELECTED: "SELECTED",
  EXECUTED: "EXECUTED",
  OUTCOME: "OUTCOME",
  CONFIDENCE: "CONFIDENCE",
});

export const OUTCOME_STATUS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  POSITIVE: "POSITIVE",
  NEUTRAL: "NEUTRAL",
  NEGATIVE: "NEGATIVE",
  MIXED: "MIXED",
});

const VALID_EXPERIENCE_STATUSES = new Set(
  Object.values(EXPERIENCE_STATUS)
);

const VALID_OUTCOME_STATUSES = new Set(
  Object.values(OUTCOME_STATUS)
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

function requireLifecycle(record) {
  if (!record || typeof record !== "object") {
    throw new Error(
      "experience record is required"
    );
  }

  if (!VALID_EXPERIENCE_STATUSES.has(record.status)) {
    throw new Error(
      `Unsupported experience status: ${record.status}`
    );
  }

  return record;
}

export function createSuggestedExperience({
  id,
  userId,
  interventionId = null,
  context = null,
  suggestedAt = null,
} = {}) {
  return Object.freeze({
    id: requireNonEmptyString(id, "id"),
    userId: requireNonEmptyString(userId, "userId"),

    interventionId:
      normalizeOptionalString(interventionId),

    context:
      normalizeOptionalString(context),

    status:
      EXPERIENCE_STATUS.SUGGESTED,

    suggestedAt:
      suggestedAt ?? null,

    selectedAt: null,
    executedAt: null,

    outcome:
      OUTCOME_STATUS.UNKNOWN,

    outcomeNote: null,
    outcomeAt: null,

    confidence: null,
    confidenceAt: null,
  });
}

export function markExperienceSelected(
  previousRecord,
  {
    selectedAt = null,
  } = {}
) {
  const previous =
    requireLifecycle(previousRecord);

  if (
    previous.status !==
    EXPERIENCE_STATUS.SUGGESTED
  ) {
    throw new Error(
      "Only a SUGGESTED experience can become SELECTED"
    );
  }

  return Object.freeze({
    ...previous,

    status:
      EXPERIENCE_STATUS.SELECTED,

    selectedAt:
      selectedAt ?? null,
  });
}

export function markExperienceExecuted(
  previousRecord,
  {
    executedAt = null,
  } = {}
) {
  const previous =
    requireLifecycle(previousRecord);

  if (
    previous.status !==
    EXPERIENCE_STATUS.SELECTED
  ) {
    throw new Error(
      "Only a SELECTED experience can become EXECUTED"
    );
  }

  return Object.freeze({
    ...previous,

    status:
      EXPERIENCE_STATUS.EXECUTED,

    executedAt:
      executedAt ?? null,
  });
}

export function recordExperienceOutcome(
  previousRecord,
  {
    outcome = OUTCOME_STATUS.UNKNOWN,
    outcomeNote = null,
    outcomeAt = null,
  } = {}
) {
  const previous =
    requireLifecycle(previousRecord);

  if (
    previous.status !==
    EXPERIENCE_STATUS.EXECUTED
  ) {
    throw new Error(
      "Outcome can only be recorded after EXECUTED"
    );
  }

  if (!VALID_OUTCOME_STATUSES.has(outcome)) {
    throw new Error(
      `Unsupported outcome status: ${outcome}`
    );
  }

  return Object.freeze({
    ...previous,

    status:
      EXPERIENCE_STATUS.OUTCOME,

    outcome,

    outcomeNote:
      normalizeOptionalString(outcomeNote),

    outcomeAt:
      outcomeAt ?? null,
  });
}

export function recordExperienceConfidence(
  previousRecord,
  {
    confidence,
    confidenceAt = null,
  } = {}
) {
  const previous =
    requireLifecycle(previousRecord);

  if (
    previous.status !==
    EXPERIENCE_STATUS.OUTCOME
  ) {
    throw new Error(
      "Confidence can only be recorded after OUTCOME"
    );
  }

  return Object.freeze({
    ...previous,

    status:
      EXPERIENCE_STATUS.CONFIDENCE,

    confidence:
      normalizeConfidence(confidence),

    confidenceAt:
      confidenceAt ?? null,
  });
}

export function canTransitionExperience(
  currentStatus,
  targetStatus
) {
  if (
    !VALID_EXPERIENCE_STATUSES.has(currentStatus) ||
    !VALID_EXPERIENCE_STATUSES.has(targetStatus)
  ) {
    return false;
  }

  const transitionOrder = [
    EXPERIENCE_STATUS.SUGGESTED,
    EXPERIENCE_STATUS.SELECTED,
    EXPERIENCE_STATUS.EXECUTED,
    EXPERIENCE_STATUS.OUTCOME,
    EXPERIENCE_STATUS.CONFIDENCE,
  ];

  const currentIndex =
    transitionOrder.indexOf(currentStatus);

  const targetIndex =
    transitionOrder.indexOf(targetStatus);

  return targetIndex === currentIndex + 1;
}