import { ImageAnnotatorClient } from '@google-cloud/vision';
import { NextResponse } from 'next/server';

const client = new ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
});

export async function POST(req) {
  try {
    const { image } = await req.json();
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const [result] = await client.textDetection(buffer);
    const text = result.fullTextAnnotation?.text || "";
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // More aggressive Email regex
    const emailMatch = text.match(/[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    // More aggressive Phone regex (handles spaces, dots, and plus signs)
    const phoneMatch = text.match(/(\+?[\d\s\.\-\(\)]{8,})/);
    
    // Cleanup phone: if it's just a long string of numbers/chars, keep it
    let phone = phoneMatch ? phoneMatch[0].trim() : "";
    if (phone.length < 8) phone = ""; // Ignore short strings that aren't phones

    return NextResponse.json({
      name: lines[0] ? lines[0].trim() : "New Contact",
      email: emailMatch ? emailMatch[0] : "",
      phone: phone,
      raw: text
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
