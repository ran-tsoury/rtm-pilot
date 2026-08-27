import test from "node:test";
import assert from "node:assert/strict";

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

function createMockRepositories({
  ownerId = "user-a",
  selectedRows = {},
} = {}) {
  const calls = {
    select: [],
    insert: [],
    update: [],
  };

  const repositories = {
    ownerId,

    async selectOwned(table, options = {}) {
      calls.select.push({
        table,
        options,
      });

      return selectedRows[table] ?? [];
    },

    async insertOwned(table, values = {}) {
      calls.insert.push({
        table,
        values,
      });

      return [
        {
          id: "inserted-id",
          user_id: ownerId,
          ...values,
        },
      ];
    },

    async updateOwned(
      table,
      id,
      values = {}
    ) {
      calls.update.push({
        table,
        id,
        values,
      });

      return [
        {
          id,
          user_id: ownerId,
          ...values,
        },
      ];
    },
  };

  return {
    repositories,
    calls,
  };
}

test(
  "state persistence rejects unverified repository shape",
  () => {
    assert.throws(
      () =>
        createStatePersistence({
          ownerId: "user-a",
        }),
      /Verified runtime repositories are required/
    );
  }
);

test(
  "state persistence exposes authenticated repository owner only",
  () => {
    const {
      repositories,
    } = createMockRepositories({
      ownerId: "verified-user",
    });

    const persistence =
      createStatePersistence(
        repositories
      );

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
      repositories,
      calls,
    } = createMockRepositories();

    const persistence =
      createStatePersistence(
        repositories
      );

    const result =
      await persistence.saveJourneyState(
        {
          currentStage: 1,
          currentState: "ACTIVE",
          currentLoad: "LOW",
          supportLevel: "STANDARD",
          context: "HOME",
        }
      );

    assert.equal(
      calls.insert.length,
      1
    );

    assert.equal(
      calls.insert[0].table,
      "journey_state"
    );

    assert.deepEqual(
      calls.insert[0].values,
      {
        current_stage: 1,
        current_state: "ACTIVE",
        current_load: "LOW",
        support_mode: "STANDARD",
        current_context: "HOME",
        context_confidence: null,
        open_context_exceptions: [],
        last_reality_gate_at: null,
        last_meaningful_return_at:
          null,
      }
    );

    assert.equal(
      result.user_id,
      "user-a"
    );
  }
);

test(
  "journey state updates existing owner-scoped row instead of creating another row",
  async () => {
    const {
      repositories,
      calls,
    } = createMockRepositories({
      selectedRows: {
        journey_state: [
          {
            id: "journey-1",
            user_id: "user-a",
            current_stage: 1,
          },
        ],
      },
    });

    const persistence =
      createStatePersistence(
        repositories
      );

    await persistence.saveJourneyState({
      currentStage: 2,
      currentState: "RETURNING",
      currentLoad: "MEDIUM",
      supportLevel: "HIGH",
      context: "WORK",
    });

    assert.equal(
      calls.insert.length,
      0
    );

    assert.equal(
      calls.update.length,
      1
    );

    assert.equal(
      calls.update[0].table,
      "journey_state"
    );

    assert.equal(
      calls.update[0].id,
      "journey-1"
    );

    assert.equal(
      calls.update[0].values
        .current_stage,
      2
    );
  }
);

test(
  "memory persistence maps canonical memory record without accepting caller ownership",
  async () => {
    const {
      repositories,
      calls,
    } = createMockRepositories({
      ownerId: "verified-user",
    });

    const persistence =
      createStatePersistence(
        repositories
      );

    await persistence.saveMemoryRecord(
      {
        status:
          MEMORY_STATUS.KNOWN,
        confidence: 0.8,
        supersedesId: null,
      },
      {
        memoryLevel: "WORKING",
        memoryType: "FACT",
        content:
          "Participant completed the observed action",
        sourceEpisodeId:
          "episode-1",
      }
    );

    assert.equal(
      calls.insert.length,
      1
    );

    assert.equal(
      calls.insert[0].table,
      "memory_items"
    );

    assert.equal(
      calls.insert[0].values
        .status,
      MEMORY_STATUS.KNOWN
    );

    assert.equal(
      calls.insert[0].values
        .confidence,
      "0.8"
    );

    assert.equal(
      Object.hasOwn(
        calls.insert[0].values,
        "user_id"
      ),
      false
    );
  }
);

test(
  "superseded memory is marked non-reusable",
  async () => {
    const {
      repositories,
      calls,
    } = createMockRepositories();

    const persistence =
      createStatePersistence(
        repositories
      );

    await persistence.markMemorySuperseded(
      "memory-1"
    );

    assert.equal(
      calls.update.length,
      1
    );

    assert.deepEqual(
      calls.update[0],
      {
        table: "memory_items",
        id: "memory-1",
        values: {
          status:
            MEMORY_STATUS.SUPERSEDED,
          do_not_reuse: true,
        },
      }
    );
  }
);

test(
  "suggested experience rejects caller-selected user that differs from authenticated owner",
  async () => {
    const {
      repositories,
    } = createMockRepositories({
      ownerId: "verified-user",
    });

    const persistence =
      createStatePersistence(
        repositories
      );

    await assert.rejects(
      persistence.saveSuggestedExperience(
        {
          userId:
            "attacker-selected-user",
          status:
            EXPERIENCE_STATUS.SUGGESTED,
          context: null,
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
  }
);

test(
  "suggested experience persists as UNKNOWN outcome without inferring execution",
  async () => {
    const {
      repositories,
      calls,
    } = createMockRepositories({
      ownerId: "user-a",
    });

    const persistence =
      createStatePersistence(
        repositories
      );

    await persistence.saveSuggestedExperience(
      {
        userId: "user-a",
        status:
          EXPERIENCE_STATUS.SUGGESTED,
        context: "HOME",
        suggestedAt:
          "2026-08-28T00:00:00.000Z",
      },
      {
        episodeId: "episode-1",
        route: "JOURNEY",
        toolFamily: "MICRO_ACTION",
        suggestedAction:
          "Drink a glass of water",
      }
    );

    assert.equal(
      calls.insert.length,
      1
    );

    const payload =
      calls.insert[0].values;

    assert.equal(
      calls.insert[0].table,
      "interventions"
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
  "experience lifecycle persistence keeps selected executed outcome and confidence as separate transitions",
  async () => {
    const {
      repositories,
      calls,
    } = createMockRepositories({
      ownerId: "user-a",
    });

    const persistence =
      createStatePersistence(
        repositories
      );

    await persistence.persistExperienceTransition(
      "intervention-1",
      {
        userId: "user-a",
        status:
          EXPERIENCE_STATUS.SELECTED,
      },
      {
        selectedAction:
          "Walk for five minutes",
      }
    );

    await persistence.persistExperienceTransition(
      "intervention-1",
      {
        userId: "user-a",
        status:
          EXPERIENCE_STATUS.EXECUTED,
        executedAt:
          "2026-08-28T01:00:00.000Z",
      },
      {
        executedAction:
          "Walked for five minutes",
      }
    );

    await persistence.persistExperienceTransition(
      "intervention-1",
      {
        userId: "user-a",
        status:
          EXPERIENCE_STATUS.OUTCOME,
        outcome:
          OUTCOME_STATUS.POSITIVE,
        outcomeNote:
          "Felt calmer",
        outcomeAt:
          "2026-08-28T01:10:00.000Z",
      }
    );

    await persistence.persistExperienceTransition(
      "intervention-1",
      {
        userId: "user-a",
        status:
          EXPERIENCE_STATUS.CONFIDENCE,
        confidence: 0.9,
      }
    );

    assert.equal(
      calls.update.length,
      4
    );

    assert.deepEqual(
      calls.update[0].values,
      {
        selected_action:
          "Walk for five minutes",
      }
    );

    assert.deepEqual(
      calls.update[1].values,
      {
        executed_action:
          "Walked for five minutes",
        executed_at:
          "2026-08-28T01:00:00.000Z",
      }
    );

    assert.deepEqual(
      calls.update[2].values,
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
      calls.update[3].values,
      {
        reliability_confidence:
          "0.9",
      }
    );
  }
);