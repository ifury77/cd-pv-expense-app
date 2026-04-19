import { ImageAnnotatorClient } from '@google-cloud/vision';
import { NextResponse } from 'next/server';

const client = new ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
});

export async function POST(req) {
  try {
    const { image } = await req.json();
    const buffer = Buffer.from(image.split(',')[1], 'base64');
    const [result] = await client.textDetection(buffer);
    const text = result.fullTextAnnotation?.text || "";

    // Specific logic for Singapore Receipts
    const lines = text.split('\n');
    const amountRegex = /(?:TOTAL|NET|AMT|PAYABLE|SGD|S\$)\s?[:]*\s?\$?\s?([\d,]+\.\d{2})/i;
    const amountMatch = text.match(amountRegex);
    
    // Date logic: DD/MM/YYYY or DD MMM YYYY
    const dateMatch = text.match(/\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}/i) || 
                      text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);

    return NextResponse.json({
      desc: lines[0]?.substring(0, 30) || "Scanned Receipt",
      amount: amountMatch ? amountMatch[1].replace(/,/g, '') : "0.00",
      date: dateMatch ? dateMatch[0] : new Date().toLocaleDateString('en-GB')
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
