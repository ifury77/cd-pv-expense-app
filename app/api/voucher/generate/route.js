import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function amountInWords(amount) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function say(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
    return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + say(n%100) : "");
  }
  const dollars = Math.floor(amount);
  const cents   = Math.round((amount - dollars) * 100);
  let words = say(dollars) + " Dollar" + (dollars !== 1 ? "s" : "");
  if (cents) words += " and " + say(cents) + " Cent" + (cents !== 1 ? "s" : "");
  return "Singapore " + words + " Only";
}

export async function POST(req) {
  const { items, pvNumber = "PV4" } = await req.json();
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const A4W = 595.28, A4H = 841.89;
  const ML = 20, MR = 20, MT = 20;
  const page = pdfDoc.addPage([A4W, A4H]);
  const navy  = rgb(0.12, 0.30, 0.47);
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);
  const light = rgb(0.92, 0.95, 0.98);
  const gray  = rgb(0.6, 0.6, 0.6);
  let y = A4H - MT;
  page.drawText("PAYMENT VOUCHER", { x: A4W/2 - 70, y: y - 14, size: 14, font: fontB, color: navy });
  page.drawText(`Voucher No: ${pvNumber}`, { x: A4W - MR - 100, y: y - 12, size: 8, font: fontR, color: black });
  const today = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  page.drawText(`Date: ${today}`, { x: A4W - MR - 100, y: y - 22, size: 8, font: fontR, color: black });
  y -= 32;
  page.drawText("Payee: Ivan Ong", { x: ML, y, size: 9, font: fontR, color: black });
  page.drawLine({ start:{x: ML+52, y: y-1}, end:{x: A4W-MR, y: y-1}, thickness:0.5, color: gray });
  y -= 18;
  const cols = [
    { label:"No.",       x: ML,       w: 18  },
    { label:"Date",      x: ML+18,    w: 52  },
    { label:"Description", x: ML+70,  w: 218 },
    { label:"Reference", x: ML+288,   w: 95  },
    { label:"Orig Amt",  x: ML+383,   w: 60  },
    { label:"SGD",       x: ML+443,   w: 50  },
  ];
  const rowH = 18;
  page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, color: navy });
  cols.forEach(col => {
    page.drawText(col.label, { x: col.x + 2, y: y - rowH + 5, size: 7, font: fontB, color: white });
  });
  const total = items.reduce((s, it) => s + it.sgd, 0);
  items.forEach((item, i) => {
    y -= rowH;
    const bg = i % 2 === 0 ? light : white;
    page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, color: bg });
    const vals = [
      { text: String(item.no),   col: cols[0], align: "center" },
      { text: item.date,         col: cols[1], align: "left"   },
      { text: item.desc.slice(0,52), col: cols[2], align: "left" },
      { text: item.ref.slice(0,18),  col: cols[3], align: "left" },
      { text: item.orig || `SGD ${item.sgd.toFixed(2)}`, col: cols[4], align: "right" },
      { text: item.sgd.toFixed(2),   col: cols[5], align: "right" },
    ];
    vals.forEach(({ text, col, align }) => {
      let tx = col.x + 2;
      if (align === "right") tx = col.x + col.w - fontR.widthOfTextAtSize(text, 6.5) - 2;
      if (align === "center") tx = col.x + (col.w - fontR.widthOfTextAtSize(text, 6.5)) / 2;
      page.drawText(text, { x: tx, y: y - rowH + 6, size: 6.5, font: fontR, color: black });
    });
  });
  const blanks = Math.max(0, 10 - items.length);
  for (let i = 0; i < blanks; i++) {
    y -= rowH;
    const bg = (items.length + i) % 2 === 0 ? light : white;
    page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, color: bg });
  }
  y -= rowH;
  page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, color: navy });
  page.drawText("TOTAL SGD", { x: cols[4].x + 2, y: y - rowH + 6, size: 7, font: fontB, color: white });
  const totalStr = total.toFixed(2);
  page.drawText(totalStr, { x: cols[5].x + cols[5].w - fontB.widthOfTextAtSize(totalStr, 7) - 2, y: y - rowH + 6, size: 7, font: fontB, color: white });
  y -= rowH + 10;
  page.drawText(`Amount in Words: ${amountInWords(total)}`, { x: ML, y, size: 7.5, font: fontB, color: black });
  y -= 14;
  page.drawText("Payment Mode:   Cash  /  Cheque No. ____________________________", { x: ML, y, size: 8, font: fontR, color: black });
  y -= 28;
  page.drawLine({ start:{x: ML, y}, end:{x: ML+140, y}, thickness:0.5, color: black });
  page.drawLine({ start:{x: A4W/2, y}, end:{x: A4W/2+140, y}, thickness:0.5, color: black });
  y -= 8;
  page.drawText("Prepared by / Claimant", { x: ML, y, size: 7, font: fontR, color: gray });
  page.drawText("Approved by", { x: A4W/2, y, size: 7, font: fontR, color: gray });
  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payment_Voucher_Ivan_Ong_${pvNumber}.pdf"`,
    },
  });
}
