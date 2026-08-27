export const RTM_STATE_TABLES = Object.freeze({
  MEMORY: "memory_items",
  JOURNEY: "journey_state",
  INTERVENTIONS: "interventions",
  EVIDENCE: "evidence",
});

export const MEMORY_SCHEMA = Object.freeze({
  table: RTM_STATE_TABLES.MEMORY,

  columns: Object.freeze({
    id: "id",
    userId: "user_id",
    level: "memory_level",
    type: "memory_type",
    content: "content",
    status: "status",
    confidence: "confidence",
    sourceEpisodeId: "source_episode_id",
    supersedesMemoryId: "supersedes_memory_id",
    doNotReuse: "do_not_reuse",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }),
});

export const JOURNEY_SCHEMA = Object.freeze({
  table: RTM_STATE_TABLES.JOURNEY,

  columns: Object.freeze({
    id: "id",
    userId: "user_id",
    currentStage: "current_stage",
    currentState: "current_state",
    currentLoad: "current_load",
    supportMode: "support_mode",
    currentContext: "current_context",
    contextConfidence: "context_confidence",
    openContextExceptions: "open_context_exceptions",
    lastRealityGateAt: "last_reality_gate_at",
    lastMeaningfulReturnAt: "last_meaningful_return_at",
    updatedAt: "updated_at",
  }),
});

export const INTERVENTION_SCHEMA = Object.freeze({
  table: RTM_STATE_TABLES.INTERVENTIONS,

  columns: Object.freeze({
    id: "id",
    userId: "user_id",
    episodeId: "episode_id",
    route: "route",
    toolFamily: "tool_family",
    suggestedAction: "suggested_action",
    selectedAction: "selected_action",
    executedAction: "executed_action",
    outcome: "outcome",
    outcomeStatus: "outcome_status",
    reliabilityConfidence: "reliability_confidence",
    context: "context",
    suggestedAt: "suggested_at",
    executedAt: "executed_at",
    outcomeAt: "outcome_at",
  }),
});

export const EVIDENCE_SCHEMA = Object.freeze({
  table: RTM_STATE_TABLES.EVIDENCE,

  columns: Object.freeze({
    id: "id",
    userId: "user_id",
    episodeId: "episode_id",
    evidenceType: "evidence_type",
    fact: "fact",
    meaning: "meaning",
    capability: "capability",
    context: "context",
    contextConfidence: "context_confidence",
    strength: "strength",
    admitted: "admitted",
    admittedAt: "admitted_at",
    createdAt: "created_at",
  }),
});

const ALLOWED_STATE_TABLES = new Set(
  Object.values(RTM_STATE_TABLES)
);

export function requireStateTable(table) {
  if (!ALLOWED_STATE_TABLES.has(table)) {
    throw new Error(
      `Unsupported RTM state table: ${table}`
    );
  }

  return table;
}

export function getStateSchema(name) {
  switch (name) {
    case "memory":
      return MEMORY_SCHEMA;

    case "journey":
      return JOURNEY_SCHEMA;

    case "interventions":
      return INTERVENTION_SCHEMA;

    case "evidence":
      return EVIDENCE_SCHEMA;

    default:
      throw new Error(
        `Unsupported RTM state schema: ${name}`
      );
  }
}