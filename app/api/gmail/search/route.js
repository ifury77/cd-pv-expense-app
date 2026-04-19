import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
      return Response.json({ results: [] });
    }

    // TODO: your Gmail logic here
    const results = [];

    return Response.json({ results });

  } catch (err) {
    console.error("Gmail API error:", err);

    return Response.json(
      { results: [], error: err.message },
      { status: 500 }
    );
  }
}

  const threads = threadsRes.data.threads || [];
  const results = [];

  for (const thread of threads.slice(0, 15)) {
    const threadData = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const msg = threadData.data.messages?.[0];
    if (!msg) continue;

    const headers = msg.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "";
    const from    = headers.find(h => h.name === "From")?.value || "";
    const date    = headers.find(h => h.name === "Date")?.value || "";
    const snippet = msg.snippet || "";

    // Parse amount from snippet
    const amountMatch = snippet.match(/(?:SGD|S\$|MYR|IDR|THB|USD)\s?[\d,]+\.?\d*/i);
    const amount = amountMatch ? amountMatch[0] : null;

    // Detect receipt type
    let type = "other";
    if (from.includes("grab.com")) type = snippet.toLowerCase().includes("food") ? "grabfood" : "grab";
    if (from.includes("tada.global")) type = "tada";

    results.push({ id: msg.id, threadId: thread.id, subject, from, date, snippet, amount, type });
  }

  return Response.json({ results });
}
