export const EVIDENCE_TYPE =
  Object.freeze({
    RECOGNITION:
      "RTM-09-EVD-001",

    ACTION:
      "RTM-09-EVD-002",

    OUTCOME:
      "RTM-09-EVD-003",

    REPEATED:
      "RTM-09-EVD-004",

    GENERALIZED:
      "RTM-09-EVD-005",

    RECOVERY:
      "RTM-09-EVD-006",

    AUTONOMY:
      "RTM-09-EVD-007",

    IDENTITY:
      "RTM-09-EVD-008",
  });

export const EVIDENCE_ADMISSION_STATUS =
  Object.freeze({
    CANDIDATE:
      "CANDIDATE",

    ACCEPTED:
      "ACCEPTED",

    REJECTED:
      "REJECTED",
  });

export const EVIDENCE_STRENGTH =
  Object.freeze({
    E0:
      "E0",

    E1:
      "E1",

    E2:
      "E2",

    E3:
      "E3",

    E4:
      "E4",

    E5:
      "E5",
  });

export const GATE_DECISION_CONFIDENCE =
  Object.freeze({
    LOW:
      "LOW",

    MEDIUM:
      "MEDIUM",

    HIGH:
      "HIGH",
  });

export const GATE_NEXT_ACTION =
  Object.freeze({
    PASS:
      "PASS",

    STAY:
      "STAY",

    DEEPEN:
      "DEEPEN",

    RECOVER:
      "RECOVER",

    REMAP:
      "REMAP",
  });

export const EVIDENCE_SCHEMA_VERSION =
  1;

function requireObject(
  value,
  field
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
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

function optionalString(
  value,
  field
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
      `${field} must be a string or null`
    );
  }

  const normalized =
    value.trim();

  return normalized === ""
    ? null
    : normalized;
}

function requireEnumValue(
  value,
  allowed,
  field
) {
  if (
    !Object.values(
      allowed
    ).includes(value)
  ) {
    throw new Error(
      `Unsupported ${field}: ${value}`
    );
  }

  return value;
}

function requireConfidence(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      "confidence must be a number between 0 and 1"
    );
  }

  return value;
}

function normalizeBoolean(
  value,
  field
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "boolean"
  ) {
    throw new Error(
      `${field} must be boolean or null`
    );
  }

  return value;
}

function normalizeTimestamp(
  value,
  field
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    requireNonEmptyString(
      value,
      field
    );

  if (
    Number.isNaN(
      Date.parse(normalized)
    )
  ) {
    throw new Error(
      `${field} must be a valid timestamp`
    );
  }

  return normalized;
}

function hasMeaningfulValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string"
  ) {
    return (
      value.trim() !== ""
    );
  }

  return true;
}

function requireAdmissionReason(
  status,
  reason
) {
  const normalized =
    optionalString(
      reason,
      "admissionReason"
    );

  if (
    status ===
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED &&
    !normalized
  ) {
    throw new Error(
      "Accepted Evidence requires an admission reason"
    );
  }

  if (
    status ===
      EVIDENCE_ADMISSION_STATUS
        .REJECTED &&
    !normalized
  ) {
    throw new Error(
      "Rejected Evidence requires an admission reason"
    );
  }

  return normalized;
}

function validateAdmissionSemantics({
  admissionStatus,
  strength,
  relevance,
  reliability,
  attribution,
  contextKnown,
}) {
  if (
    admissionStatus ===
      EVIDENCE_ADMISSION_STATUS
        .CANDIDATE
  ) {
    if (
      strength !==
      EVIDENCE_STRENGTH.E0
    ) {
      throw new Error(
        "Evidence Candidate must remain at strength E0"
      );
    }

    return;
  }

  if (
    admissionStatus ===
      EVIDENCE_ADMISSION_STATUS
        .REJECTED
  ) {
    if (
      strength !==
      EVIDENCE_STRENGTH.E0
    ) {
      throw new Error(
        "Rejected Evidence cannot receive accepted Evidence strength"
      );
    }

    return;
  }

  if (
    admissionStatus ===
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED
  ) {
    if (
      strength ===
      EVIDENCE_STRENGTH.E0
    ) {
      throw new Error(
        "Accepted Evidence must be at least E1"
      );
    }

    if (
      relevance !== true
    ) {
      throw new Error(
        "Accepted Evidence requires relevance"
      );
    }

    if (
      reliability !== true
    ) {
      throw new Error(
        "Accepted Evidence requires reliability"
      );
    }

    if (
      attribution !== true
    ) {
      throw new Error(
        "Accepted Evidence requires attribution"
      );
    }

    if (
      contextKnown !== true
    ) {
      throw new Error(
        "Accepted Evidence requires known context"
      );
    }
  }
}

function validateStrengthSemantics({
  strength,
  repeated,
  generalized,
  resilient,
  independent,
}) {
  switch (strength) {
    case EVIDENCE_STRENGTH.E0:
    case EVIDENCE_STRENGTH.E1:
      return;

    case EVIDENCE_STRENGTH.E2:
      if (
        repeated !== true
      ) {
        throw new Error(
          "E2 Evidence requires repetition"
        );
      }
      return;

    case EVIDENCE_STRENGTH.E3:
      if (
        repeated !== true ||
        generalized !== true
      ) {
        throw new Error(
          "E3 Evidence requires repetition and generalization"
        );
      }
      return;

    case EVIDENCE_STRENGTH.E4:
      if (
        repeated !== true ||
        generalized !== true ||
        resilient !== true
      ) {
        throw new Error(
          "E4 Evidence requires repetition, generalization and resilience"
        );
      }
      return;

    case EVIDENCE_STRENGTH.E5:
      if (
        repeated !== true ||
        generalized !== true ||
        resilient !== true ||
        independent !== true
      ) {
        throw new Error(
          "E5 Evidence requires repetition, generalization, resilience and independence"
        );
      }
      return;

    default:
      throw new Error(
        `Unsupported Evidence strength: ${strength}`
      );
  }
}

function rejectAutomaticInflation({
  sourceKind,
  admissionStatus,
  evidenceType,
  strength,
}) {
  const normalizedSource =
    optionalString(
      sourceKind,
      "sourceKind"
    );

  if (
    admissionStatus !==
    EVIDENCE_ADMISSION_STATUS
      .ACCEPTED
  ) {
    return normalizedSource;
  }

  const prohibitedAutomaticSources =
    new Set([
      "APP_USE",
      "CONTENT_COMPLETION",
      "OPTION_SELECTION",
      "SUGGESTION",
      "WEIGHT",
      "IMAGE",
    ]);

  if (
    prohibitedAutomaticSources
      .has(
        normalizedSource
      )
  ) {
    throw new Error(
      `${normalizedSource} cannot become automatic Evidence`
    );
  }

  if (
    evidenceType ===
      EVIDENCE_TYPE.IDENTITY &&
    strength ===
      EVIDENCE_STRENGTH.E1
  ) {
    throw new Error(
      "A single Evidence event cannot establish Identity Evidence"
    );
  }

  return normalizedSource;
}

export function createEvidenceRecord(
  input
) {
  const source =
    requireObject(
      input,
      "evidence input"
    );

  const evidenceType =
    requireEnumValue(
      source.evidenceType,
      EVIDENCE_TYPE,
      "evidenceType"
    );

  const admissionStatus =
    requireEnumValue(
      source.admissionStatus ??
        EVIDENCE_ADMISSION_STATUS
          .CANDIDATE,
      EVIDENCE_ADMISSION_STATUS,
      "admissionStatus"
    );

  const strength =
    requireEnumValue(
      source.strength ??
        EVIDENCE_STRENGTH.E0,
      EVIDENCE_STRENGTH,
      "strength"
    );

  const relevance =
    normalizeBoolean(
      source.relevance,
      "relevance"
    );

  const reliability =
    normalizeBoolean(
      source.reliability,
      "reliability"
    );

  const attribution =
    normalizeBoolean(
      source.attribution,
      "attribution"
    );

  const contextKnown =
    normalizeBoolean(
      source.contextKnown,
      "contextKnown"
    );

  const repeated =
    normalizeBoolean(
      source.repeated,
      "repeated"
    );

  const generalized =
    normalizeBoolean(
      source.generalized,
      "generalized"
    );

  const resilient =
    normalizeBoolean(
      source.resilient,
      "resilient"
    );

  const independent =
    normalizeBoolean(
      source.independent,
      "independent"
    );

  validateAdmissionSemantics({
    admissionStatus,
    strength,
    relevance,
    reliability,
    attribution,
    contextKnown,
  });

  validateStrengthSemantics({
    strength,
    repeated,
    generalized,
    resilient,
    independent,
  });

  const sourceKind =
    rejectAutomaticInflation({
      sourceKind:
        source.sourceKind ??
        null,

      admissionStatus,

      evidenceType,

      strength,
    });

  const event =
    source.event ??
    null;

  const behavior =
    source.behavior ??
    null;

  const outcome =
    source.outcome ??
    null;

  if (
    !hasMeaningfulValue(
      event
    ) &&
    !hasMeaningfulValue(
      behavior
    ) &&
    !hasMeaningfulValue(
      outcome
    )
  ) {
    throw new Error(
      "Evidence requires an event, behavior or outcome"
    );
  }

  if (
    source.outcomeStatus ===
      "UNKNOWN" &&
    admissionStatus ===
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED
  ) {
    throw new Error(
      "UNKNOWN outcome cannot create accepted Evidence"
    );
  }

  const record =
    Object.freeze({
      schemaVersion:
        EVIDENCE_SCHEMA_VERSION,

      id:
        optionalString(
          source.id,
          "id"
        ),

      timestamp:
        normalizeTimestamp(
          source.timestamp,
          "timestamp"
        ),

      episodeId:
        optionalString(
          source.episodeId,
          "episodeId"
        ),

      identityStage:
        source.identityStage ??
        null,

      evidenceTarget:
        optionalString(
          source.evidenceTarget,
          "evidenceTarget"
        ),

      event,

      behavior,

      outcome,

      outcomeStatus:
        optionalString(
          source.outcomeStatus,
          "outcomeStatus"
        ),

      context:
        source.context ??
        null,

      state:
        source.state ??
        null,

      evidenceType,

      admissionStatus,

      admissionReason:
        requireAdmissionReason(
          admissionStatus,
          source.admissionReason
        ),

      strength,

      relevance,

      reliability,

      attribution,

      contextKnown,

      repeated,

      generalized,

      resilient,

      independent,

      sourceKind,

      confidence:
        requireConfidence(
          source.confidence
        ),

      linkedPrediction:
        optionalString(
          source.linkedPrediction,
          "linkedPrediction"
        ),

      linkedMeaning:
        optionalString(
          source.linkedMeaning,
          "linkedMeaning"
        ),

      linkedIdentityClaim:
        optionalString(
          source.linkedIdentityClaim,
          "linkedIdentityClaim"
        ),

      gateDecisionConfidence:
        source
          .gateDecisionConfidence ===
          null ||
        source
          .gateDecisionConfidence ===
          undefined
          ? null
          : requireEnumValue(
              source
                .gateDecisionConfidence,
              GATE_DECISION_CONFIDENCE,
              "gateDecisionConfidence"
            ),

      gateContribution:
        optionalString(
          source.gateContribution,
          "gateContribution"
        ),

      nextAction:
        source.nextAction ===
          null ||
        source.nextAction ===
          undefined
          ? null
          : requireEnumValue(
              source.nextAction,
              GATE_NEXT_ACTION,
              "nextAction"
            ),

      provenance:
        source.provenance ??
        null,
    });

  return record;
}

export function serializeEvidenceRecord(
  evidenceRecord
) {
  const canonical =
    createEvidenceRecord(
      evidenceRecord
    );

  return JSON.stringify(
    canonical
  );
}

export function deserializeEvidenceRecord(
  serialized
) {
  let decoded;

  if (
    typeof serialized ===
    "string"
  ) {
    try {
      decoded =
        JSON.parse(
          serialized
        );
    } catch {
      throw new Error(
        "Stored Evidence content is not valid JSON"
      );
    }
  } else {
    decoded =
      requireObject(
        serialized,
        "stored Evidence"
      );
  }

  if (
    decoded.schemaVersion !==
    EVIDENCE_SCHEMA_VERSION
  ) {
    throw new Error(
      "Unsupported Evidence schema version"
    );
  }

  return createEvidenceRecord(
    decoded
  );
}

export function admitEvidenceCandidate(
  candidate,
  {
    admissionReason,
    strength =
      EVIDENCE_STRENGTH.E1,

    relevance,
    reliability,
    attribution,
    contextKnown,

    repeated = false,
    generalized = false,
    resilient = false,
    independent = false,

    confidence = null,
  } = {}
) {
  const canonicalCandidate =
    createEvidenceRecord({
      ...requireObject(
        candidate,
        "candidate"
      ),

      admissionStatus:
        EVIDENCE_ADMISSION_STATUS
          .CANDIDATE,

      strength:
        EVIDENCE_STRENGTH.E0,
    });

  return createEvidenceRecord({
    ...canonicalCandidate,

    admissionStatus:
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED,

    admissionReason,

    strength,

    relevance,

    reliability,

    attribution,

    contextKnown,

    repeated,

    generalized,

    resilient,

    independent,

    confidence,
  });
}

export function rejectEvidenceCandidate(
  candidate,
  {
    admissionReason,
  } = {}
) {
  const canonicalCandidate =
    createEvidenceRecord({
      ...requireObject(
        candidate,
        "candidate"
      ),

      admissionStatus:
        EVIDENCE_ADMISSION_STATUS
          .CANDIDATE,

      strength:
        EVIDENCE_STRENGTH.E0,
    });

  return createEvidenceRecord({
    ...canonicalCandidate,

    admissionStatus:
      EVIDENCE_ADMISSION_STATUS
        .REJECTED,

    admissionReason,

    strength:
      EVIDENCE_STRENGTH.E0,
  });
}

export function isAcceptedEvidence(
  record
) {
  return Boolean(
    record &&
    typeof record === "object" &&
    record.admissionStatus ===
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED
  );
}