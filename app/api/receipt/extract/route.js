export async function POST(req) {
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return Response.json({ error: "No image provided" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY not configured in environment variables" }, { status: 500 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 },
              },
              {
                type: "text",
                text: `You are an expert receipt parser for a Singapore-based expense system. 
Extract information from this receipt image and return ONLY a valid JSON object â€” no markdown, no backticks, no explanation.

The receipt may be in any language or currency (SGD, IDR, MYR, THB, USD, etc).
For Indonesian receipts: Rp = IDR. For Malaysian: RM = MYR. For Thai: à¸¿ = THB.

Return this exact JSON structure:
{
  "date": "DD Mon YYYY format e.g. 12 Feb 2026, or null",
  "merchant": "company or app name e.g. Bluebird, Grab, Hotel Mulia",
  "description": "brief expense description e.g. Bluebird Taxi - Jakarta, Hotel Stay, Client Lunch",
  "reference": "order ID, booking ID, receipt number if visible, or null",
  "amount": numeric amount as a number e.g. 226490,
  "currency": "3-letter code: SGD, IDR, MYR, THB, USD, EUR",
  "orig_amount_str": "formatted original e.g. Rp226,490 or SGD 25.50",
  "sgd_amount": null
}

If currency is SGD, set sgd_amount equal to amount.
If not SGD, set sgd_amount to null (will be converted with live rate).`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `Claude API error ${response.status}: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      return Response.json({ error: "Could not parse AI response", raw: text }, { status: 500 });
    }

    // Fetch live exchange rate if not SGD
    if (parsed.currency && parsed.currency !== "SGD" && parsed.amount) {
      try {
        const rateRes = await fetch(`https://open.er-api.com/v6/latest/${parsed.currency}`);
        const rateData = await rateRes.json();
        if (rateData.result === "success" && rateData.rates?.SGD) {
          const rate = rateData.rates.SGD;
          parsed.sgd_amount = Math.round(parsed.amount * rate * 100) / 100;
          parsed.rate_note = `Live rate: 1 ${parsed.currency} = ${rate.toFixed(6)} SGD (${new Date().toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric"})})`;
        }
      } catch(e) {
        // Rate fetch failed, leave sgd_amount as null
      }
    }

    return Response.json({ success: true, data: parsed });

  } catch (err) {
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
