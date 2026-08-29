import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthenticatedSupabaseContext,
} from "../runtime/data/supabase/client.mjs";

import {
  createRuntimeRepositories,
} from "../runtime/data/supabase/repositories.mjs";

import {
  createStatePersistence,
} from "../runtime/data/state/state-persistence.mjs";

import {
  EVIDENCE_TYPE,
  EVIDENCE_ADMISSION_STATUS,
  EVIDENCE_STRENGTH,
  createEvidenceRecord,
} from "../runtime/data/evidence/evidence-store.mjs";

import {
  OUTCOME_STATUS,
} from "../runtime/data/experience/experience-lifecycle.mjs";

const previousUrl =
  process.env.SUPABASE_URL;

const previousAnonKey =
  process.env.SUPABASE_ANON_KEY;

const originalFetch =
  globalThis.fetch;

process.env.SUPABASE_URL =
  "https://example.supabase.co";

process.env.SUPABASE_ANON_KEY =
  "test-anon-key";

process.on("exit", () => {
  globalThis.fetch =
    originalFetch;

  if (
    previousUrl === undefined
  ) {
    delete process.env
      .SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL =
      previousUrl;
  }

  if (
    previousAnonKey ===
    undefined
  ) {
    delete process.env
      .SUPABASE_ANON_KEY;
  } else {
    process.env
      .SUPABASE_ANON_KEY =
      previousAnonKey;
  }
});

function jsonResponse(
  body,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json",
      },
    }
  );
}

function parseBody(
  body
) {
  if (
    body === null ||
    body === undefined ||
    body === ""
  ) {
    return null;
  }

  if (
    typeof body === "string"
  ) {
    return JSON.parse(
      body
    );
  }

  return body;
}

function tableFromUrl(
  url
) {
  const parsed =
    new URL(url);

  const marker =
    "/rest/v1/";

  const index =
    parsed.pathname.indexOf(
      marker
    );

  if (
    index === -1
  ) {
    return null;
  }

  return decodeURIComponent(
    parsed.pathname.slice(
      index +
      marker.length
    )
  );
}

function installFetchMock({
  userId = "user-a",
} = {}) {
  const database = {
    evidence: [],
  };

  globalThis.fetch =
    async (
      input,
      init = {}
    ) => {
      const url =
        typeof input ===
        "string"
          ? input
          : input.url;

      const method =
        init.method ??
        (
          typeof input ===
          "object"
            ? input.method
            : undefined
        ) ??
        "GET";

      const body =
        init.body ??
        (
          typeof input ===
          "object"
            ? input.body
            : undefined
        );

      if (
        url.includes(
          "/auth/v1/user"
        )
      ) {
        return jsonResponse({
          id:
            userId,

          aud:
            "authenticated",

          role:
            "authenticated",

          email:
            `${userId}@example.com`,
        });
      }

      if (
        !url.includes(
          "/rest/v1/"
        )
      ) {
        throw new Error(
          `Unexpected fetch URL: ${url}`
        );
      }

      const table =
        tableFromUrl(url);

      if (
        !database[table]
      ) {
        database[table] =
          [];
      }

      if (
        method === "GET"
      ) {
        return jsonResponse(
          database[table]
        );
      }

      if (
        method === "POST"
      ) {
        const payload =
          parseBody(body);

        const row = {
          id:
            payload.id ??
            `row-${
              database[table]
                .length + 1
            }`,

          ...payload,
        };

        database[table].push(
          row
        );

        return jsonResponse([
          row,
        ]);
      }

      throw new Error(
        `Unexpected REST method: ${method}`
      );
    };

  return database;
}

async function createHarness({
  ownerId = "user-a",
} = {}) {
  const database =
    installFetchMock({
      userId:
        ownerId,
    });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(
      context
    );

  const persistence =
    createStatePersistence(
      repositories
    );

  return {
    database,
    persistence,
  };
}

function validAcceptedEvidence(
  overrides = {}
) {
  return {
    evidenceType:
      EVIDENCE_TYPE.OUTCOME,

    admissionStatus:
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED,

    admissionReason:
      "Observed fact and reported outcome are relevant, reliable, attributable and context-qualified",

    strength:
      EVIDENCE_STRENGTH.E1,

    fact:
      "Participant executed the observed action",

    event:
      "Observed execution",

    behavior:
      "Completed action",

    outcome:
      "Participant reported that the action helped",

    outcomeStatus:
      OUTCOME_STATUS.POSITIVE,

    context:
      "HOME",

    contextKnown:
      true,

    relevance:
      true,

    reliability:
      true,

    attribution:
      true,

    repeated:
      false,

    generalized:
      false,

    resilient:
      false,

    independent:
      false,

    confidence:
      0.8,

    sourceKind:
      "OBSERVED_OUTCOME",

    episodeId:
      "episode-1",

    evidenceTarget:
      "CAPABILITY_A",

    provenance: {
      source:
        "runtime-observation",
    },

    timestamp:
      "2026-08-29T10:00:00.000Z",

    ...overrides,
  };
}

test(
  "accepted Evidence persists only with explicit fact and reported non-UNKNOWN outcome",
  async () => {
    const {
      database,
      persistence,
    } =
      await createHarness({
        ownerId:
          "verified-user",
      });

    const evidence =
      createEvidenceRecord(
        validAcceptedEvidence()
      );

    const saved =
      await persistence
        .saveEvidenceRecord(
          evidence,
          {
            admittedAt:
              "2026-08-29T10:01:00.000Z",
          }
        );

    assert.equal(
      saved.user_id,
      "verified-user"
    );

    assert.equal(
      database.evidence
        .length,
      1
    );

    assert.equal(
      saved.fact,
      "Participant executed the observed action"
    );

    assert.equal(
      saved.outcome,
      "Participant reported that the action helped"
    );

    assert.equal(
      saved.outcome_status,
      OUTCOME_STATUS.POSITIVE
    );

    assert.equal(
      saved.admitted,
      true
    );

    assert.equal(
      saved.admission_status,
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED
    );

    assert.equal(
      saved.strength,
      EVIDENCE_STRENGTH.E1
    );

    assert.equal(
      saved.confidence,
      0.8
    );

    assert.equal(
      saved.content
        .provenance
        .source,
      "runtime-observation"
    );
  }
);

test(
  "accepted Evidence rejects UNKNOWN outcome",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            outcome:
              null,

            outcomeStatus:
              OUTCOME_STATUS.UNKNOWN,
          })
        ),
      /Accepted Evidence requires a reported outcome/
    );
  }
);

test(
  "accepted Evidence rejects missing outcome even when fact exists",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            outcome:
              null,

            outcomeStatus:
              null,
          })
        ),
      /Accepted Evidence requires a reported outcome/
    );
  }
);

test(
  "accepted Evidence rejects missing explicit fact",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            fact:
              null,
          })
        ),
      /Accepted Evidence requires an explicit fact/
    );
  }
);

test(
  "single event cannot be inflated into Identity Evidence",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            evidenceType:
              EVIDENCE_TYPE.IDENTITY,

            strength:
              EVIDENCE_STRENGTH.E1,
          })
        ),
      /single Evidence event cannot establish Identity Evidence/
    );
  }
);

test(
  "candidate Evidence cannot be persisted as durable Evidence",
  async () => {
    const {
      database,
      persistence,
    } =
      await createHarness();

    const candidate =
      createEvidenceRecord({
        evidenceType:
          EVIDENCE_TYPE.ACTION,

        admissionStatus:
          EVIDENCE_ADMISSION_STATUS
            .CANDIDATE,

        strength:
          EVIDENCE_STRENGTH.E0,

        fact:
          null,

        event:
          "Potential action evidence",

        behavior:
          "Potential action",

        outcome:
          null,

        outcomeStatus:
          OUTCOME_STATUS.UNKNOWN,

        context:
          "HOME",

        contextKnown:
          true,

        relevance:
          null,

        reliability:
          null,

        attribution:
          null,

        repeated:
          false,

        generalized:
          false,

        resilient:
          false,

        independent:
          false,

        confidence:
          null,

        sourceKind:
          "OBSERVED_BEHAVIOR",

        timestamp:
          "2026-08-29T10:00:00.000Z",
      });

    await assert.rejects(
      () =>
        persistence
          .saveEvidenceRecord(
            candidate
          ),
      /Only admitted Evidence may be persisted/
    );

    assert.equal(
      database.evidence
        .length,
      0
    );
  }
);

test(
  "automatic app use cannot become accepted Evidence",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            sourceKind:
              "APP_USE",
          })
        ),
      /APP_USE cannot become automatic Evidence/
    );
  }
);