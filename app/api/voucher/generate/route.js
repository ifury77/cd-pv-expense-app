import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

export const maxDuration = 60; // Allow 1 minute for PDF generation

export async function POST(req) {
  let browser = null;
  try {
    const { items, pvNumber } = await req.json();
    const totalSgd = items.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

    const isProd = process.env.NODE_ENV === 'production';
    
    browser = await puppeteer.launch({
      args: isProd ? [...chromium.args, '--no-sandbox'] : ['--no-sandbox'],
      executablePath: isProd 
        ? await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar')
        : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Standard Windows Path
      headless: true,
    });

    const page = await browser.newPage();
    const htmlContent = `
      <html>
        <style>
          body { font-family: sans-serif; padding: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #009640; padding-bottom: 10px; margin-bottom: 20px; }
          .logo { color: #009640; font-weight: 900; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1a202c; color: white; padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 12px; font-size: 11px; }
          .total { background: #f8fafc; font-weight: bold; }
        </style>
        <body>
          <div class="header">
            <div class="logo">REDINGTON</div>
            <div style="text-align:right; font-size: 10px;">
              <strong>Voucher:</strong> ${pvNumber}<br>
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
          <h2 style="text-align:center; font-size: 18px;">PAYMENT VOUCHER</h2>
          <table>
            <thead>
              <tr><th>Description & Activity</th><th align="right">Amount (SGD)</th></tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>
                    <strong>${item.desc}</strong><br/>
                    <i style="color:#666">${item.activity || ''}</i>
                  </td>
                  <td align="right">S$ ${item.sgd.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td align="right">TOTAL PAYABLE</td>
                <td align="right">S$ ${totalSgd.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    
    await browser.close();

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Voucher_${pvNumber}.pdf`
      }
    });
  } catch (e) {
    if (browser) await browser.close();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
