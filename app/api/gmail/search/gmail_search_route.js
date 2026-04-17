import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "receipt OR invoice";

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  // Search threads
  const threadsRes = await gmail.users.threads.list({
    userId: "me",
    q,
    maxResults: 20,
    includeSpamTrash: true,
  });

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
