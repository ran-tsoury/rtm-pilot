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
          error: "Missing messages",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          ok: false,
          error: "OPENAI_API_KEY is not configured",
        },
        { status: 500 }
      );
    }

    const cleanMessages = messages
      .filter(
        (msg) =>
          msg &&
          typeof msg.content === "string" &&
          msg.content.trim()
      )
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.trim(),
      }));

    if (cleanMessages.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No valid messages",
        },
        { status: 400 }
      );
    }

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          input: [
            {
              role: "developer",
              content:
                "You are the RTM Pilot engine. Respond in Hebrew unless the user asks otherwise. Maintain the context of the conversation and respond naturally to follow-up messages.",
            },
            ...cleanMessages,
          ],
        }),
      }
    );

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      return Response.json(
        {
          ok: false,
          error:
            data?.error?.message ||
            data?.message ||
            JSON.stringify(data),
          details: data,
        },
        { status: openAIResponse.status }
      );
    }

    const text =
      data.output
        ?.flatMap((item) => item.content || [])
        ?.find((part) => part.type === "output_text")
        ?.text || "";

    return Response.json({
      ok: true,
      system: "RTM",
      reply: text,
      response: text,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "RTM server error",
      },
      { status: 500 }
    );
  }
}
