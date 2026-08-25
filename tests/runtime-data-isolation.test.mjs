import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthenticatedSupabaseContext,
} from "../runtime/data/supabase/client.mjs";

import {
  createRuntimeRepositories,
  PARTICIPANT_OWNED_TABLES,
} from "../runtime/data/supabase/repositories.mjs";

import {
  createParticipantDataAccess,
} from "../runtime/data/supabase/participant-data.mjs";

const previousUrl = process.env.SUPABASE_URL;
const previousAnonKey = process.env.SUPABASE_ANON_KEY;

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

process.on("exit", () => {
  if (previousUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = previousUrl;
  }

  if (previousAnonKey === undefined) {
    delete process.env.SUPABASE_ANON_KEY;
  } else {
    process.env.SUPABASE_ANON_KEY = previousAnonKey;
  }
});

function createQueryRecorder({
  data = [],
  error = null,
} = {}) {
  const calls = [];

  const query = {
    calls,

    select(value) {
      calls.push(["select", value]);
      return query;
    },

    insert(value) {
      calls.push(["insert", value]);
      return query;
    },

    update(value) {
      calls.push(["update", value]);
      return query;
    },

    delete() {
      calls.push(["delete"]);
      return query;
    },

    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },

    order(column, options) {
      calls.push(["order", column, options]);
      return query;
    },

    limit(value) {
      calls.push(["limit", value]);
      return query;
    },

    then(resolve, reject) {
      return Promise.resolve({
        data,
        error,
      }).then(resolve, reject);
    },
  };

  return query;
}

function createFakeClient({
  userId = "user-a",
  authError = null,
  queryError = null,
} = {}) {
  const tables = [];
  const queries = [];

  const client = {
    auth: {
      async getUser(token) {
        if (authError) {
          return {
            data: {
              user: null,
            },
            error: authError,
          };
        }

        return {
          data: {
            user: {
              id: userId,
            },
          },
          error: null,
        };
      },
    },

    from(table) {
      tables.push(table);

      const query = createQueryRecorder({
        error: queryError,
      });

      queries.push(query);

      return query;
    },
  };

  return {
    client,
    tables,
    queries,
  };
}

async function createVerifiedTestContext(options = {}) {
  const fake = createFakeClient(options);

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-test-token",
      {
        createClientImpl() {
          return fake.client;
        },
      }
    );

  return {
    context,
    ...fake,
  };
}

test("anonymous access token is rejected", async () => {
  await assert.rejects(
    () => createAuthenticatedSupabaseContext(""),
    /access token/i
  );
});

test("authentication failure is fail closed", async () => {
  const fake = createFakeClient({
    authError: new Error("invalid jwt"),
  });

  await assert.rejects(
    () =>
      createAuthenticatedSupabaseContext(
        "bad-token",
        {
          createClientImpl() {
            return fake.client;
          },
        }
      ),
    /verify authenticated/i
  );
});

test("authenticated owner is derived from verified user id", async () => {
  const {
    context,
  } = await createVerifiedTestContext({
    userId: "verified-user-123",
  });

  assert.equal(
    context.ownerId,
    "verified-user-123"
  );

  assert.equal(
    context.user.id,
    "verified-user-123"
  );
});

test("repository rejects an arbitrary unverified context", () => {
  const fakeSupabase = {
    from() {
      return {};
    },
  };

  assert.throws(
    () =>
      createRuntimeRepositories({
        supabase: fakeSupabase,
        ownerId: "attacker",
      }),
    /verified authenticated Supabase context/i
  );
});

test("repository owner is bound to authenticated user", async () => {
  const {
    context,
  } = await createVerifiedTestContext({
    userId: "user-a",
  });

  const repositories =
    createRuntimeRepositories(context);

  assert.equal(
    repositories.ownerId,
    "user-a"
  );
});

test("repository blocks tables outside participant allowlist", async () => {
  const {
    context,
  } = await createVerifiedTestContext();

  const repositories =
    createRuntimeRepositories(context);

  await assert.rejects(
    () =>
      repositories.selectOwned(
        "admin_secrets"
      ),
    /not approved/i
  );
});

test("participant-owned table allowlist is explicit", () => {
  assert.deepEqual(
    [...PARTICIPANT_OWNED_TABLES],
    [
      "profiles",
      "journey_state",
      "daily_presence",
      "episodes",
      "evidence",
      "interventions",
      "memory_items",
      "weight_entries",
      "app_events",
    ]
  );
});

test("read query is scoped to authenticated user_id", async () => {
  const {
    context,
    tables,
    queries,
  } = await createVerifiedTestContext({
    userId: "user-a",
  });

  const repositories =
    createRuntimeRepositories(context);

  await repositories.selectOwned(
    "episodes",
    {
      orderBy: "created_at",
      ascending: false,
    }
  );

  assert.deepEqual(tables, [
    "episodes",
  ]);

  assert.deepEqual(
    queries[0].calls,
    [
      ["select", "*"],
      ["eq", "user_id", "user-a"],
      [
        "order",
        "created_at",
        {
          ascending: false,
        },
      ],
    ]
  );
});

test("insert overwrites caller supplied user_id", async () => {
  const {
    context,
    queries,
  } = await createVerifiedTestContext({
    userId: "user-a",
  });

  const repositories =
    createRuntimeRepositories(context);

  await repositories.insertOwned(
    "episodes",
    {
      user_id: "user-b",
      title: "test",
    }
  );

  assert.deepEqual(
    queries[0].calls,
    [
      [
        "insert",
        {
          user_id: "user-a",
          title: "test",
        },
      ],
      ["select", undefined],
    ]
  );
});

test("update removes ownership fields and scopes record to owner", async () => {
  const {
    context,
    queries,
  } = await createVerifiedTestContext({
    userId: "user-a",
  });

  const repositories =
    createRuntimeRepositories(context);

  await repositories.updateOwned(
    "journey_state",
    "record-1",
    {
      user_id: "user-b",
      owner_id: "user-b",
      status: "active",
    }
  );

  assert.deepEqual(
    queries[0].calls,
    [
      [
        "update",
        {
          status: "active",
        },
      ],
      ["eq", "id", "record-1"],
      ["eq", "user_id", "user-a"],
      ["select", undefined],
    ]
  );
});

test("delete scopes record to authenticated owner", async () => {
  const {
    context,
    queries,
  } = await createVerifiedTestContext({
    userId: "user-a",
  });

  const repositories =
    createRuntimeRepositories(context);

  await repositories.deleteOwned(
    "episodes",
    "record-9"
  );

  assert.deepEqual(
    queries[0].calls,
    [
      ["delete"],
      ["eq", "id", "record-9"],
      ["eq", "user_id", "user-a"],
      ["select", undefined],
    ]
  );
});

test("repository query errors fail closed", async () => {
  const {
    context,
  } = await createVerifiedTestContext({
    queryError: new Error(
      "RLS denied request"
    ),
  });

  const repositories =
    createRuntimeRepositories(context);

  await assert.rejects(
    () =>
      repositories.selectOwned(
        "episodes"
      ),
    /RLS denied request/
  );
});

test("participant facade rejects mismatched requested participant", async () => {
  const fake = createFakeClient({
    userId: "user-a",
  });

  await assert.rejects(
    () =>
      createParticipantDataAccess(
        "valid-test-token",
        "user-b",
        {
          createClientImpl() {
            return fake.client;
          },
        }
      ),
    /does not match/i
  );
});

test("participant facade derives participant id from authenticated user", async () => {
  const fake = createFakeClient({
    userId: "user-a",
  });

  const participant =
    await createParticipantDataAccess(
      "valid-test-token",
      "user-a",
      {
        createClientImpl() {
          return fake.client;
        },
      }
    );

  assert.equal(
    participant.participantId,
    "user-a"
  );
});

test("participant facade delegates reads through owner-scoped repository", async () => {
  const fake = createFakeClient({
    userId: "user-a",
  });

  const participant =
    await createParticipantDataAccess(
      "valid-test-token",
      "user-a",
      {
        createClientImpl() {
          return fake.client;
        },
      }
    );

  await participant.getEpisodes();

  assert.deepEqual(
    fake.tables,
    ["episodes"]
  );

  assert.deepEqual(
    fake.queries[0].calls,
    [
      ["select", "*"],
      ["eq", "user_id", "user-a"],
      [
        "order",
        "created_at",
        {
          ascending: false,
        },
      ],
    ]
  );
});