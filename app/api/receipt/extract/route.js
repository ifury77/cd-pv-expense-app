import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await req.json();

  // Fetch the full thread to get detailed info
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );

  const data = await res.json();
  const firstMsg = data.messages[0];
  const snippet = firstMsg.snippet;

  // Improved Regex for SGD/Amount extraction
  const amountMatch = snippet.match(/(?:SGD|S\$)\s?([\d,]+\.?\d*)/i);
  const amount = amountMatch ? amountMatch[1] : "";

  return Response.json({ 
    amount, 
    date: new Date(parseInt(firstMsg.internalDate)).toISOString().split('T')[0],
    description: `TADA Ride - ${snippet.substring(0, 30)}...`
  });
}
