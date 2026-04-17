import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const maxDuration = 60;

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
  const cents = Math.round((amount - dollars) * 100);
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

  // ── PAGE 1: Voucher ──────────────────────────────────────────────
  const page = pdfDoc.addPage([A4W, A4H]);
  const navy  = rgb(0.12, 0.30, 0.47);
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);
  const light = rgb(0.92, 0.95, 0.98);
  const gray  = rgb(0.6, 0.6, 0.6);
  let y = A4H - MT;

  page.drawText("PAYMENT VOUCHER", { x: A4W/2 - 70, y: y - 14, size: 14, font: fontB, color: navy });
  page.drawText(`Voucher No: ${pvNumber}`, { x: A4W - MR - 110, y: y - 12, size: 8, font: fontR, color: black });
  const today = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  page.drawText(`Date: ${today}`, { x: A4W - MR - 110, y: y - 22, size: 8, font: fontR, color: black });
  y -= 32;
  page.drawText("Payee: Ivan Ong", { x: ML, y, size: 9, font: fontR, color: black });
  page.drawLine({ start:{x: ML+52, y: y-1}, end:{x: A4W-MR, y: y-1}, thickness:0.5, color: gray });
  y -= 18;

  const cols = [
    { label:"No.",         x: ML,      w: 18  },
    { label:"Date",        x: ML+18,   w: 52  },
    { label:"Description", x: ML+70,   w: 218 },
    { label:"Reference",   x: ML+288,  w: 95  },
    { label:"Orig Amt",    x: ML+383,  w: 60  },
    { label:"SGD",         x: ML+443,  w: 50  },
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
    page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, borderColor: rgb(0.74,0.84,0.93), borderWidth: 0.3 });
    const vals = [
      { text: String(item.no),                       col: cols[0], align: "center" },
      { text: item.date,                              col: cols[1], align: "left"   },
      { text: (item.desc||"").slice(0,52),            col: cols[2], align: "left"   },
      { text: (item.ref||"").slice(0,18),             col: cols[3], align: "left"   },
      { text: item.orig || `SGD ${item.sgd.toFixed(2)}`, col: cols[4], align: "right" },
      { text: item.sgd.toFixed(2),                   col: cols[5], align: "right"  },
    ];
    vals.forEach(({ text, col, align }) => {
      let tx = col.x + 2;
      if (align === "right")  tx = col.x + col.w - fontR.widthOfTextAtSize(text, 6.5) - 2;
      if (align === "center") tx = col.x + (col.w - fontR.widthOfTextAtSize(text, 6.5)) / 2;
      page.drawText(text, { x: tx, y: y - rowH + 6, size: 6.5, font: fontR, color: black });
    });
  });

  const blanks = Math.max(0, 10 - items.length);
  for (let i = 0; i < blanks; i++) {
    y -= rowH;
    const bg = (items.length + i) % 2 === 0 ? light : white;
    page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, color: bg });
    page.drawRectangle({ x: ML, y: y - rowH, width: A4W-ML-MR, height: rowH, borderColor: rgb(0.74,0.84,0.93), borderWidth: 0.3 });
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

  // ── RECEIPT PAGES ────────────────────────────────────────────────
  for (const item of items) {
    const rPage = pdfDoc.addPage([A4W, A4H]);

    // Navy header bar
    rPage.drawRectangle({ x: 0, y: A4H - 32, width: A4W, height: 32, color: navy });
    rPage.drawText(`Receipt #${item.no}  |  ${pvNumber}  |  ${today}`, { x: ML, y: A4H - 14, size: 9, font: fontB, color: white });
    rPage.drawText(item.desc.slice(0, 80), { x: ML, y: A4H - 26, size: 7, font: fontR, color: rgb(0.7, 0.85, 1) });

    if (item.receiptImage) {
      // ── Uploaded image receipt ──
      const [header, b64] = item.receiptImage.split(",");
      const isJpeg = header.includes("jpeg") || header.includes("jpg");
      const isPng  = header.includes("png");
      if (b64 && (isJpeg || isPng)) {
        const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        let embeddedImg;
        try {
          embeddedImg = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
        } catch(e) {
          try { embeddedImg = isJpeg ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes); } catch(e2) {}
        }
        if (embeddedImg) {
          const availW = A4W - ML - MR;
          const availH = A4H - 32 - 30 - 20;
          const imgDims = embeddedImg.scaleToFit(availW, availH);
          const imgX = (A4W - imgDims.width) / 2;
          const imgY = (A4H - 32 - 20 - imgDims.height) / 2;
          rPage.drawImage(embeddedImg, { x: imgX, y: imgY, width: imgDims.width, height: imgDims.height });
        }
      }
      rPage.drawText(`Source: ${item.receiptSource || "uploaded file"}`, { x: ML, y: 12, size: 6.5, font: fontR, color: gray });
    } else if (item.receiptHtml) {
      // ── Gmail HTML receipt — render key fields extracted from HTML ──
      const isGrab = item.desc.toLowerCase().includes("grab");
      const isTada = item.desc.toLowerCase().includes("tada");
      const accentColor = isTada ? rgb(0.05, 0.18, 0.24) : isGrab ? rgb(0, 0.69, 0.31) : navy;

      // Strip HTML tags and extract readable text
      const rawText = item.receiptHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "
")
        .replace(/<\/(?:div|p|tr|li|h[1-6])[^>]*>/gi, "
")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&copy;/g, "©")
        .replace(/[ 	]+/g, " ")
        .split("
").map(l => l.trim()).filter(l => l.length > 2)
        .slice(0, 40)
        .join("
");

      // Brand bar
      rPage.drawRectangle({ x: ML, y: 60, width: 4, height: A4H - 32 - 80, color: accentColor });

      // Draw extracted text content
      let ry = A4H - 55;
      const lines = rawText.split("
").slice(0, 35);
      for (const line of lines) {
        if (ry < 40) break;
        const isAmount = /\d+\.\d{2}/.test(line) && (line.toLowerCase().includes("total") || line.toLowerCase().includes("paid") || line.toLowerCase().includes("sgd"));
        const isLabel  = line.length < 40 && !line.includes(" ") === false && line === line.toUpperCase();
        const fSize    = isAmount ? 10 : 8;
        const fFont    = isAmount ? fontB : fontR;
        const fColor   = isAmount ? black : isLabel ? gray : black;
        // Truncate long lines
        const maxW     = A4W - ML - MR - 20;
        let display    = line;
        while (display.length > 1 && fontR.widthOfTextAtSize(display, fSize) > maxW) {
          display = display.slice(0, -1);
        }
        rPage.drawText(display, { x: ML + 12, y: ry, size: fSize, font: fFont, color: fColor });
        ry -= fSize + 5;
      }

      rPage.drawText(`Gmail receipt — ${item.receiptSource || "sgp69k@gmail.com"} — ${pvNumber}`, { x: ML, y: 12, size: 6.5, font: fontR, color: gray });

    } else {
      // ── Manual entry receipt — styled summary card ──
      const accentColor = navy;
      rPage.drawRectangle({ x: ML, y: 60, width: 4, height: A4H - 32 - 80, color: accentColor });

      let ry = A4H - 60;
      const fields = [
        ["Date",           item.date],
        ["Description",    item.desc],
        ["Reference",      item.ref || "—"],
        ["Amount",         item.orig || `SGD ${item.sgd.toFixed(2)}`],
        ["SGD Equivalent", `SGD ${item.sgd.toFixed(2)}`],
      ];

      for (const [label, value] of fields) {
        rPage.drawText(label, { x: ML + 10, y: ry, size: 7.5, font: fontB, color: gray });
        const maxChars = 80;
        const lines = [];
        let remaining = String(value);
        while (remaining.length > 0) { lines.push(remaining.slice(0, maxChars)); remaining = remaining.slice(maxChars); }
        for (let li = 0; li < lines.length; li++) {
          rPage.drawText(lines[li], { x: ML + 10, y: ry - 13 - (li * 12), size: 10, font: li === 0 ? fontB : fontR, color: black });
        }
        const fieldH = 13 + (lines.length * 12) + 10;
        rPage.drawLine({ start:{x: ML+10, y: ry - fieldH}, end:{x: A4W-MR, y: ry - fieldH}, thickness: 0.3, color: rgb(0.88,0.88,0.88) });
        ry -= fieldH + 4;
      }
      rPage.drawText(`Manual entry — ${pvNumber}`, { x: ML, y: 12, size: 6.5, font: fontR, color: gray });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payment_Voucher_Ivan_Ong_${pvNumber}.pdf"`,
    },
  });
}
