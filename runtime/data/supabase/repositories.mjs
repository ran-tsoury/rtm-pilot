import { requireOwnerId } from "./owner-scope.mjs";

export function createRuntimeRepositories({ supabase, ownerId } = {}) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("A valid Supabase client is required");
  }

  const uid = requireOwnerId(ownerId);

  async function selectOwned(table, options = {}) {
    let query = supabase
      .from(table)
      .select(options.select ?? "*")
      .eq("user_id", uid);

    if (options.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? true,
      });
    }

    if (Number.isInteger(options.limit)) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }

  async function insertOwned(table, values = {}) {
    const payload = {
      ...values,
      user_id: uid,
    };

    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select();

    if (error) throw error;
    return data ?? [];
  }

  async function updateOwned(table, id, values = {}) {
    const payload = { ...values };

    delete payload.user_id;
    delete payload.owner_id;

    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .eq("user_id", uid)
      .select();

    if (error) throw error;
    return data ?? [];
  }

  async function deleteOwned(table, id) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", uid)
      .select();

    if (error) throw error;
    return data ?? [];
  }

  return Object.freeze({
    ownerId: uid,
    selectOwned,
    insertOwned,
    updateOwned,
    deleteOwned,
  });
}