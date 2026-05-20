export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "OPENAI_API_KEY mancante",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const prompt =
      body?.prompt ||
      'Rispondi solo con JSON: {"test":true,"messaggio":"ok"}';

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: data?.error?.message || "Errore OpenAI",
          details: data,
        },
        { status: response.status }
      );
    }

    const text =
      data.output_text ||
      data.output
        ?.flatMap((item: any) => item.content || [])
        ?.map((content: any) => content.text || "")
        ?.join("") ||
      "";

    return Response.json({
      ok: true,
      model,
      text,
      raw: data,
    });
  } catch (error: any) {
    return Response.json(
      {
        ok: false,
        error: error.message || "Errore API analisi documenti",
      },
      { status: 500 }
    );
  }
}