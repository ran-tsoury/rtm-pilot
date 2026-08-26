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
const originalFetch = globalThis.fetch;

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

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
    process.env.SUPABASE_ANON_KEY = previousAnonKey;
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

function installFetchMock({
  userId = "user-a",
  authStatus = 200,
  queryStatus = 200,
} = {}) {
  const calls = [];

  globalThis.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string"
        ? input
        : input.url;

    const method =
      init.method ??
      (typeof input === "object" && input.method) ??
      "GET";

    const body =
      init.body ??
      (typeof input === "object" ? input.body : undefined);

    calls.push({
      url,
      method,
      body,
    });

    if (url.includes("/auth/v1/user")) {
      if (authStatus !== 200) {
        return jsonResponse(
          {
            message: "invalid jwt",
          },
          authStatus
        );
      }

      return jsonResponse({
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: `${userId}@example.com`,
      });
    }

    if (url.includes("/rest/v1/")) {
      if (queryStatus >= 400) {
        return jsonResponse(
          {
            message: "RLS denied request",
          },
          queryStatus
        );
      }

      return jsonResponse([]);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  return calls;
}

test("anonymous access token is rejected", async () => {
  await assert.rejects(
    () => createAuthenticatedSupabaseContext(""),
    /access token/i
  );
});

test("authentication failure is fail closed", async () => {
  installFetchMock({
    authStatus: 401,
  });

  await assert.rejects(
    () =>
      createAuthenticatedSupabaseContext(
        "bad-token"
      ),
    /verify authenticated/i
  );
});

test("authenticated owner is derived from Supabase verified user id", async () => {
  installFetchMock({
    userId: "verified-user-123",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  assert.equal(
    context.ownerId,
    "verified-user-123"
  );

  assert.equal(
    context.user.id,
    "verified-user-123"
  );
});

test("production authenticated factory exposes no client injection parameter", async () => {
  installFetchMock({
    userId: "real-user",
  });

  const fabricatedClient = {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: "attacker",
            },
          },
          error: null,
        };
      },
    },
  };

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token",
      {
        createClientImpl() {
          return fabricatedClient;
        },
      }
    );

  assert.equal(
    context.ownerId,
    "real-user"
  );

  assert.notEqual(
    context.ownerId,
    "attacker"
  );
});

test("repository rejects arbitrary caller-created context", () => {
  assert.throws(
    () =>
      createRuntimeRepositories({
        supabase: {
          from() {},
        },
        ownerId: "attacker",
        user: {
          id: "attacker",
        },
      }),
    /verified authenticated Supabase context/i
  );
});

test("repository owner is bound to verified authenticated context", async () => {
  installFetchMock({
    userId: "user-a",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(context);

  assert.equal(
    repositories.ownerId,
    "user-a"
  );
});

test("participant table allowlist is explicit", () => {
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

test("repository blocks arbitrary tables", async () => {
  installFetchMock();

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

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

test("read is scoped to authenticated user_id", async () => {
  const calls = installFetchMock({
    userId: "user-a",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(context);

  await repositories.selectOwned(
    "episodes",
    {
      orderBy: "created_at",
      ascending: false,
    }
  );

  const request = calls.find(
    (call) =>
      call.url.includes(
        "/rest/v1/episodes"
      )
  );

  assert.ok(request);
  assert.match(
    request.url,
    /user_id=eq\.user-a/
  );
  assert.match(
    request.url,
    /order=created_at\.desc/
  );
});

test("insert overwrites caller supplied user_id", async () => {
  const calls = installFetchMock({
    userId: "user-a",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(context);

  await repositories.insertOwned(
    "episodes",
    {
      user_id: "user-b",
      title: "test",
    }
  );

  const request = calls.find(
    (call) =>
      call.url.includes(
        "/rest/v1/episodes"
      ) &&
      call.method === "POST"
  );

  assert.ok(request);

  const payload = JSON.parse(
    request.body
  );

  assert.equal(
    payload.user_id,
    "user-a"
  );

  assert.equal(
    payload.title,
    "test"
  );
});

test("update strips ownership fields and scopes by id and authenticated user_id", async () => {
  const calls = installFetchMock({
    userId: "user-a",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

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

  const request = calls.find(
    (call) =>
      call.url.includes(
        "/rest/v1/journey_state"
      ) &&
      call.method === "PATCH"
  );

  assert.ok(request);

  const payload = JSON.parse(
    request.body
  );

  assert.deepEqual(
    payload,
    {
      status: "active",
    }
  );

  assert.match(
    request.url,
    /id=eq\.record-1/
  );

  assert.match(
    request.url,
    /user_id=eq\.user-a/
  );
});

test("delete scopes by id and authenticated user_id", async () => {
  const calls = installFetchMock({
    userId: "user-a",
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(context);

  await repositories.deleteOwned(
    "episodes",
    "record-9"
  );

  const request = calls.find(
    (call) =>
      call.url.includes(
        "/rest/v1/episodes"
      ) &&
      call.method === "DELETE"
  );

  assert.ok(request);

  assert.match(
    request.url,
    /id=eq\.record-9/
  );

  assert.match(
    request.url,
    /user_id=eq\.user-a/
  );
});

test("repository query errors fail closed", async () => {
  installFetchMock({
    userId: "user-a",
    queryStatus: 403,
  });

  const context =
    await createAuthenticatedSupabaseContext(
      "valid-token"
    );

  const repositories =
    createRuntimeRepositories(context);

  await assert.rejects(
    () =>
      repositories.selectOwned(
        "episodes"
      )
  );
});

test("participant facade rejects mismatched participant id", async () => {
  installFetchMock({
    userId: "user-a",
  });

  await assert.rejects(
    () =>
      createParticipantDataAccess(
        "valid-token",
        "user-b"
      ),
    /does not match/i
  );
});

test("participant facade derives participant id from authenticated identity", async () => {
  installFetchMock({
    userId: "user-a",
  });

  const participant =
    await createParticipantDataAccess(
      "valid-token",
      "user-a"
    );

  assert.equal(
    participant.participantId,
    "user-a"
  );
});

test("participant facade delegates reads through owner-scoped repository", async () => {
  const calls = installFetchMock({
    userId: "user-a",
  });

  const participant =
    await createParticipantDataAccess(
      "valid-token",
      "user-a"
    );

  await participant.getEpisodes();

  const request = calls.find(
    (call) =>
      call.url.includes(
        "/rest/v1/episodes"
      )
  );

  assert.ok(request);

  assert.match(
    request.url,
    /user_id=eq\.user-a/
  );
});