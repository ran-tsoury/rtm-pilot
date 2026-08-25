import { createSupabaseClient } from "./client.mjs";

function assertParticipantId(participantId) {
  if (!participantId || typeof participantId !== "string") {
    throw new Error("A valid participantId is required");
  }
}

async function execute(query, context) {
  const { data, error } = await query;

  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  return data;
}

export function createParticipantDataAccess(accessToken, participantId) {
  assertParticipantId(participantId);

  const supabase = createSupabaseClient(accessToken);

  return Object.freeze({
    participantId,

    async getProfile() {
      return execute(
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", participantId)
          .maybeSingle(),
        "Failed to load participant profile"
      );
    },

    async getJourneyState() {
      return execute(
        supabase
          .from("journey_state")
          .select("*")
          .eq("user_id", participantId)
          .maybeSingle(),
        "Failed to load participant journey state"
      );
    },

    async getDailyPresence() {
      return execute(
        supabase
          .from("daily_presence")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant daily presence"
      );
    },

    async getEpisodes() {
      return execute(
        supabase
          .from("episodes")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant episodes"
      );
    },

    async getEvidence() {
      return execute(
        supabase
          .from("evidence")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant evidence"
      );
    },

    async getInterventions() {
      return execute(
        supabase
          .from("interventions")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant interventions"
      );
    },

    async getMemoryItems() {
      return execute(
        supabase
          .from("memory_items")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant memory items"
      );
    },

    async getWeightEntries() {
      return execute(
        supabase
          .from("weight_entries")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant weight entries"
      );
    },

    async getAppEvents() {
      return execute(
        supabase
          .from("app_events")
          .select("*")
          .eq("user_id", participantId)
          .order("created_at", { ascending: false }),
        "Failed to load participant app events"
      );
    },
  });
}