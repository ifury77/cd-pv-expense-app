import { ImageAnnotatorClient } from '@google-cloud/vision';
import { NextResponse } from 'next/server';

// Initialize with environment variable credentials
const client = new ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
});

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image) throw new Error("No image data received");
    
    const buffer = Buffer.from(image.split(',')[1], 'base64');
    const [result] = await client.textDetection(buffer);
    const fullText = result.fullTextAnnotation?.text || "";

    if (!fullText) throw new Error("AI could not read any text in this image.");

    // Improved Extraction Logic
    const amountMatch = fullText.match(/(?:SGD|S\$|Total|NET|AMT|Payable)\s?[:]*\s?([\d.,]+)/i);
    const dateMatch = fullText.match(/\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}/i) || fullText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    const lines = fullText.split('\n').filter(l => l.trim().length > 3);

    return NextResponse.json({
      desc: lines[0] || "Scanned Receipt",
      amount: amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00",
      date: dateMatch ? dateMatch[0] : new Date().toLocaleDateString('en-GB')
    });
  } catch (error) {
    console.error("OCR Server Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
