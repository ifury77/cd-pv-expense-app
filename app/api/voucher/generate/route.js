import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60; // Allow 60 seconds for PDF generation

export async function POST(req) {
  try {
    const { items, pvNumber } = await req.json();
    if (!items || items.length === 0) throw new Error("No items provided");

    const totalSgd = items.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

    let htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; padding: 40px; font-size: 12px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f0f0f0; border: 1px solid #000; padding: 8px; text-align: center; }
          td { border: 1px solid #000; padding: 8px; }
          .page-break { page-break-before: always; }
          .receipt-title { background: #1a365d; color: white; padding: 10px; margin-bottom: 15px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><strong>PAY TO:</strong> Ivan Ong</div>
          <div style="text-align:right"><strong>Voucher:</strong> ${pvNumber || 'PV4'}<br/><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
        <h2 style="text-align:center">PAYMENT VOUCHER</h2>
        <table>
          <thead>
            <tr><th>No.</th><th>Date</th><th>Description</th><th>Ref</th><th>Amount</th><th>SGD</th></tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr>
                <td align="center">${i + 1}</td>
                <td>${item.date}</td>
                <td>${item.desc}</td>
                <td>${item.ref || '-'}</td>
                <td>${item.orig || '-'}</td>
                <td align="right">${(item.sgd || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tr style="background:#eee; font-weight:bold;">
            <td colspan="5" align="right">TOTAL SGD</td>
            <td align="right">${totalSgd.toFixed(2)}</td>
          </tr>
        </table>
        ${items.filter(item => item.receiptHtml).map((item, i) => `
          <div class="page-break"></div>
          <div class="receipt-title">ATTACHMENT #${i + 1} - ${item.desc}</div>
          <div>${item.receiptHtml}</div>
        `).join('')}
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return new NextResponse(pdfBuffer, {
      headers: { 
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=Payment_Voucher.pdf' 
      },
    });
  } catch (error) {
    console.error("PDF Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
