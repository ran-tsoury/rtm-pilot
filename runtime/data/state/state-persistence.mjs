import {
  MEMORY_SCHEMA,
  JOURNEY_SCHEMA,
  INTERVENTION_SCHEMA,
} from "./schema-mapping.mjs";

import {
  MEMORY_STATUS,
  isMemoryApplicable,
} from "../memory/memory-store.mjs";

import {
  EXPERIENCE_STATUS,
  OUTCOME_STATUS,
} from "../experience/experience-lifecycle.mjs";

function requireRepositories(repositories) {
  if (
    !repositories ||
    typeof repositories !== "object" ||
    typeof repositories.selectOwned !== "function" ||
    typeof repositories.insertOwned !== "function" ||
    typeof repositories.updateOwned !== "function"
  ) {
    throw new Error(
      "Verified runtime repositories are required"
    );
  }

  if (
    typeof repositories.ownerId !== "string" ||
    repositories.ownerId.trim() === ""
  ) {
    throw new Error(
      "Verified repository owner is required"
    );
  }

  return repositories;
}

function requireObject(value, field) {
  if (!value || typeof value !== "object") {
    throw new Error(`${field} is required`);
  }

  return value;
}

function requireNonEmptyString(value, field) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function nullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      "Expected string or null"
    );
  }

  const normalized = value.trim();

  return normalized === ""
    ? null
    : normalized;
}

function confidenceToStorage(value) {
  if (value === null || value === undefined) {
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

function assertOwnerMatches(
  repositories,
  assertedUserId
) {
  if (
    assertedUserId !== null &&
    assertedUserId !== undefined &&
    assertedUserId !== repositories.ownerId
  ) {
    throw new Error(
      "Caller-selected ownership does not match authenticated owner"
    );
  }
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0
    ? rows[0]
    : null;
}

export function createStatePersistence(
  repositories
) {
  const repo =
    requireRepositories(repositories);

  async function loadJourneyState() {
    const rows = await repo.selectOwned(
      JOURNEY_SCHEMA.table,
      {
        limit: 1,
      }
    );

    const row = firstRow(rows);

    if (!row) {
      return null;
    }

    return Object.freeze({
      id: row.id,
      currentStage: row.current_stage,
      currentState: row.current_state ?? null,
      currentLoad: row.current_load ?? null,
      supportLevel: row.support_mode ?? null,
      context: row.current_context ?? null,
      contextConfidence:
        row.context_confidence ?? null,
      openContextExceptions:
        row.open_context_exceptions ?? [],
      lastRealityGateAt:
        row.last_reality_gate_at ?? null,
      lastMeaningfulReturnAt:
        row.last_meaningful_return_at ?? null,
      updatedAt:
        row.updated_at ?? null,
    });
  }

  async function saveJourneyState(
    journeyState,
    {
      contextConfidence = null,
      openContextExceptions = [],
      lastRealityGateAt = null,
      lastMeaningfulReturnAt = null,
    } = {}
  ) {
    const state =
      requireObject(
        journeyState,
        "journeyState"
      );

    const payload = {
      current_stage:
        state.currentStage,

      current_state:
        state.currentState ?? null,

      current_load:
        state.currentLoad ?? null,

      support_mode:
        state.supportLevel ??
        "STANDARD",

      current_context:
        state.context ?? null,

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

      last_reality_gate_at:
        lastRealityGateAt ?? null,

      last_meaningful_return_at:
        lastMeaningfulReturnAt ?? null,
    };

    const existing =
      await loadJourneyState();

    if (existing?.id) {
      const rows =
        await repo.updateOwned(
          JOURNEY_SCHEMA.table,
          existing.id,
          payload
        );

      return firstRow(rows);
    }

    const rows =
      await repo.insertOwned(
        JOURNEY_SCHEMA.table,
        payload
      );

    return firstRow(rows);
  }

  async function listMemoryItems({
    limit = 100,
  } = {}) {
    return repo.selectOwned(
      MEMORY_SCHEMA.table,
      {
        orderBy: "created_at",
        ascending: false,
        limit,
      }
    );
  }

  async function saveMemoryRecord(
    memoryRecord,
    {
      memoryLevel,
      memoryType,
      content,
      sourceEpisodeId = null,
      doNotReuse = false,
    } = {}
  ) {
    const record =
      requireObject(
        memoryRecord,
        "memoryRecord"
      );

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
        requireNonEmptyString(
          content,
          "content"
        ),

      status:
        requireNonEmptyString(
          record.status,
          "memoryRecord.status"
        ),

      confidence:
        confidenceToStorage(
          record.confidence
        ),

      source_episode_id:
        sourceEpisodeId ?? null,

      supersedes_memory_id:
        record.supersedesId ?? null,

      do_not_reuse:
        Boolean(doNotReuse),
    };

    const rows =
      await repo.insertOwned(
        MEMORY_SCHEMA.table,
        payload
      );

    return firstRow(rows);
  }

  async function markMemorySuperseded(
    memoryId
  ) {
    const id =
      requireNonEmptyString(
        memoryId,
        "memoryId"
      );

    const rows =
      await repo.updateOwned(
        MEMORY_SCHEMA.table,
        id,
        {
          status:
            MEMORY_STATUS.SUPERSEDED,

          do_not_reuse:
            true,
        }
      );

    return firstRow(rows);
  }

  async function loadApplicableMemory({
    currentContext = null,
    limit = 100,
  } = {}) {
    const rows =
      await listMemoryItems({
        limit,
      });

    return rows.filter((row) => {
      const record = {
        status: row.status,
        context:
          row.context ?? null,
      };

      if (row.do_not_reuse === true) {
        return false;
      }

      return isMemoryApplicable({
        record,
        currentContext,
      });
    });
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
        episodeId ?? null,

      route:
        nullableString(route),

      tool_family:
        nullableString(toolFamily),

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
        record.context ?? null,

      suggested_at:
        record.suggestedAt ??
        new Date().toISOString(),

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

    return firstRow(rows);
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

    const payload = {};

    switch (record.status) {
      case EXPERIENCE_STATUS.SELECTED:
        payload.selected_action =
          requireNonEmptyString(
            selectedAction,
            "selectedAction"
          );
        break;

      case EXPERIENCE_STATUS.EXECUTED:
        payload.executed_action =
          requireNonEmptyString(
            executedAction,
            "executedAction"
          );

        payload.executed_at =
          record.executedAt ??
          new Date().toISOString();
        break;

      case EXPERIENCE_STATUS.OUTCOME:
        payload.outcome =
          record.outcomeNote ?? null;

        payload.outcome_status =
          record.outcome ??
          OUTCOME_STATUS.UNKNOWN;

        payload.outcome_at =
          record.outcomeAt ??
          new Date().toISOString();
        break;

      case EXPERIENCE_STATUS.CONFIDENCE:
        payload.reliability_confidence =
          confidenceToStorage(
            record.confidence
          );
        break;

      default:
        throw new Error(
          `Unsupported persisted experience transition: ${record.status}`
        );
    }

    const rows =
      await repo.updateOwned(
        INTERVENTION_SCHEMA.table,
        id,
        payload
      );

    return firstRow(rows);
  }

  return Object.freeze({
    ownerId:
      repo.ownerId,

    loadJourneyState,
    saveJourneyState,

    listMemoryItems,
    saveMemoryRecord,
    markMemorySuperseded,
    loadApplicableMemory,

    saveSuggestedExperience,
    persistExperienceTransition,
  });
}