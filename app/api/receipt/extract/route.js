import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, snippet } = await req.json();

  // 1. Try to extract from the snippet first (fastest)
  // This pattern looks for numbers followed by SGD or SGD followed by numbers
  const amountRegex = /(\d+\.\d{2})\s?SGD|SGD\s?(\d+\.\d{2})/i;
  const match = snippet.match(amountRegex);
  
  // match[1] handles "15.48 SGD", match[2] handles "SGD 15.48"
  let amount = match ? (match[1] || match[2]) : "";

  // 2. If snippet fails, fetch the full message body for a deeper look
  if (!amount) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );
    const data = await res.json();
    const fullText = JSON.stringify(data);
    const deepMatch = fullText.match(/Total\s?Fee\s?Charged\s?([\d,]+\.?\d*)/i);
    amount = deepMatch ? deepMatch[1] : "";
  }

  return Response.json({ 
    amount: amount.replace(',', ''), // Remove commas for the form input
    description: snippet.toLowerCase().includes("tada") ? "TADA Ride" : "Grab Transport"
  });
}
