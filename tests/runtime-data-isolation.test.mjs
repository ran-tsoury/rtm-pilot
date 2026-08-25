import test from "node:test";
import assert from "node:assert/strict";

import {
  assertOwnerScope,
  ownerScopedFilter,
} from "../runtime/data/supabase/owner-scope.mjs";

import {
  createRuntimeRepositories,
} from "../runtime/data/supabase/repositories.mjs";

test("owner scope rejects missing owner id", () => {
  assert.throws(
    () => assertOwnerScope(),
    /owner/i
  );
});

test("owner scope rejects empty owner id", () => {
  assert.throws(
    () => assertOwnerScope(""),
    /owner/i
  );
});

test("owner scope accepts a valid owner id", () => {
  assert.equal(
    assertOwnerScope("owner-123"),
    "owner-123"
  );
});

test("owner scoped filter applies user_id isolation", () => {
  const filter = ownerScopedFilter("owner-123");

  assert.deepEqual(filter, {
    user_id: "owner-123",
  });
});

test("runtime repositories require a supabase client", () => {
  assert.throws(
    () => createRuntimeRepositories(),
    /supabase/i
  );
});

test("runtime repositories are bound to one owner", () => {
  const fakeSupabase = {
    from() {
      return {};
    },
  };

  const repositories = createRuntimeRepositories({
    supabase: fakeSupabase,
    ownerId: "owner-123",
  });

  assert.equal(repositories.ownerId, "owner-123");
});