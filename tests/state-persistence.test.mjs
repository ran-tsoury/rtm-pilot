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
  MEMORY_STATUS,
} from "../runtime/data/memory/memory-store.mjs";

import {
  EXPERIENCE_STATUS,
  OUTCOME_STATUS,
} from "../runtime/data/experience/experience-lifecycle.mjs";

const previousUrl = process.env.SUPABASE_URL;
const previousAnonKey = process.env.SUPABASE_ANON_KEY;
const originalFetch = globalThis.fetch;

process.env.SUPABASE_URL =
  "https://example.supabase.co";

process.env.SUPABASE_ANON_KEY =
  "test-anon-key";

process.on("exit", () => {
  globalThis.fetch = originalFetch;

  if (previousUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = previousUrl;
  }

  if (previousAnonKey === undefined) {
    delete process.env.SUPABASE_ANON_KEY;
  } else {
    process.env.SUPABASE_ANON_KEY =
      previousAnonKey;
  }
});

function jsonResponse(body, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type": "application/json",
      },
    }
  );
}

function parseBody(body) {
  if (
    body === null ||
    body === undefined ||
    body === ""
  ) {
    return null;
  }

  if (typeof body === "string") {
    return JSON.parse(body);
  }

  return body;
}

function tableFromUrl(url) {
  const parsed = new URL(url);
  const marker = "/rest/v1/";
  const index =
    parsed.pathname.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    parsed.pathname.slice(
      index + marker.length
    )
  );
}

function idFromUrl(url) {
  const parsed = new URL(url);
  const raw =
    parsed.searchParams.get("id");

  if (
    typeof raw !== "string" ||
    !raw.startsWith("eq.")
  ) {
    return null;
  }

  return raw.slice(3);
}

function installFetchMock({
  userId = "user-a",
  selectedRows = {},
} = {}) {
  const calls = [];

  const database = {};

  for (
    const [table, rows]
    of Object.entries(selectedRows)
  ) {
    database[table] =
      rows.map((row) => ({
        ...row,
      }));
  }

  globalThis.fetch =
    async (input, init = {}) => {
      const url =
        typeof input === "string"
          ? input
          : input.url;

      const method =
        init.method ??
        (
          typeof input === "object"
            ? input.method
            : undefined
        ) ??
        "GET";

      const body =
        init.body ??
        (
          typeof input === "object"
            ? input.body
            : undefined
        );

      calls.push({
        url,
        method,
        body,
      });

      if (
        url.includes("/auth/v1/user")
      ) {
        return jsonResponse({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email:
            `${userId}@example.com`,
        });
      }

      if (
        !url.includes("/rest/v1/")
      ) {
        throw new Error(
          `Unexpected fetch URL: ${url}`
        );
      }

      const table =
        tableFromUrl(url);

      if (!database[table]) {
        database[table] = [];
      }

      if (method === "GET") {
        return jsonResponse(
          database[table]
        );
      }

      if (method === "POST") {
        const payload =
          parseBody(body);

        const row = {
          id:
            payload.id ??
            "inserted-id",
          ...payload,
        };

        database[table].push(row);

        return jsonResponse([
          row,
        ]);
      }

      if (method === "PATCH") {
        const payload =
          parseBody(body);

        const id =
          idFromUrl(url);

        const index =
          database[table]
            .findIndex(
              (row) =>
                row.id === id
            );

        const existing =
          index >= 0
            ? database[table][index]
            : {
                id:
                  id ??
                  "updated-id",
                user_id:
                  userId,
              };

        const updated = {
          ...existing,
          ...payload,
        };

        if (index >= 0) {
          database[table][index] =
            updated;
        } else {
          database[table].push(
            updated
          );
        }

        return jsonResponse([
          updated,
        ]);
      }

      throw new Error(
        `Unexpected REST method: ${method}`
      );
    };

  return {
    calls,
    database,
  };
}

async function createVerifiedHarness({
  ownerId = "user-a",
  selectedRows = {},
} = {}) {
  const {
    calls,
    database,
  } = installFetchMock({
    userId: ownerId,
    selectedRows,
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
    persistence,
    repositories,
    calls,
    database,
  };
}

function findRestCalls(
  calls,
  table,
  method
) {
  return calls.filter(
    (call) =>
      call.url.includes(
        `/rest/v1/${table}`
      ) &&
      call.method === method
  );
}

test(
  "state persistence rejects unverified repository shape",
  () => {
    assert.throws(
      () =>
        createStatePersistence({
          ownerId: "user-a",

          async selectOwned() {
            return [];
          },

          async insertOwned() {
            return [];
          },

          async updateOwned() {
            return [];
          },
        }),
      /Verified runtime repositories are required/
    );
  }
);

test(
  "state persistence exposes authenticated repository owner only",
  async () => {
    const {
      persistence,
    } =
      await createVerifiedHarness({
        ownerId:
          "verified-user",
      });

    assert.equal(
      persistence.ownerId,
      "verified-user"
    );
  }
);

test(
  "journey state is inserted when participant has no stored journey state",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness();

    const result =
      await persistence
        .saveJourneyState({
          currentStage: 1,
          currentState:
            "ACTIVE",
          currentLoad:
            "LOW",
          supportLevel:
            "STANDARD",
          context:
            "HOME",
        });

    const inserts =
      findRestCalls(
        calls,
        "journey_state",
        "POST"
      );

    assert.equal(
      inserts.length,
      1
    );

    const payload =
      parseBody(
        inserts[0].body
      );

    assert.equal(
      payload.current_stage,
      1
    );

    assert.equal(
      payload.current_state,
      "ACTIVE"
    );

    assert.equal(
      payload.current_load,
      "LOW"
    );

    assert.equal(
      payload.support_mode,
      "STANDARD"
    );

    assert.equal(
      payload.current_context,
      "HOME"
    );

    assert.equal(
      payload.context_confidence,
      null
    );

    assert.deepEqual(
      payload.open_context_exceptions,
      []
    );

    assert.equal(
      payload.last_reality_gate_at,
      null
    );

    assert.equal(
      payload.last_meaningful_return_at,
      null
    );

    assert.equal(
      payload.user_id,
      "user-a"
    );

    assert.equal(
      result.user_id,
      "user-a"
    );
  }
);

test(
  "journey state updates adaptive fields on existing owner-scoped row without changing stage",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness({
        selectedRows: {
          journey_state: [
            {
              id:
                "journey-1",
              user_id:
                "user-a",
              current_stage:
                1,
              current_state:
                "ACTIVE",
            },
          ],
        },
      });

    await persistence
      .saveJourneyState({
        currentStage: 1,
        currentState:
          "RETURNING",
        currentLoad:
          "MEDIUM",
        supportLevel:
          "HIGH",
        context:
          "WORK",
      });

    const inserts =
      findRestCalls(
        calls,
        "journey_state",
        "POST"
      );

    const updates =
      findRestCalls(
        calls,
        "journey_state",
        "PATCH"
      );

    assert.equal(
      inserts.length,
      0
    );

    assert.equal(
      updates.length,
      1
    );

    assert.match(
      updates[0].url,
      /id=eq\.journey-1/
    );

    assert.match(
      updates[0].url,
      /user_id=eq\.user-a/
    );

    const payload =
      parseBody(
        updates[0].body
      );

    assert.equal(
      payload.current_state,
      "RETURNING"
    );

    assert.equal(
      payload.current_load,
      "MEDIUM"
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "current_stage"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "user_id"
      ),
      false
    );
  }
);

test(
  "memory persistence maps canonical memory record without accepting caller ownership",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness({
        ownerId:
          "verified-user",
      });

    await persistence
      .saveMemoryRecord(
        {
          source:
            "observed-action",

          status:
            MEMORY_STATUS.KNOWN,

          confidence:
            0.8,

          value:
            "Participant completed the observed action",

          context:
            "HOME",

          supersedesId:
            null,
        },
        {
          memoryLevel:
            "WORKING",

          memoryType:
            "FACT",

          sourceEpisodeId:
            "episode-1",
        }
      );

    const inserts =
      findRestCalls(
        calls,
        "memory_items",
        "POST"
      );

    assert.equal(
      inserts.length,
      1
    );

    const payload =
      parseBody(
        inserts[0].body
      );

    assert.equal(
      payload.status,
      MEMORY_STATUS.KNOWN
    );

    assert.equal(
      payload.confidence,
      "0.8"
    );

    assert.equal(
      payload.memory_level,
      "WORKING"
    );

    assert.equal(
      payload.memory_type,
      "FACT"
    );

    assert.equal(
      payload.source_episode_id,
      "episode-1"
    );

    assert.equal(
      payload.supersedes_memory_id,
      null
    );

    assert.equal(
      payload.user_id,
      "verified-user"
    );
  }
);

test(
  "memory supersession fails closed when atomic repository boundary is unavailable",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness();

    await assert.rejects(
      () =>
        persistence
          .supersedeMemory(),
      /Atomic memory supersession is not available through the current repository boundary/
    );

    const updates =
      findRestCalls(
        calls,
        "memory_items",
        "PATCH"
      );

    assert.equal(
      updates.length,
      0
    );
  }
);

test(
  "suggested experience rejects caller-selected user that differs from authenticated owner",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness({
        ownerId:
          "verified-user",
      });

    await assert.rejects(
      persistence
        .saveSuggestedExperience(
          {
            userId:
              "attacker-selected-user",

            status:
              EXPERIENCE_STATUS
                .SUGGESTED,

            context:
              null,

            suggestedAt:
              "2026-08-28T00:00:00.000Z",
          },
          {
            suggestedAction:
              "Take one small action",
          }
        ),
      /Caller-selected ownership does not match authenticated owner/
    );

    const inserts =
      findRestCalls(
        calls,
        "interventions",
        "POST"
      );

    assert.equal(
      inserts.length,
      0
    );
  }
);

test(
  "suggested experience persists as UNKNOWN outcome without inferring execution",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness();

    await persistence
      .saveSuggestedExperience(
        {
          userId:
            "user-a",

          status:
            EXPERIENCE_STATUS
              .SUGGESTED,

          context:
            "HOME",

          suggestedAt:
            "2026-08-28T00:00:00.000Z",
        },
        {
          episodeId:
            "episode-1",

          route:
            "JOURNEY",

          toolFamily:
            "MICRO_ACTION",

          suggestedAction:
            "Drink a glass of water",
        }
      );

    const inserts =
      findRestCalls(
        calls,
        "interventions",
        "POST"
      );

    assert.equal(
      inserts.length,
      1
    );

    const payload =
      parseBody(
        inserts[0].body
      );

    assert.equal(
      payload.user_id,
      "user-a"
    );

    assert.equal(
      payload.outcome_status,
      OUTCOME_STATUS.UNKNOWN
    );

    assert.equal(
      payload.selected_action,
      null
    );

    assert.equal(
      payload.executed_action,
      null
    );

    assert.equal(
      payload.outcome,
      null
    );

    assert.equal(
      payload.executed_at,
      null
    );

    assert.equal(
      payload.outcome_at,
      null
    );
  }
);

test(
  "experience lifecycle persistence keeps selected executed outcome and confidence as separate legal transitions",
  async () => {
    const {
      persistence,
      calls,
    } =
      await createVerifiedHarness({
        selectedRows: {
          interventions: [
            {
              id:
                "intervention-1",

              user_id:
                "user-a",

              suggested_action:
                "Walk for five minutes",

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

              suggested_at:
                "2026-08-28T00:50:00.000Z",

              executed_at:
                null,

              outcome_at:
                null,
            },
          ],
        },
      });

    await persistence
      .persistExperienceTransition(
        "intervention-1",
        {
          userId:
            "user-a",

          status:
            EXPERIENCE_STATUS
              .SELECTED,
        },
        {
          selectedAction:
            "Walk for five minutes",
        }
      );

    await persistence
      .persistExperienceTransition(
        "intervention-1",
        {
          userId:
            "user-a",

          status:
            EXPERIENCE_STATUS
              .EXECUTED,

          executedAt:
            "2026-08-28T01:00:00.000Z",
        },
        {
          executedAction:
            "Walked for five minutes",
        }
      );

    await persistence
      .persistExperienceTransition(
        "intervention-1",
        {
          userId:
            "user-a",

          status:
            EXPERIENCE_STATUS
              .OUTCOME,

          outcome:
            OUTCOME_STATUS
              .POSITIVE,

          outcomeNote:
            "Felt calmer",

          outcomeAt:
            "2026-08-28T01:10:00.000Z",
        }
      );

    await persistence
      .persistExperienceTransition(
        "intervention-1",
        {
          userId:
            "user-a",

          status:
            EXPERIENCE_STATUS
              .CONFIDENCE,

          confidence:
            0.9,
        }
      );

    const updates =
      findRestCalls(
        calls,
        "interventions",
        "PATCH"
      );

    assert.equal(
      updates.length,
      4
    );

    assert.deepEqual(
      parseBody(
        updates[0].body
      ),
      {
        selected_action:
          "Walk for five minutes",
      }
    );

    assert.deepEqual(
      parseBody(
        updates[1].body
      ),
      {
        executed_action:
          "Walked for five minutes",

        executed_at:
          "2026-08-28T01:00:00.000Z",
      }
    );

    assert.deepEqual(
      parseBody(
        updates[2].body
      ),
      {
        outcome:
          "Felt calmer",

        outcome_status:
          OUTCOME_STATUS.POSITIVE,

        outcome_at:
          "2026-08-28T01:10:00.000Z",
      }
    );

    assert.deepEqual(
      parseBody(
        updates[3].body
      ),
      {
        reliability_confidence:
          "0.9",
      }
    );

    for (
      const update
      of updates
    ) {
      assert.match(
        update.url,
        /id=eq\.intervention-1/
      );

      assert.match(
        update.url,
        /user_id=eq\.user-a/
      );
    }
  }
);