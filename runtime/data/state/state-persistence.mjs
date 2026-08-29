import {
  requireVerifiedRuntimeRepositories,
} from "../supabase/repositories.mjs";

import {
  MEMORY_SCHEMA,
  JOURNEY_SCHEMA,
  INTERVENTION_SCHEMA,
  EVIDENCE_SCHEMA,
} from "./schema-mapping.mjs";

import {
  createMemoryRecord,
  serializeMemoryRecord,
  deserializeMemoryRecord,
  supersedeMemoryRecord,
  isMemoryApplicable,
} from "../memory/memory-store.mjs";

import {
  JOURNEY_STAGE,
  createJourneyState,
} from "../journey/journey-state.mjs";

import {
  EXPERIENCE_STATUS,
  OUTCOME_STATUS,
} from "../experience/experience-lifecycle.mjs";

import {
  EVIDENCE_ADMISSION_STATUS,
  createEvidenceRecord,
  serializeEvidenceRecord,
  deserializeEvidenceRecord,
  isAcceptedEvidence,
} from "../evidence/evidence-store.mjs";

function requireRepositories(
  repositories
) {
  return requireVerifiedRuntimeRepositories(
    repositories
  );
}

function requireObject(
  value,
  field
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      `${field} is required`
    );
  }

  return value;
}

function requireNonEmptyString(
  value,
  field
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${field} is required`
    );
  }

  return value.trim();
}

function nullableString(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new Error(
      "Expected string or null"
    );
  }

  const normalized =
    value.trim();

  return normalized === ""
    ? null
    : normalized;
}

function confidenceToStorage(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "UNKNOWN";
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

  return String(value);
}

function confidenceFromStorage(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === "UNKNOWN"
  ) {
    return null;
  }

  const numeric =
    Number(value);

  if (
    Number.isNaN(numeric) ||
    numeric < 0 ||
    numeric > 1
  ) {
    throw new Error(
      "Stored confidence is invalid"
    );
  }

  return numeric;
}

function assertOwnerMatches(
  repositories,
  assertedUserId
) {
  if (
    assertedUserId !== null &&
    assertedUserId !== undefined &&
    assertedUserId !==
      repositories.ownerId
  ) {
    throw new Error(
      "Caller-selected ownership does not match authenticated owner"
    );
  }
}

function firstRow(
  rows
) {
  return (
    Array.isArray(rows) &&
    rows.length > 0
  )
    ? rows[0]
    : null;
}

function toStorageText(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value.trim();

    return normalized === ""
      ? null
      : normalized;
  }

  return JSON.stringify(
    value
  );
}

function derivePersistedExperienceStatus(
  row
) {
  if (
    !row ||
    typeof row !== "object"
  ) {
    throw new Error(
      "Stored intervention is required"
    );
  }

  const hasSelected =
    typeof row.selected_action ===
      "string" &&
    row.selected_action.trim() !==
      "";

  const hasExecuted =
    typeof row.executed_action ===
      "string" &&
    row.executed_action.trim() !==
      "";

  const hasOutcome =
    row.outcome_at !== null &&
    row.outcome_at !== undefined;

  const hasConfidence =
    row.reliability_confidence !==
      null &&
    row.reliability_confidence !==
      undefined &&
    row.reliability_confidence !==
      "UNKNOWN";

  if (hasConfidence) {
    if (
      !hasOutcome ||
      !hasExecuted ||
      !hasSelected
    ) {
      throw new Error(
        "Persisted intervention lifecycle is inconsistent"
      );
    }

    return EXPERIENCE_STATUS
      .CONFIDENCE;
  }

  if (hasOutcome) {
    if (
      !hasExecuted ||
      !hasSelected
    ) {
      throw new Error(
        "Persisted intervention lifecycle is inconsistent"
      );
    }

    return EXPERIENCE_STATUS
      .OUTCOME;
  }

  if (hasExecuted) {
    if (!hasSelected) {
      throw new Error(
        "Persisted intervention lifecycle is inconsistent"
      );
    }

    return EXPERIENCE_STATUS
      .EXECUTED;
  }

  if (hasSelected) {
    return EXPERIENCE_STATUS
      .SELECTED;
  }

  if (
    typeof row.suggested_action ===
      "string" &&
    row.suggested_action.trim() !==
      ""
  ) {
    return EXPERIENCE_STATUS
      .SUGGESTED;
  }

  throw new Error(
    "Persisted intervention lifecycle cannot be determined"
  );
}

export function createStatePersistence(
  repositories
) {
  const repo =
    requireRepositories(
      repositories
    );

  async function loadJourneyState() {
    const rows =
      await repo.selectOwned(
        JOURNEY_SCHEMA.table,
        {
          limit: 1,
        }
      );

    const row =
      firstRow(rows);

    if (!row) {
      return null;
    }

    return Object.freeze({
      id:
        row.id,

      currentStage:
        row.current_stage,

      currentState:
        row.current_state ??
        null,

      currentLoad:
        row.current_load ??
        null,

      supportLevel:
        row.support_mode ??
        null,

      context:
        row.current_context ??
        null,

      contextConfidence:
        row.context_confidence ??
        null,

      openContextExceptions:
        row.open_context_exceptions ??
        [],

      lastRealityGateAt:
        row.last_reality_gate_at ??
        null,

      lastMeaningfulReturnAt:
        row.last_meaningful_return_at ??
        null,

      updatedAt:
        row.updated_at ??
        null,
    });
  }

  async function saveJourneyState(
    journeyState,
    {
      contextConfidence = null,
      openContextExceptions = [],
      lastMeaningfulReturnAt = null,
      lastRealityGateAt = null,
    } = {}
  ) {
    const input =
      requireObject(
        journeyState,
        "journeyState"
      );

    if (
      lastRealityGateAt !== null &&
      lastRealityGateAt !== undefined
    ) {
      throw new Error(
        "Reality Gate metadata cannot be written through ordinary state persistence"
      );
    }

    const state =
      createJourneyState({
        currentStage:
          input.currentStage,

        currentState:
          input.currentState ??
          null,

        currentLoad:
          input.currentLoad ??
          null,

        supportLevel:
          input.supportLevel ??
          null,

        context:
          input.context ??
          null,

        observedAt:
          input.observedAt ??
          null,

        stageUpdatedAt:
          input.stageUpdatedAt ??
          null,

        stageEvidenceIds:
          input.stageEvidenceIds ??
          [],
      });

    const existing =
      await loadJourneyState();

    const adaptivePayload = {
      current_state:
        state.currentState ??
        null,

      current_load:
        state.currentLoad ??
        null,

      support_mode:
        state.supportLevel ??
        "STANDARD",

      current_context:
        state.context ??
        null,

      context_confidence:
        nullableString(
          contextConfidence
        ),

      open_context_exceptions:
        Array.isArray(
          openContextExceptions
        )
          ? openContextExceptions
          : [],

      last_meaningful_return_at:
        lastMeaningfulReturnAt ??
        null,
    };

    if (existing?.id) {
      if (
        state.currentStage !==
        existing.currentStage
      ) {
        throw new Error(
          "Journey Stage cannot be changed through ordinary state persistence"
        );
      }

      const rows =
        await repo.updateOwned(
          JOURNEY_SCHEMA.table,
          existing.id,
          adaptivePayload
        );

      return firstRow(
        rows
      );
    }

    if (
      state.currentStage !==
      JOURNEY_STAGE.STAGE_1
    ) {
      throw new Error(
        "Initial Journey State must begin at Stage 1"
      );
    }

    const rows =
      await repo.insertOwned(
        JOURNEY_SCHEMA.table,
        {
          current_stage:
            JOURNEY_STAGE.STAGE_1,

          ...adaptivePayload,

          last_reality_gate_at:
            null,
        }
      );

    return firstRow(
      rows
    );
  }

  async function listMemoryItems({
    limit = 100,
  } = {}) {
    return repo.selectOwned(
      MEMORY_SCHEMA.table,
      {
        orderBy:
          "created_at",

        ascending:
          false,

        limit,
      }
    );
  }

  async function saveMemoryRecord(
    memoryRecord,
    {
      memoryLevel,
      memoryType,
      sourceEpisodeId = null,
      doNotReuse = false,
    } = {}
  ) {
    const canonical =
      createMemoryRecord(
        requireObject(
          memoryRecord,
          "memoryRecord"
        )
      );

    if (
      canonical.supersedesId
    ) {
      throw new Error(
        "Superseding memory requires the dedicated atomic supersession boundary"
      );
    }

    const payload = {
      memory_level:
        requireNonEmptyString(
          memoryLevel,
          "memoryLevel"
        ),

      memory_type:
        requireNonEmptyString(
          memoryType,
          "memoryType"
        ),

      content:
        serializeMemoryRecord(
          canonical
        ),

      status:
        canonical.status,

      confidence:
        confidenceToStorage(
          canonical.confidence
        ),

      source_episode_id:
        sourceEpisodeId ??
        null,

      supersedes_memory_id:
        null,

      do_not_reuse:
        Boolean(
          doNotReuse
        ),
    };

    const rows =
      await repo.insertOwned(
        MEMORY_SCHEMA.table,
        payload
      );

    return firstRow(
      rows
    );
  }

  async function loadCanonicalMemory({
    limit = 100,
  } = {}) {
    const rows =
      await listMemoryItems({
        limit,
      });

    return rows.map(
      (row) => {
        const record =
          deserializeMemoryRecord({
            content:
              row.content,

            status:
              row.status,

            confidence:
              confidenceFromStorage(
                row.confidence
              ),

            supersedesId:
              row
                .supersedes_memory_id ??
              null,
          });

        return Object.freeze({
          id:
            row.id,

          memoryLevel:
            row.memory_level,

          memoryType:
            row.memory_type,

          sourceEpisodeId:
            row.source_episode_id ??
            null,

          doNotReuse:
            row.do_not_reuse ===
            true,

          ...record,
        });
      }
    );
  }

  async function loadApplicableMemory({
    currentContext = null,
    limit = 100,
  } = {}) {
    const records =
      await loadCanonicalMemory({
        limit,
      });

    return records.filter(
      (record) => {
        if (
          record.doNotReuse ===
          true
        ) {
          return false;
        }

        return isMemoryApplicable({
          record,
          currentContext,
        });
      }
    );
  }

  async function supersedeMemory(
    previousRecord,
    replacementInput,
    {
      memoryLevel,
      memoryType,
      sourceEpisodeId = null,
    } = {}
  ) {
    const supersession =
      supersedeMemoryRecord(
        requireObject(
          previousRecord,
          "previousRecord"
        ),
        requireObject(
          replacementInput,
          "replacementInput"
        )
      );

    const replacement =
      supersession.replacement;

    const rows =
      await repo
        .supersedeMemoryOwned({
          previousId:
            replacement
              .supersedesId,

          memoryLevel:
            requireNonEmptyString(
              memoryLevel,
              "memoryLevel"
            ),

          memoryType:
            requireNonEmptyString(
              memoryType,
              "memoryType"
            ),

          content:
            serializeMemoryRecord(
              replacement
            ),

          status:
            replacement.status,

          confidence:
            confidenceToStorage(
              replacement
                .confidence
            ),

          sourceEpisodeId:
            sourceEpisodeId ??
            null,
        });

    return firstRow(
      rows
    );
  }

  async function listEvidence({
    limit = 100,
  } = {}) {
    return repo.selectOwned(
      EVIDENCE_SCHEMA.table,
      {
        orderBy:
          "created_at",

        ascending:
          false,

        limit,
      }
    );
  }

  async function saveEvidenceRecord(
    evidenceRecord,
    {
      admittedAt = null,
    } = {}
  ) {
    const canonical =
      createEvidenceRecord(
        requireObject(
          evidenceRecord,
          "evidenceRecord"
        )
      );

    if (
      canonical.admissionStatus !==
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED ||
      !isAcceptedEvidence(
        canonical
      )
    ) {
      throw new Error(
        "Only admitted Evidence may be persisted"
      );
    }

    const admittedTimestamp =
      admittedAt ??
      new Date()
        .toISOString();

    const physicalFact =
      canonical.event ??
      canonical.behavior ??
      canonical.outcome ??
      null;

    const canonicalContent =
      JSON.parse(
        serializeEvidenceRecord(
          canonical
        )
      );

    const payload = {
      episode_id:
        canonical.episodeId ??
        null,

      evidence_type:
        canonical.evidenceType,

      fact:
        toStorageText(
          physicalFact
        ),

      meaning:
        canonical.linkedMeaning ??
        null,

      capability:
        canonical.evidenceTarget ??
        null,

      context:
        canonical.context ??
        null,

      context_confidence:
        canonical.contextKnown ===
        true
          ? "KNOWN"
          : "UNKNOWN",

      strength:
        canonical.strength,

      admitted:
        true,

      admitted_at:
        admittedTimestamp,

      content:
        canonicalContent,

      outcome:
        toStorageText(
          canonical.outcome
        ),

      outcome_status:
        canonical.outcomeStatus ??
        null,

      confidence:
        canonical.confidence ??
        null,

      admission_status:
        canonical.admissionStatus,

      admission_reason:
        canonical.admissionReason,

      source_kind:
        canonical.sourceKind ??
        null,

      provenance:
        canonical.provenance ??
        null,

      observed_at:
        canonical.timestamp ??
        null,

      schema_version:
        canonical.schemaVersion,
    };

    const rows =
      await repo.insertOwned(
        EVIDENCE_SCHEMA.table,
        payload
      );

    return firstRow(
      rows
    );
  }

  async function loadCanonicalEvidence({
    limit = 100,
  } = {}) {
    const rows =
      await listEvidence({
        limit,
      });

    return rows.map(
      (row) => {
        if (
          !row.content
        ) {
          throw new Error(
            "Stored Evidence is missing canonical content"
          );
        }

        const canonical =
          deserializeEvidenceRecord(
            row.content
          );

        if (
          !isAcceptedEvidence(
            canonical
          )
        ) {
          throw new Error(
            "Durable Evidence must be admitted"
          );
        }

        return Object.freeze({
          id:
            row.id,

          createdAt:
            row.created_at ??
            null,

          admittedAt:
            row.admitted_at ??
            null,

          ...canonical,
        });
      }
    );
  }

  async function loadIntervention(
    interventionId
  ) {
    const id =
      requireNonEmptyString(
        interventionId,
        "interventionId"
      );

    const rows =
      await repo.selectOwned(
        INTERVENTION_SCHEMA.table
      );

    const row =
      rows.find(
        (candidate) =>
          candidate.id === id
      ) ??
      null;

    if (!row) {
      throw new Error(
        "Owner-scoped intervention was not found"
      );
    }

    return row;
  }

  async function saveSuggestedExperience(
    experienceRecord,
    {
      episodeId = null,
      route = null,
      toolFamily = null,
      suggestedAction,
    } = {}
  ) {
    const record =
      requireObject(
        experienceRecord,
        "experienceRecord"
      );

    assertOwnerMatches(
      repo,
      record.userId
    );

    if (
      record.status !==
      EXPERIENCE_STATUS.SUGGESTED
    ) {
      throw new Error(
        "Only SUGGESTED experience may create an intervention record"
      );
    }

    const payload = {
      episode_id:
        episodeId ??
        null,

      route:
        nullableString(
          route
        ),

      tool_family:
        nullableString(
          toolFamily
        ),

      suggested_action:
        requireNonEmptyString(
          suggestedAction,
          "suggestedAction"
        ),

      selected_action:
        null,

      executed_action:
        null,

      outcome:
        null,

      outcome_status:
        OUTCOME_STATUS.UNKNOWN,

      reliability_confidence:
        "UNKNOWN",

      context:
        record.context ??
        null,

      suggested_at:
        record.suggestedAt ??
        new Date()
          .toISOString(),

      executed_at:
        null,

      outcome_at:
        null,
    };

    const rows =
      await repo.insertOwned(
        INTERVENTION_SCHEMA.table,
        payload
      );

    return firstRow(
      rows
    );
  }

  async function persistExperienceTransition(
    interventionId,
    experienceRecord,
    {
      selectedAction = null,
      executedAction = null,
    } = {}
  ) {
    const id =
      requireNonEmptyString(
        interventionId,
        "interventionId"
      );

    const record =
      requireObject(
        experienceRecord,
        "experienceRecord"
      );

    assertOwnerMatches(
      repo,
      record.userId
    );

    const stored =
      await loadIntervention(
        id
      );

    const currentStatus =
      derivePersistedExperienceStatus(
        stored
      );

    const targetStatus =
      record.status;

    const allowedNext = {
      [EXPERIENCE_STATUS
        .SUGGESTED]:
        EXPERIENCE_STATUS
          .SELECTED,

      [EXPERIENCE_STATUS
        .SELECTED]:
        EXPERIENCE_STATUS
          .EXECUTED,

      [EXPERIENCE_STATUS
        .EXECUTED]:
        EXPERIENCE_STATUS
          .OUTCOME,

      [EXPERIENCE_STATUS
        .OUTCOME]:
        EXPERIENCE_STATUS
          .CONFIDENCE,
    };

    if (
      allowedNext[
        currentStatus
      ] !== targetStatus
    ) {
      throw new Error(
        `Illegal experience transition: ${currentStatus} -> ${targetStatus}`
      );
    }

    const payload = {};

    switch (
      targetStatus
    ) {
      case EXPERIENCE_STATUS
        .SELECTED:
        payload.selected_action =
          requireNonEmptyString(
            selectedAction,
            "selectedAction"
          );
        break;

      case EXPERIENCE_STATUS
        .EXECUTED:
        payload.executed_action =
          requireNonEmptyString(
            executedAction,
            "executedAction"
          );

        payload.executed_at =
          record.executedAt ??
          new Date()
            .toISOString();
        break;

      case EXPERIENCE_STATUS
        .OUTCOME:
        if (
          !Object.values(
            OUTCOME_STATUS
          ).includes(
            record.outcome
          )
        ) {
          throw new Error(
            "Unsupported experience outcome"
          );
        }

        payload.outcome =
          record.outcomeNote ??
          null;

        payload.outcome_status =
          record.outcome;

        payload.outcome_at =
          record.outcomeAt ??
          new Date()
            .toISOString();
        break;

      case EXPERIENCE_STATUS
        .CONFIDENCE:
        payload
          .reliability_confidence =
          confidenceToStorage(
            record.confidence
          );

        if (
          payload
            .reliability_confidence ===
          "UNKNOWN"
        ) {
          throw new Error(
            "CONFIDENCE transition requires a real confidence value"
          );
        }
        break;

      default:
        throw new Error(
          `Unsupported persisted experience transition: ${targetStatus}`
        );
    }

    const rows =
      await repo.updateOwned(
        INTERVENTION_SCHEMA.table,
        id,
        payload
      );

    const updated =
      firstRow(
        rows
      );

    if (!updated) {
      throw new Error(
        "Experience transition was not persisted"
      );
    }

    return updated;
  }

  return Object.freeze({
    ownerId:
      repo.ownerId,

    loadJourneyState,
    saveJourneyState,

    listMemoryItems,
    loadCanonicalMemory,
    saveMemoryRecord,
    loadApplicableMemory,
    supersedeMemory,

    listEvidence,
    saveEvidenceRecord,
    loadCanonicalEvidence,

    saveSuggestedExperience,
    persistExperienceTransition,
  });
}