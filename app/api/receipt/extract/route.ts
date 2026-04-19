export async function POST(req: Request) {
  try {
    const { imageBase64, mediaType } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64
                }
              },
              {
                type: "text",
                text: `Extract receipt data as JSON:
{
  "date": "",
  "merchant": "",
  "amount": "",
  "currency": "",
  "description": "",
  "reference": ""
}
Only return JSON.`
              }
            ]
          }
        ]
      })
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || "{}";

    return Response.json({
      success: true,
      data: JSON.parse(text)
    });

  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message
    });
  }
}
