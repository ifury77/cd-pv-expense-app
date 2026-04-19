import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function POST(req) {
  try {
    const { items, pvNumber } = await req.json();
    const totalSgd = items.reduce((sum, row) => sum + row.sgd, 0);

    let htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: "Helvetica", Arial, sans-serif; padding: 30px; color: #333; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .logo { height: 35px; }
          .title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
          th { background: #f2f2f2; border: 1px solid #000; padding: 8px; text-align: center; text-transform: uppercase; }
          td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
          .total-row { background: #e0e0e0; font-weight: bold; }
          .page-break { page-break-before: always; }
          .attachment-header { background: #1a365d; color: white; padding: 10px; font-size: 12px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <p><strong>PAY TO:</strong> Ivan Ong</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Voucher No:</strong> ${pvNumber || 'PV4'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>
        <div class="title">PAYMENT VOUCHER</div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 15%;">Date</th>
              <th style="width: 35%;">Description</th>
              <th style="width: 20%;">Reference / Booking ID</th>
              <th style="width: 15%;">Orig. Amount</th>
              <th style="width: 10%;">SGD</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td>${item.date}</td>
                <td>${item.desc}</td>
                <td>${item.ref || '-'}</td>
                <td>${item.orig || '-'}</td>
                <td style="text-align: right; font-weight: bold;">${item.sgd.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5" style="text-align: right;">TOTAL CLAIMABLE AMOUNT (SGD)</td>
              <td style="text-align: right;">${totalSgd.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        ${items.filter(item => item.receiptHtml).map((item, i) => `
          <div class="page-break"></div>
          <div class="attachment-header">RECEIPT ATTACHMENT #${i + 1} - ${item.desc}</div>
          <div style="font-size: 10px;">${item.receiptHtml}</div>
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
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=PV_Ivan_Ong.pdf`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
