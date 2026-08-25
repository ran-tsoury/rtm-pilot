import {
  createAuthenticatedSupabaseContext,
} from "./client.mjs";

import {
  createRuntimeRepositories,
} from "./repositories.mjs";

export async function createParticipantDataAccess(
  accessToken,
  expectedParticipantId = null,
  options = {}
) {
  const context =
    await createAuthenticatedSupabaseContext(
      accessToken,
      options
    );

  if (
    expectedParticipantId !== null &&
    expectedParticipantId !== undefined &&
    expectedParticipantId !== context.ownerId
  ) {
    throw new Error(
      "Authenticated user does not match the requested participant"
    );
  }

  const repositories =
    createRuntimeRepositories(context);

  return Object.freeze({
    participantId: context.ownerId,

    getProfile() {
      return repositories.selectOwned("profiles", {
        limit: 1,
      });
    },

    getJourneyState() {
      return repositories.selectOwned("journey_state", {
        limit: 1,
      });
    },

    getDailyPresence() {
      return repositories.selectOwned("daily_presence", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getEpisodes() {
      return repositories.selectOwned("episodes", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getEvidence() {
      return repositories.selectOwned("evidence", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getInterventions() {
      return repositories.selectOwned("interventions", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getMemoryItems() {
      return repositories.selectOwned("memory_items", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getWeightEntries() {
      return repositories.selectOwned("weight_entries", {
        orderBy: "created_at",
        ascending: false,
      });
    },

    getAppEvents() {
      return repositories.selectOwned("app_events", {
        orderBy: "created_at",
        ascending: false,
      });
    },
  });
}