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

    const userMessage =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!userMessage) {
      return Response.json(
        {
          ok: false,
          error: "Missing message",
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
                "You are the RTM Pilot engine. Respond in Hebrew unless the user asks otherwise. For now, keep responses concise. RTM canonical logic will be added in later stages.",
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      }
    );

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      return Response.json(
        {
          ok: false,
          error: "OpenAI request failed",
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
      response: text,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "RTM server error",
      },
      { status: 500 }
    );
  }
}
