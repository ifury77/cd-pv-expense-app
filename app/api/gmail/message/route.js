import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export const maxDuration = 30;

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");
    if (!messageId) return Response.json({ error: "No ID" }, { status: 400 });

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    if (!res.ok) return Response.json({ error: `Gmail error: ${res.status}` }, { status: 500 });

    const msg = await res.json();
    const headers = msg.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "";
    const from    = headers.find(h => h.name === "From")?.value || "";
    const date    = headers.find(h => h.name === "Date")?.value || "";

    function decodeBody(payload) {
      if (payload.mimeType === "text/html" && payload.body?.data) {
        return Buffer.from(payload.body.data, "base64").toString("utf-8");
      }
      if (payload.parts) {
        for (const part of payload.parts) {
          const r = decodeBody(part);
          if (r) return r;
        }
      }
      return null;
    }

    const html = decodeBody(msg.payload);
    return Response.json({ subject, from, date, html: html || null });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
