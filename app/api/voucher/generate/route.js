import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60; // Extend Vercel timeout to 60s

export async function POST(req) {
  let browser = null;
  try {
    const { items, pvNumber } = await req.json();
    const totalSgd = items.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

    const htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; padding: 30px; font-size: 11px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f2f2f2; border: 1px solid #000; padding: 8px; text-transform: uppercase; font-size: 9px; }
          td { border: 1px solid #000; padding: 8px; vertical-align: top; }
          .total-row { background: #eee; font-weight: bold; }
          .page-break { page-break-before: always; }
          .attachment-label { background: #1a365d; color: white; padding: 10px; margin-bottom: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><strong>PAY TO:</strong> Ivan Ong</div>
          <div style="text-align:right"><strong>Voucher:</strong> ${pvNumber || 'PV4'}<br/><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
        </div>
        <h2 style="text-align:center; text-decoration: underline;">PAYMENT VOUCHER</h2>
        <table>
          <thead>
            <tr>
              <th width="5%">No.</th>
              <th width="15%">Date</th>
              <th width="40%">Description</th>
              <th width="15%">Ref</th>
              <th width="15%">Orig. Amt</th>
              <th width="10%">SGD</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr>
                <td align="center">${i + 1}</td>
                <td>${item.date}</td>
                <td>${item.desc}</td>
                <td style="word-break: break-all;">${item.ref || '-'}</td>
                <td>${item.orig || '-'}</td>
                <td align="right"><strong>${(item.sgd || 0).toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
          <tr class="total-row">
            <td colspan="5" align="right">TOTAL CLAIMABLE AMOUNT (SGD)</td>
            <td align="right">${totalSgd.toFixed(2)}</td>
          </tr>
        </table>

        ${items.filter(item => item.receiptHtml).map((item, i) => `
          <div class="page-break"></div>
          <div class="attachment-label">RECEIPT ATTACHMENT #${i + 1} - ${item.desc}</div>
          <div style="zoom: 0.8;">${item.receiptHtml}</div>
        `).join('')}
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Payment_Voucher_Ivan_Ong.pdf`,
      },
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF Generator Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
