import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export const maxDuration = 30;

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return Response.json({ error: "Not signed in", results: [] }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = encodeURIComponent(searchParams.get("q") || "receipt OR invoice");

    // Use Gmail REST API directly with fetch - no googleapis package needed
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${q}&maxResults=20&includeSpamTrash=true`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      return Response.json({ error: `Gmail API error: ${listRes.status}`, results: [], detail: err }, { status: 500 });
    }

    const listData = await listRes.json();
    const threads = listData.threads || [];
    const results = [];

    for (const thread of threads.slice(0, 15)) {
      try {
        const tRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (!tRes.ok) continue;
        const tData = await tRes.json();

        const msg = tData.messages?.[0];
        if (!msg) continue;

        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "";
        const from    = headers.find(h => h.name === "From")?.value || "";
        const date    = headers.find(h => h.name === "Date")?.value || "";
        const snippet = msg.snippet || "";

        // Skip forwarded emails
        if (subject.toLowerCase().startsWith("fwd:") || subject.toLowerCase().startsWith("fw:")) continue;

        const amountMatch = snippet.match(/(?:SGD|S\$|MYR|IDR|THB|USD)\s?[\d,]+\.?\d*/i);
        const amount = amountMatch ? amountMatch[0] : null;

        let type = "other";
        if (from.includes("grab.com")) type = snippet.toLowerCase().includes("food") ? "grabfood" : "grab";
        if (from.includes("tada.global")) type = "tada";

        results.push({ id: msg.id, threadId: thread.id, subject, from, date, snippet, amount, type });
      } catch (e) { continue; }
    }

    return Response.json({ results });

  } catch (err) {
    return Response.json({ error: err.message || "Unknown error", results: [] }, { status: 500 });
  }
}
