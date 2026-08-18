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
          .filter(
            (item) =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string" &&
              item.content.trim()
          )
          .map((item) => ({
            role: item.role,
            content: item.content.trim(),
          }))
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
                "You are the RTM Pilot engine. Respond in Hebrew unless the user asks otherwise. Maintain continuity across the conversation and use the prior messages as context.",
            },
            ...messages,
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
