import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/options";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  if (!messageId) return Response.json({ error: "No ID" }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const subject = headers.find(h => h.name === "Subject")?.value || "";
  const from    = headers.find(h => h.name === "From")?.value || "";
  const date    = headers.find(h => h.name === "Date")?.value || "";

  // Decode body - get HTML preferably, fallback to text
  function decodeBody(payload) {
    // Try to get HTML part first
    if (payload.mimeType === "text/html" && payload.body?.data) {
      return { html: Buffer.from(payload.body.data, "base64").toString("utf-8"), text: null };
    }
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return { html: null, text: Buffer.from(payload.body.data, "base64").toString("utf-8") };
    }
    if (payload.parts) {
      let html = null, text = null;
      for (const part of payload.parts) {
        const result = decodeBody(part);
        if (result.html) html = result.html;
        if (result.text && !text) text = result.text;
      }
      return { html, text };
    }
    return { html: null, text: null };
  }

  const { html, text } = decodeBody(msg.data.payload);

  // Extract key fields from text for fallback
  const plainText = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
  const amountMatch = plainText.match(/(?:Total(?:\s+(?:Paid|Fee|Charged))?)\s*(?:SGD|S\$)?\s*([\d,]+\.?\d*)\s*(?:SGD)?/i);
  const bookingMatch = plainText.match(/(?:Booking\s+(?:ID|Code)|Booking\s+code)\s*[:\s]*([A-Z0-9\-]{8,})/i);

  return Response.json({
    subject, from, date,
    html: html || null,
    text: plainText.slice(0, 1000),
    amount: amountMatch ? amountMatch[1] : null,
    booking: bookingMatch ? bookingMatch[1] : null,
  });
}
