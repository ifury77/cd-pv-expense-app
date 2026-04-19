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
          body { font-family: "Helvetica", Arial, sans-serif; padding: 30px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
          th { background: #f2f2f2; border: 1px solid #000; padding: 8px; text-transform: uppercase; }
          td { border: 1px solid #000; padding: 8px; }
          .total-row { background: #e0e0e0; font-weight: bold; }
          .page-break { page-break-before: always; }
          .attachment-header { background: #1a365d; color: white; padding: 10px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><p><strong>PAY TO:</strong> Ivan Ong</p></div>
          <div style="text-align: right;">
            <p><strong>Voucher No:</strong> ${pvNumber || 'PV4'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>
        <div class="title">PAYMENT VOUCHER</div>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th>Orig. Amount</th>
              <th>SGD</th>
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
                <td style="text-align: right;">${item.sgd.toFixed(2)}</td>
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
          <div class="attachment-header">RECEIPT ATTACHMENT #${i + 1}</div>
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
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=PV_Ivan_Ong.pdf` }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
