import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await req.json();

  // Fetch the full message data
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );
  
  const data = await res.json();
  const msg = data.messages[0];
  const snippet = msg.snippet;
  
  // Combine snippet and parts of the body to find the amount
  // This looks for: Total Fee Charged [Number] or [Number] SGD
  const fullText = snippet + " " + JSON.stringify(msg.payload);
  
  // Clean up the text (remove escaped characters)
  const cleanText = fullText.replace(/\\n|\\r|\\t/g, ' ');

  // Extraction logic:
  // 1. Look for TADA's "Total Fee Charged X.XX"
  // 2. Look for Grab's "SGD X.XX"
  let amount = "";
  const tadaMatch = cleanText.match(/Total\s?Fee\s?Charged\s?([\d,]+\.?\d*)/i);
  const grabMatch = cleanText.match(/(?:SGD|S\$)\s?([\d,]+\.?\d*)|([\d,]+\.?\d*)\s?SGD/i);

  if (tadaMatch) {
    amount = tadaMatch[1];
  } else if (grabMatch) {
    amount = grabMatch[1] || grabMatch[2];
  }

  return Response.json({ 
    amount: amount.replace(',', ''),
    date: new Date(parseInt(msg.internalDate)).toISOString().split('T')[0],
    description: snippet.toLowerCase().includes("tada") ? "TADA Ride" : "Grab Transport"
  });
}
