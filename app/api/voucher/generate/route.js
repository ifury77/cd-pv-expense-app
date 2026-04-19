import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req) {
  const { items, pvNumber } = await req.json();
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Corporate Header
  page.drawText('REDINGTON ASEAN - PAYMENT VOUCHER', { x: 50, y: 750, size: 16, font: boldFont });
  page.drawText(`Voucher No: ${pvNumber || 'PV-001'}`, { x: 50, y: 730, size: 10, font });
  page.drawText(`Claimant: Ivan Ong`, { x: 50, y: 715, size: 10, font });

  // Table Headers
  const tableTop = 680;
  page.drawRectangle({ x: 50, y: tableTop - 5, width: 500, height: 20, color: rgb(0.9, 0.9, 0.9) });
  page.drawText('Date', { x: 55, y: tableTop, size: 10, font: boldFont });
  page.drawText('Description', { x: 130, y: tableTop, size: 10, font: boldFont });
  page.drawText('Amount (SGD)', { x: 480, y: tableTop, size: 10, font: boldFont });

  // Draw Items
  let currentY = tableTop - 25;
  let total = 0;
  items.forEach((item) => {
    page.drawText(item.date || '', { x: 55, y: currentY, size: 9, font });
    page.drawText(item.desc.substring(0, 60) || '', { x: 130, y: currentY, size: 9, font });
    page.drawText(item.sgd.toFixed(2), { x: 500, y: currentY, size: 9, font });
    total += item.sgd;
    currentY -= 20;
  });

  // Total Section
  page.drawLine({ start: { x: 50, y: currentY + 5 }, end: { x: 550, y: currentY + 5 } });
  page.drawText('TOTAL CLAIM:', { x: 400, y: currentY - 15, size: 11, font: boldFont });
  page.drawText(`SGD ${total.toFixed(2)}`, { x: 480, y: currentY - 15, size: 11, font: boldFont });

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } });
}
