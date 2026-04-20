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

    // Extraction Logic
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    
    // Assume first line is the name, or second if first is a company
    const name = lines[0] ? lines[0].trim() : "New Contact";

    return NextResponse.json({
      name: name,
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      raw: text
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
