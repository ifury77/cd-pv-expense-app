import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  if (!messageId) return Response.json({ error: "No message ID" }, { status: 400 });

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

  function decodeBody(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const text = decodeBody(part);
        if (text) return text;
      }
    }
    return "";
  }

  const body = decodeBody(msg.data.payload);
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const amountMatch = text.match(/(?:Total(?:\s+(?:Paid|Fee|Charged))?)\s*(?:SGD|S\$)?\s*([\d,]+\.?\d*)\s*(?:SGD)?/i);
  const bookingMatch = text.match(/(?:Booking\s+(?:ID|Code)|Booking\s+code)\s*[:\s]*([A-Z0-9\-]{8,})/i);

  return Response.json({
    subject, from, date,
    text: text.slice(0, 2000),
    amount: amountMatch ? amountMatch[1] : null,
    booking: bookingMatch ? bookingMatch[1] : null,
  });
}
