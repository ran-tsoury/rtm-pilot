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

    return Response.json({
      ok: true,
      system: "RTM",
      received: body,
      message: "RTM API connection successful",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        system: "RTM",
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}
