import {
  isRuntimeAuthorityError,
} from "../../../runtime/authority/authority-error.mjs";

import {
  loadRuntimePackage,
} from "../../../runtime/authority/load-runtime-package.mjs";

import {
  createAuthenticatedSupabaseContext,
} from "../../../runtime/data/supabase/client.mjs";

import {
  createRuntimeRepositories,
} from "../../../runtime/data/supabase/repositories.mjs";

import {
  MEMORY_STATUS,
  createMemoryRecord,
  serializeMemoryRecord,
  deserializeMemoryRecord,
  isMemoryApplicable,
} from "../../../runtime/data/memory/memory-store.mjs";

import {
  createStatePersistence,
} from "../../../runtime/data/state/state-persistence.mjs";

import {
  EVIDENCE_TYPE,
  EVIDENCE_ADMISSION_STATUS,
  EVIDENCE_STRENGTH,
  createEvidenceRecord,
} from "../../../runtime/data/evidence/evidence-store.mjs";

import {
  OUTCOME_STATUS,
} from "../../../runtime/data/experience/experience-lifecycle.mjs";

function requireBearerToken(request) {
  const authorization =
    request.headers.get("authorization");

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error(
      "Missing authenticated participant token"
    );
  }

  const token =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    throw new Error(
      "Missing authenticated participant token"
    );
  }

  return token;
}

function normalizeProcessType(value) {
  if (value === "sos") {
    return "SOS";
  }

  if (value === "checkin") {
    return "CHECK_IN";
  }

  return "NEW_PROCESS";
}

function getLastUserMessage(messages) {
  for (
    let index = messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    const message = messages[index];

    if (message?.role === "user") {
      return String(
        message.content ?? ""
      ).trim();
    }
  }

  return "";
}

async function runMemoryE2E({
  command,
  repositories,
}) {
  if (
    process.env.NODE_ENV === "production"
  ) {
    return null;
  }

  if (
    command ===
    "D07:E2E:MEMORY:SEED"
  ) {
    const record =
      createMemoryRecord({
        source:
          "D07_E2E_AUTHENTICATED_PARTICIPANT",

        context:
          "D07_CONTEXT_A",

        status:
          MEMORY_STATUS.KNOWN,

        confidence:
          0.8,

        value:
          "ORIGINAL_VALUE",

        observedAt:
          new Date().toISOString(),
      });

    const rows =
      await repositories.insertOwned(
        "memory_items",
        {
          memory_level:
            "M1",

          memory_type:
            "D07_E2E_MEMORY",

          content:
            serializeMemoryRecord(
              record
            ),

          status:
            record.status,

          confidence:
            "single",

          source_episode_id:
            null,

          supersedes_memory_id:
            null,

          do_not_reuse:
            false,
        }
      );

    const created =
      Array.isArray(rows) &&
      rows.length > 0
        ? rows[0]
        : null;

    if (!created?.id) {
      throw new Error(
        "D07 E2E memory seed persistence failed"
      );
    }

    return {
      ok: true,
      reply:
        `D07 MEMORY SEED PASS | id=${created.id}`,
      e2e:
        "MEMORY_SEED",
      memoryId:
        created.id,
    };
  }

  if (
    command ===
    "D07:E2E:MEMORY:SUPERSEDE"
  ) {
    const rows =
      await repositories.selectOwned(
        "memory_items",
        {
          orderBy:
            "created_at",
          ascending:
            false,
          limit:
            100,
        }
      );

    const previous =
      rows.find(
        (row) =>
          row.memory_type ===
            "D07_E2E_MEMORY" &&
          row.status !==
            MEMORY_STATUS.SUPERSEDED
      );

    if (!previous?.id) {
      throw new Error(
        "D07 E2E previous memory was not found"
      );
    }

    const replacementRecord =
      createMemoryRecord({
        source:
          "D07_E2E_AUTHENTICATED_PARTICIPANT_CORRECTION",

        context:
          "D07_CONTEXT_B",

        status:
          MEMORY_STATUS.KNOWN,

        confidence:
          0.95,

        value:
          "CORRECTED_VALUE",

        observedAt:
          new Date().toISOString(),

        supersedesId:
          previous.id,
      });

    const replacementRows =
      await repositories
        .supersedeMemoryOwned({
          previousId:
            previous.id,

          memoryLevel:
            "M1",

          memoryType:
            "D07_E2E_MEMORY",

          content:
            serializeMemoryRecord(
              replacementRecord
            ),

          status:
            replacementRecord.status,

          confidence:
            "high",

          sourceEpisodeId:
            null,
        });

    const replacement =
      Array.isArray(
        replacementRows
      ) &&
      replacementRows.length > 0
        ? replacementRows[0]
        : null;

    if (!replacement?.id) {
      throw new Error(
        "D07 E2E memory supersession failed"
      );
    }

    return {
      ok: true,

      reply:
        `D07 MEMORY SUPERSESSION PASS | previous=${previous.id} | replacement=${replacement.id}`,

      e2e:
        "MEMORY_SUPERSESSION",

      previousId:
        previous.id,

      replacementId:
        replacement.id,
    };
  }

  if (
    command ===
    "D07:E2E:MEMORY:UNKNOWN"
  ) {
    const record =
      createMemoryRecord({
        source:
          "D07_E2E_UNKNOWN",

        context:
          "D07_UNKNOWN_CONTEXT",

        status:
          MEMORY_STATUS.UNKNOWN,

        confidence:
          null,

        value:
          null,

        observedAt:
          new Date().toISOString(),
      });

    const rows =
      await repositories.insertOwned(
        "memory_items",
        {
          memory_level:
            "M1",

          memory_type:
            "D07_E2E_UNKNOWN",

          content:
            serializeMemoryRecord(
              record
            ),

          status:
            record.status,

          confidence:
            "unknown",

          source_episode_id:
            null,

          supersedes_memory_id:
            null,

          do_not_reuse:
            false,
        }
      );

    const created =
      Array.isArray(rows) &&
      rows.length > 0
        ? rows[0]
        : null;

    if (!created?.id) {
      throw new Error(
        "D07 E2E UNKNOWN persistence failed"
      );
    }

    const decoded =
      deserializeMemoryRecord({
        content:
          created.content,

        status:
          created.status,

        confidence:
          null,

        supersedesId:
          created
            .supersedes_memory_id ??
          null,
      });

    if (
      decoded.status !==
        MEMORY_STATUS.UNKNOWN ||
      decoded.value !== null
    ) {
      throw new Error(
        "D07 E2E UNKNOWN was not preserved"
      );
    }

    return {
      ok: true,

      reply:
        `D07 UNKNOWN PRESERVATION PASS | id=${created.id}`,

      e2e:
        "UNKNOWN_PRESERVATION",

      memoryId:
        created.id,
    };
  }

  if (
    command ===
    "D07:E2E:MEMORY:CONTEXT"
  ) {
    const rows =
      await repositories.selectOwned(
        "memory_items",
        {
          orderBy:
            "created_at",
          ascending:
            false,
          limit:
            100,
        }
      );

    const stored =
      rows.find(
        (row) =>
          row.memory_type ===
            "D07_E2E_MEMORY" &&
          row.status ===
            MEMORY_STATUS.KNOWN
      );

    if (!stored?.id) {
      throw new Error(
        "D07 E2E context memory was not found"
      );
    }

    const decoded =
      deserializeMemoryRecord({
        content:
          stored.content,

        status:
          stored.status,

        confidence:
          null,

        supersedesId:
          stored
            .supersedes_memory_id ??
          null,
      });

    const applicableSameContext =
      isMemoryApplicable({
        record:
          decoded,
        currentContext:
          decoded.context,
      });

    const applicableOtherContext =
      isMemoryApplicable({
        record:
          decoded,
        currentContext:
          "D07_CONTEXT_THAT_DOES_NOT_MATCH",
      });

    if (
      applicableSameContext !== true ||
      applicableOtherContext !== false
    ) {
      throw new Error(
        "D07 E2E context isolation failed"
      );
    }

    return {
      ok: true,
      reply:
        "D07 CONTEXT NON-GENERALIZATION PASS",
      e2e:
        "CONTEXT_NON_GENERALIZATION",
      memoryId:
        stored.id,
    };
  }

  return null;
}

async function runEvidenceE2E({
  command,
  repositories,
}) {
  if (
    process.env.NODE_ENV === "production"
  ) {
    return null;
  }

  if (
    command !==
    "D07:E2E:EVIDENCE"
  ) {
    return null;
  }

  const persistence =
    createStatePersistence(
      repositories
    );

  const timestamp =
    new Date().toISOString();

  const acceptedEvidence =
    createEvidenceRecord({
      timestamp,

      episodeId:
        null,

      evidenceType:
        EVIDENCE_TYPE.OUTCOME,

      evidenceTarget:
        "D07_E2E_OUTCOME",

      fact:
        "Participant executed the D07 E2E test action",

      outcome:
        "Participant reported a positive outcome",

      outcomeStatus:
        OUTCOME_STATUS.POSITIVE,

      context:
        "D07_E2E_CONTEXT",

      admissionStatus:
        EVIDENCE_ADMISSION_STATUS.ACCEPTED,

      admissionReason:
        "Known reported outcome with explicit fact, attribution and context",

      strength:
        EVIDENCE_STRENGTH.E1,

      relevance:
        true,

      reliability:
        true,

      attribution:
        true,

      contextKnown:
        true,

      repeated:
        false,

      generalized:
        false,

      resilient:
        false,

      independent:
        false,

      sourceKind:
        "PARTICIPANT_REPORT",

      confidence:
        0.9,

      provenance: {
        source:
          "D07_E2E_AUTHENTICATED_PARTICIPANT",
        test:
          "EVIDENCE_ACCEPTANCE",
      },
    });

  const persisted =
    await persistence
      .saveEvidenceRecord(
        acceptedEvidence
      );

  if (!persisted?.id) {
    throw new Error(
      "D07 E2E accepted Evidence persistence failed"
    );
  }

  let unknownRejected =
    false;

  try {
    createEvidenceRecord({
      timestamp,

      evidenceType:
        EVIDENCE_TYPE.OUTCOME,

      evidenceTarget:
        "D07_E2E_UNKNOWN_OUTCOME",

      fact:
        "Participant executed an action",

      outcome:
        "Outcome has not been established",

      outcomeStatus:
        OUTCOME_STATUS.UNKNOWN,

      context:
        "D07_E2E_CONTEXT",

      admissionStatus:
        EVIDENCE_ADMISSION_STATUS.ACCEPTED,

      admissionReason:
        "UNKNOWN outcome must not become accepted Evidence",

      strength:
        EVIDENCE_STRENGTH.E1,

      relevance:
        true,

      reliability:
        true,

      attribution:
        true,

      contextKnown:
        true,

      repeated:
        false,

      generalized:
        false,

      resilient:
        false,

      independent:
        false,

      sourceKind:
        "PARTICIPANT_REPORT",

      confidence:
        0.8,

      provenance: {
        source:
          "D07_E2E_UNKNOWN_TEST",
      },
    });
  } catch {
    unknownRejected =
      true;
  }

  if (!unknownRejected) {
    throw new Error(
      "D07 E2E UNKNOWN outcome was incorrectly admitted as Evidence"
    );
  }

  let identityInflationRejected =
    false;

  try {
    createEvidenceRecord({
      timestamp,

      evidenceType:
        EVIDENCE_TYPE.IDENTITY,

      evidenceTarget:
        "D07_E2E_IDENTITY",

      fact:
        "Participant completed one successful action",

      outcome:
        "Participant reported success",

      outcomeStatus:
        OUTCOME_STATUS.POSITIVE,

      context:
        "D07_E2E_CONTEXT",

      admissionStatus:
        EVIDENCE_ADMISSION_STATUS.ACCEPTED,

      admissionReason:
        "One event must not establish Identity Evidence",

      strength:
        EVIDENCE_STRENGTH.E1,

      relevance:
        true,

      reliability:
        true,

      attribution:
        true,

      contextKnown:
        true,

      repeated:
        false,

      generalized:
        false,

      resilient:
        false,

      independent:
        false,

      sourceKind:
        "PARTICIPANT_REPORT",

      confidence:
        0.9,

      provenance: {
        source:
          "D07_E2E_IDENTITY_TEST",
      },
    });
  } catch {
    identityInflationRejected =
      true;
  }

  if (!identityInflationRejected) {
    throw new Error(
      "D07 E2E single-event Identity inflation was not rejected"
    );
  }

  return {
    ok: true,

    reply:
      `D07 EVIDENCE PASS | accepted_id=${persisted.id} | unknown_rejected=true | identity_inflation_rejected=true`,

    e2e:
      "EVIDENCE",

    evidenceId:
      persisted.id,

    unknownRejected:
      true,

    identityInflationRejected:
      true,
  };
}

export async function GET() {
  const runtimePackage =
    loadRuntimePackage();

  return Response.json({
    ok: true,
    system:
      "RTM",
    status:
      "API route is working",
    packageId:
      runtimePackage.manifest.packageId,
  });
}

export async function POST(request) {
  try {
    const body =
      await request.json();

    const messages =
      Array.isArray(body?.messages)
        ? body.messages
        : [];

    if (messages.length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            "No messages supplied",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      requireBearerToken(request);

    const authenticatedContext =
      await createAuthenticatedSupabaseContext(
        accessToken
      );

    const repositories =
      createRuntimeRepositories(
        authenticatedContext
      );

    const command =
      getLastUserMessage(
        messages
      );

    const memoryE2EResult =
      await runMemoryE2E({
        command,
        repositories,
      });

    if (memoryE2EResult) {
      return Response.json(
        memoryE2EResult
      );
    }

    const evidenceE2EResult =
      await runEvidenceE2E({
        command,
        repositories,
      });

    if (evidenceE2EResult) {
      return Response.json(
        evidenceE2EResult
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error:
            "OPENAI_API_KEY is missing",
        },
        {
          status: 500,
        }
      );
    }

    const runtimePackage =
      loadRuntimePackage();

    const input = [
      {
        role:
          "developer",
        content:
          runtimePackage.systemPrompt,
      },

      ...messages.map(
        (message) => ({
          role:
            message.role ===
            "assistant"
              ? "assistant"
              : "user",

          content:
            String(
              message.content ?? ""
            ),
        })
      ),
    ];

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body:
            JSON.stringify({
              model:
                "gpt-5.4",
              input,
              store:
                false,
            }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI error:",
        data
      );

      return Response.json(
        {
          ok: false,
          error:
            "OpenAI request failed",
          details:
            data,
        },
        {
          status:
            response.status,
        }
      );
    }

    let reply =
      "";

    if (
      typeof data.output_text ===
      "string"
    ) {
      reply =
        data.output_text;
    }

    if (
      !reply &&
      Array.isArray(
        data.output
      )
    ) {
      for (
        const item of
        data.output
      ) {
        if (
          !Array.isArray(
            item.content
          )
        ) {
          continue;
        }

        for (
          const content of
          item.content
        ) {
          if (
            content.type ===
              "output_text" &&
            typeof content.text ===
              "string"
          ) {
            reply +=
              content.text;
          }
        }
      }
    }

    if (!reply) {
      reply =
        "לא התקבלה תשובה מהמנוע.";
    }

    const episodeRows =
      await repositories.insertOwned(
        "episodes",
        {
          episode_type:
            normalizeProcessType(
              body?.processType
            ),
        }
      );

    const episode =
      Array.isArray(
        episodeRows
      ) &&
      episodeRows.length > 0
        ? episodeRows[0]
        : null;

    if (!episode?.id) {
      throw new Error(
        "Episode persistence failed"
      );
    }

    return Response.json({
      ok: true,
      reply,

      packageId:
        runtimePackage.manifest.packageId,

      episodeId:
        episode.id,
    });
  } catch (error) {
    console.error(
      "RTM route error:",
      error
    );

    if (
      isRuntimeAuthorityError(
        error
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Runtime authority package rejected",
          code:
            error.code,
        },
        {
          status: 500,
        }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const authFailure =
      message.includes(
        "authenticated participant"
      ) ||
      message.includes(
        "authenticated Supabase user"
      );

    return Response.json(
      {
        ok: false,

        error:
          authFailure
            ? "Authenticated participant is required"
            : "RTM server error",

        details:
          message,
      },
      {
        status:
          authFailure
            ? 401
            : 500,
      }
    );
  }
}