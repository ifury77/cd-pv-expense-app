import { ImageAnnotatorClient } from '@google-cloud/vision';
import { NextResponse } from 'next/server';

const client = new ImageAnnotatorClient();

export async function POST(req) {
  try {
    const { image } = await req.json();
    const buffer = Buffer.from(image.split(',')[1], 'base64');
    const [result] = await client.textDetection(buffer);
    const fullText = result.fullTextAnnotation.text;

    // AI Logic to find details
    const lines = fullText.split('\n');
    const amountMatch = fullText.match(/(?:SGD|S\$|TOTAL|NET|AMT)\s?[:]*\s?([\d.,]+)/i);
    const dateMatch = fullText.match(/\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}/i) || fullText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);

    return NextResponse.json({
      desc: lines[0] || "New Receipt",
      amount: amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00",
      date: dateMatch ? dateMatch[0] : new Date().toLocaleDateString('en-GB')
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
