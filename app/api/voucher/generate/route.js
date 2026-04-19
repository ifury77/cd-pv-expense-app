import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function POST(req) {
  let browser = null;
  try {
    const { items, pvNumber } = await req.json();
    const totalSgd = items.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

    const htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
          .logo-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .logo { height: 40px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f2f2f2; border: 1px solid #000; padding: 10px; }
          td { border: 1px solid #000; padding: 10px; }
          .activity { color: #555; font-size: 10px; margin-top: 4px; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <img src="https://redington.com/wp-content/themes/redington/images/logo.png" class="logo">
          <div style="text-align:right"><strong>Voucher No:</strong> ${pvNumber}<br><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
        <h2 style="text-align:center">PAYMENT VOUCHER</h2>
        <table>
          <thead>
            <tr><th>No.</th><th>Date</th><th>Description & Activity</th><th>Amount (SGD)</th></tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr>
                <td align="center">${i + 1}</td>
                <td>${item.date}</td>
                <td>
                  <strong>${item.desc}</strong>
                  <div class="activity">${item.activity || ''}</div>
                </td>
                <td align="right">${item.sgd.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tr style="font-weight:bold; background:#eee">
            <td colspan="3" align="right">TOTAL PAYABLE</td>
            <td align="right">S$ ${totalSgd.toFixed(2)}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf' } });
  } catch (e) {
    if (browser) await browser.close();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
