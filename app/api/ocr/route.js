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

    // Find the highest price-looking number
    const priceRegex = /\d{1,6}\.\d{2}/g;
    const allPrices = text.match(priceRegex);
    let detectedAmount = "0.00";
    if (allPrices) {
      const numericPrices = allPrices.map(p => parseFloat(p.replace(/,/g, '')));
      detectedAmount = Math.max(...numericPrices).toFixed(2);
    }

    const merchantName = lines[0] ? lines[0].substring(0, 30).trim() : "Scanned Receipt";
    const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/) || 
                      text.match(/\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}/i);

    return NextResponse.json({
      desc: merchantName,
      amount: detectedAmount,
      date: dateMatch ? dateMatch[0] : new Date().toLocaleDateString('en-GB')
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
