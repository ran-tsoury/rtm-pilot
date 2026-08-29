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
      EVIDENCE_TYPE.ACTION,

    admissionStatus:
      EVIDENCE_ADMISSION_STATUS
        .ACCEPTED,

    admissionReason:
      "Observed behavior is relevant, attributable and context-qualified",

    strength:
      EVIDENCE_STRENGTH.E1,

    event:
      "Participant performed the observed action",

    behavior:
      "Observed action",

    outcome:
      null,

    outcomeStatus:
      null,

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
      "OBSERVED_BEHAVIOR",

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
  "accepted Evidence persists through owner-scoped repository boundary",
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
  "UNKNOWN outcome cannot create accepted Evidence",
  () => {
    assert.throws(
      () =>
        createEvidenceRecord(
          validAcceptedEvidence({
            outcome:
              null,

            outcomeStatus:
              "UNKNOWN",
          })
        ),
      /UNKNOWN outcome cannot create accepted Evidence/
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
              EVIDENCE_TYPE
                .IDENTITY,

            strength:
              EVIDENCE_STRENGTH
                .E1,
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
          EVIDENCE_TYPE
            .ACTION,

        admissionStatus:
          EVIDENCE_ADMISSION_STATUS
            .CANDIDATE,

        strength:
          EVIDENCE_STRENGTH
            .E0,

        event:
          "Potential action evidence",

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