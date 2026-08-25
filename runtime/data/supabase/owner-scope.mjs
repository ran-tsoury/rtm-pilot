export class OwnerScopeError extends Error {
  constructor(message, code = "OWNER_SCOPE_ERROR") {
    super(message);
    this.name = "OwnerScopeError";
    this.code = code;
  }
}

export function requireOwnerId(ownerId) {
  if (typeof ownerId !== "string" || ownerId.trim() === "") {
    throw new OwnerScopeError(
      "A valid ownerId is required for data access.",
      "OWNER_ID_REQUIRED"
    );
  }

  return ownerId.trim();
}

export function assertOwnerScope(ownerId) {
  return requireOwnerId(ownerId);
}

export function ownerScopedFilter(ownerId) {
  return {
    user_id: requireOwnerId(ownerId),
  };
}

export function scopeQueryToOwner(query, ownerId) {
  const uid = requireOwnerId(ownerId);

  if (!query || typeof query.eq !== "function") {
    throw new OwnerScopeError(
      "A Supabase query builder is required.",
      "INVALID_QUERY_BUILDER"
    );
  }

  return query.eq("user_id", uid);
}

export function assertOwnedRecord(record, ownerId) {
  const uid = requireOwnerId(ownerId);

  if (!record || record.user_id !== uid) {
    throw new OwnerScopeError(
      "Record is outside the authenticated owner scope.",
      "OWNER_SCOPE_VIOLATION"
    );
  }

  return record;
}