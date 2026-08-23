import {
  isRuntimeAuthorityError,
} from "../../../runtime/authority/authority-error.mjs";
import { loadRuntimePackage } from "../../../runtime/authority/load-runtime-package.mjs";

export async function GET() {
  const runtimePackage = loadRuntimePackage();

  return Response.json({
    ok: true,
    system: "RTM",
    status: "API route is working",
    packageId: runtimePackage.manifest.packageId,
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

    const runtimePackage = loadRuntimePackage();

    const input = [
      {
        role: "developer",
        content: runtimePackage.systemPrompt,
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
      packageId: runtimePackage.manifest.packageId,
    });
  } catch (error) {
    console.error("RTM route error:", error);

    if (isRuntimeAuthorityError(error)) {
      return Response.json(
        {
          ok: false,
          error: "Runtime authority package rejected",
          code: error.code,
        },
        { status: 500 }
      );
    }

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
