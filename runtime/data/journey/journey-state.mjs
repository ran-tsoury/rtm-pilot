export const JOURNEY_STAGE = Object.freeze({
  STAGE_1: 1,
  STAGE_2: 2,
  STAGE_3: 3,
  STAGE_4: 4,
  STAGE_5: 5,
  STAGE_6: 6,
  STAGE_7: 7,
});

const VALID_STAGES = new Set(
  Object.values(JOURNEY_STAGE)
);

function requireStage(stage) {
  if (!VALID_STAGES.has(stage)) {
    throw new Error(`Unsupported journey stage: ${stage}`);
  }

  return stage;
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

function normalizeEvidenceIds(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("evidenceIds must be an array");
  }

  return Object.freeze(
    value.map((id) => {
      if (
        typeof id !== "string" ||
        id.trim() === ""
      ) {
        throw new Error(
          "Every evidence ID must be a non-empty string"
        );
      }

      return id.trim();
    })
  );
}

export function createJourneyState({
  currentStage = JOURNEY_STAGE.STAGE_1,
  currentState = null,
  currentLoad = null,
  supportLevel = null,
  context = null,
  observedAt = null,
  stageUpdatedAt = null,
  stageEvidenceIds = [],
} = {}) {
  return Object.freeze({
    currentStage: requireStage(currentStage),

    currentState:
      currentState === undefined
        ? null
        : currentState,

    currentLoad:
      normalizeOptionalString(currentLoad),

    supportLevel:
      normalizeOptionalString(supportLevel),

    context:
      normalizeOptionalString(context),

    observedAt:
      observedAt === undefined
        ? null
        : observedAt,

    stageUpdatedAt:
      stageUpdatedAt === undefined
        ? null
        : stageUpdatedAt,

    stageEvidenceIds:
      normalizeEvidenceIds(stageEvidenceIds),
  });
}

export function reobserveCurrentState(
  previousJourneyState,
  {
    currentState,
    currentLoad = null,
    supportLevel = null,
    context = null,
    observedAt = null,
  } = {}
) {
  if (
    !previousJourneyState ||
    typeof previousJourneyState !== "object"
  ) {
    throw new Error(
      "previous journey state is required"
    );
  }

  requireStage(previousJourneyState.currentStage);

  return createJourneyState({
    ...previousJourneyState,

    currentState:
      currentState === undefined
        ? null
        : currentState,

    currentLoad,
    supportLevel,
    context,
    observedAt,

    currentStage:
      previousJourneyState.currentStage,

    stageUpdatedAt:
      previousJourneyState.stageUpdatedAt,

    stageEvidenceIds:
      previousJourneyState.stageEvidenceIds ?? [],
  });
}

export function promoteJourneyStage(
  previousJourneyState,
  {
    targetStage,
    realityGatePassed = false,
    evidenceIds = [],
    stageUpdatedAt = null,
  } = {}
) {
  if (
    !previousJourneyState ||
    typeof previousJourneyState !== "object"
  ) {
    throw new Error(
      "previous journey state is required"
    );
  }

  const currentStage =
    requireStage(previousJourneyState.currentStage);

  const nextStage =
    requireStage(targetStage);

  if (!realityGatePassed) {
    throw new Error(
      "Journey stage promotion requires a passed Reality Gate"
    );
  }

  const normalizedEvidenceIds =
    normalizeEvidenceIds(evidenceIds);

  if (normalizedEvidenceIds.length === 0) {
    throw new Error(
      "Journey stage promotion requires qualified evidence"
    );
  }

  if (nextStage <= currentStage) {
    throw new Error(
      "Journey stage promotion must move forward"
    );
  }

  if (nextStage !== currentStage + 1) {
    throw new Error(
      "Journey stage promotion cannot skip stages"
    );
  }

  return createJourneyState({
    ...previousJourneyState,

    currentStage: nextStage,

    stageUpdatedAt:
      stageUpdatedAt === undefined
        ? null
        : stageUpdatedAt,

    stageEvidenceIds:
      normalizedEvidenceIds,
  });
}

export function updateSupportLevel(
  previousJourneyState,
  {
    supportLevel = null,
    currentLoad = null,
    observedAt = null,
  } = {}
) {
  if (
    !previousJourneyState ||
    typeof previousJourneyState !== "object"
  ) {
    throw new Error(
      "previous journey state is required"
    );
  }

  return createJourneyState({
    ...previousJourneyState,

    currentStage:
      previousJourneyState.currentStage,

    supportLevel,
    currentLoad,
    observedAt,

    stageUpdatedAt:
      previousJourneyState.stageUpdatedAt,

    stageEvidenceIds:
      previousJourneyState.stageEvidenceIds ?? [],
  });
}

export function canPromoteJourneyStage({
  currentStage,
  targetStage,
  realityGatePassed = false,
  evidenceIds = [],
} = {}) {
  if (
    !VALID_STAGES.has(currentStage) ||
    !VALID_STAGES.has(targetStage)
  ) {
    return false;
  }

  if (!realityGatePassed) {
    return false;
  }

  if (
    !Array.isArray(evidenceIds) ||
    evidenceIds.length === 0
  ) {
    return false;
  }

  return targetStage === currentStage + 1;
}