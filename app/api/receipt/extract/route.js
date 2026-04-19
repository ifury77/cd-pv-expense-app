import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await req.json();

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );
  
  const data = await res.json();
  const msg = data.messages[0];
  
  // Use the snippet + the first message body
  // We clean the text to remove all extra spaces and hidden characters
  const rawContent = msg.snippet + " " + (msg.payload.body?.data || "");
  const cleanText = rawContent.replace(/\s+/g, ' ');

  console.log("Debug Clean Text:", cleanText); // This will show in your Vercel Logs

  let amount = "";

  // 1. TADA Specific: Look for digits right after "Total Fee Charged"
  const tadaMatch = cleanText.match(/Total\s?Fee\s?Charged\s?([\d,]+\.\d{2})/i);
  
  // 2. Fallback: Find any number that is next to "SGD" (before or after)
  const sgdMatch = cleanText.match(/([\d,]+\.\d{2})\s?SGD|SGD\s?([\d,]+\.\d{2})/i);

  if (tadaMatch) {
    amount = tadaMatch[1];
  } else if (sgdMatch) {
    amount = sgdMatch[1] || sgdMatch[2];
  }

  return Response.json({ 
    amount: amount ? amount.replace(',', '') : "",
    date: new Date(parseInt(msg.internalDate)).toISOString().split('T')[0],
    description: cleanText.toLowerCase().includes("tada") ? "TADA Ride" : "Grab Transport"
  });
}
