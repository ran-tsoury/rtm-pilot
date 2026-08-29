import {
  requireVerifiedSupabaseContext,
} from "./client.mjs";

export const PARTICIPANT_OWNED_TABLES = Object.freeze([
  "profiles",
  "journey_state",
  "daily_presence",
  "episodes",
  "evidence",
  "interventions",
  "memory_items",
  "weight_entries",
  "app_events",
]);

const verifiedRepositories = new WeakSet();

function requireAllowedTable(table) {
  if (!PARTICIPANT_OWNED_TABLES.includes(table)) {
    throw new Error(
      `Table is not approved for participant access: ${table}`
    );
  }

  return table;
}

function requireNonEmptyString(value, field) {
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

export function createRuntimeRepositories(context) {
  const {
    supabase,
    ownerId,
  } = requireVerifiedSupabaseContext(context);

  function tableFor(table) {
    return supabase.from(
      requireAllowedTable(table)
    );
  }

  async function selectOwned(
    table,
    options = {}
  ) {
    let query = tableFor(table)
      .select(options.select ?? "*")
      .eq("user_id", ownerId);

    if (options.orderBy) {
      query = query.order(
        options.orderBy,
        {
          ascending:
            options.ascending ?? true,
        }
      );
    }

    if (
      Number.isInteger(options.limit)
    ) {
      query = query.limit(
        options.limit
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async function insertOwned(
    table,
    values = {}
  ) {
    const payload = {
      ...values,
      user_id: ownerId,
    };

    const {
      data,
      error,
    } = await tableFor(table)
      .insert(payload)
      .select();

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async function updateOwned(
    table,
    id,
    values = {}
  ) {
    if (!id) {
      throw new Error(
        "A record id is required"
      );
    }

    const payload = {
      ...values,
    };

    delete payload.user_id;
    delete payload.owner_id;

    const {
      data,
      error,
    } = await tableFor(table)
      .update(payload)
      .eq("id", id)
      .eq("user_id", ownerId)
      .select();

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async function deleteOwned(
    table,
    id
  ) {
    if (!id) {
      throw new Error(
        "A record id is required"
      );
    }

    const {
      data,
      error,
    } = await tableFor(table)
      .delete()
      .eq("id", id)
      .eq("user_id", ownerId)
      .select();

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async function supersedeMemoryOwned({
    previousId,
    memoryLevel,
    memoryType,
    content,
    status,
    confidence = null,
    sourceEpisodeId = null,
  } = {}) {
    const id =
      requireNonEmptyString(
        previousId,
        "previousId"
      );

    const normalizedMemoryLevel =
      requireNonEmptyString(
        memoryLevel,
        "memoryLevel"
      );

    const normalizedMemoryType =
      requireNonEmptyString(
        memoryType,
        "memoryType"
      );

    const normalizedContent =
      requireNonEmptyString(
        content,
        "content"
      );

    const normalizedStatus =
      requireNonEmptyString(
        status,
        "status"
      );

    const {
      data,
      error,
    } = await supabase.rpc(
      "rtm_supersede_memory",
      {
        p_previous_id:
          id,

        p_memory_level:
          normalizedMemoryLevel,

        p_memory_type:
          normalizedMemoryType,

        p_content:
          normalizedContent,

        p_status:
          normalizedStatus,

        p_confidence:
          confidence === null ||
          confidence === undefined
            ? null
            : String(confidence),

        p_source_episode_id:
          sourceEpisodeId ?? null,
      }
    );

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  const repositories =
    Object.freeze({
      ownerId,
      selectOwned,
      insertOwned,
      updateOwned,
      deleteOwned,
      supersedeMemoryOwned,
    });

  verifiedRepositories.add(
    repositories
  );

  return repositories;
}

export function requireVerifiedRuntimeRepositories(
  repositories
) {
  if (
    !repositories ||
    typeof repositories !== "object" ||
    !verifiedRepositories.has(
      repositories
    )
  ) {
    throw new Error(
      "Verified runtime repositories are required"
    );
  }

  return repositories;
}