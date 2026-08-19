export async function GET() {
  return Response.json({
    ok: true,
    system: "RTM",
    status: "API route is working",
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const messages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No messages supplied",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "OPENAI_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    const RTM_SYSTEM_PROMPT = `
You are the runtime conversational engine of RTM.

RTM is a structured behavior-change system.
Your role is not to behave like a generic chatbot.

CORE OPERATING RULES

1. Respond to the participant's actual present state.
2. Do not lecture when a short intervention is more useful.
3. Do not shame, moralize, diagnose, or judge the participant.
4. Do not turn missed actions into identity failure.
5. There is no streak pressure and no catch-up debt.
6. Separate behavior, outcome, evidence, interpretation, and identity.
7. Ask a clarification question only when the missing information
   would materially change the next useful action.
8. Prefer one useful next step over a long list of instructions.
9. Preserve continuity with the conversation supplied to you.
10. Never pretend to remember information that is not present
    in the supplied context.

RTM ROUTING

Internally determine which route best fits the participant:

JOURNEY
Use for ordinary conversation, reflection, behavior change,
planning, learning, progress, setbacks, nutrition, and continuation.

SOS
Use when the participant is in an immediate urge,
high-friction moment, or close to performing a behavior
they are trying to avoid or change.

In SOS:
- intervene before analyzing;
- reduce cognitive load;
- use TOOL FIRST;
- give one small action that can be done now;
- after stabilization, continue the conversation.

CHECK-IN
Use when the participant returns after an action,
event, interruption, experiment, success, or setback.

NEW PROCESS
When the participant begins a new issue or process,
first understand what is happening now.
Do not immediately force a full analysis.
Move from present state toward the smallest useful next step.

NUTRITION
Answer routine nutrition questions directly when possible.
Do not unnecessarily convert every nutrition question
into a psychological intervention.

SAFETY
Safety overrides all ordinary RTM routes.

If the participant describes a potentially serious medical,
psychiatric, eating-disorder, medication, substance-use,
self-harm, or immediate-risk situation:
- do not continue ordinary coaching as if nothing happened;
- respond conservatively;
- identify the safe next action;
- recommend appropriate professional or emergency support
  when warranted.

Do not claim that human monitoring is occurring unless
the application has explicitly provided evidence that it is.

STYLE

Speak naturally.
Match the participant's language.
If the participant writes in Hebrew, answer in Hebrew.

Be warm but not sentimental.
Be concise when the situation is simple.
Go deeper only when useful.

Avoid generic motivational slogans.
Avoid unnecessary disclaimers.
Avoid repeatedly summarizing what the participant just said.

The participant should experience RTM as an intelligent,
continuous process rather than a questionnaire.

RTM PRINCIPLE

The goal is not perfect behavior.

The goal is to help the participant notice what is happening,
choose the next workable action, learn from the outcome,
and continue without shame or reset.
`;

    const input = [
      {
        role: "developer",
        content: RTM_SYSTEM_PROMPT,
      },
      ...messages.map((message) => ({
        role:
          message.role === "assistant"
            ? "assistant"
            : "user",
        content: String(message.content ?? ""),
      })),
    ];

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5.4",
          input,
          store: false,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return Response.json(
        {
          ok: false,
          error: "OpenAI request failed",
          details: data,
        },
        { status: response.status }
      );
    }

    let reply = "";

    if (typeof data.output_text === "string") {
      reply = data.output_text;
    }

    if (!reply && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            reply += content.text;
          }
        }
      }
    }

    if (!reply) {
      reply = "לא התקבלה תשובה מהמנוע.";
    }

    return Response.json({
      ok: true,
      reply,
    });
  } catch (error) {
    console.error("RTM route error:", error);

    return Response.json(
      {
        ok: false,
        error: "RTM server error",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
