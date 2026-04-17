# PV Expense App - Setup Script
# Run this from inside your pv-expense-app folder

Write-Host "Creating folders..." -ForegroundColor Cyan
New-Item -Path "app\api\auth\[...nextauth]" -ItemType Directory -Force | Out-Null
New-Item -Path "app\api\gmail\search" -ItemType Directory -Force | Out-Null
New-Item -Path "app\api\gmail\message" -ItemType Directory -Force | Out-Null
New-Item -Path "app\api\voucher\generate" -ItemType Directory -Force | Out-Null

Write-Host "Creating auth route..." -ForegroundColor Cyan
@'
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
'@ | Set-Content "app\api\auth\[...nextauth]\route.js" -Encoding UTF8

Write-Host "Creating Gmail search route..." -ForegroundColor Cyan
@'
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "receipt OR invoice";

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const threadsRes = await gmail.users.threads.list({
    userId: "me",
    q,
    maxResults: 20,
    includeSpamTrash: true,
  });

  const threads = threadsRes.data.threads || [];
  const results = [];

  for (const thread of threads.slice(0, 15)) {
    const threadData = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const msg = threadData.data.messages?.[0];
    if (!msg) continue;

    const headers = msg.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "";
    const from    = headers.find(h => h.name === "From")?.value || "";
    const date    = headers.find(h => h.name === "Date")?.value || "";
    const snippet = msg.snippet || "";

    const amountMatch = snippet.match(/(?:SGD|S\$|MYR|IDR|THB|USD)\s?[\d,]+\.?\d*/i);
    const amount = amountMatch ? amountMatch[0] : null;

    let type = "other";
    if (from.includes("grab.com")) type = snippet.toLowerCase().includes("food") ? "grabfood" : "grab";
    if (from.includes("tada.global")) type = "tada";

    results.push({ id: msg.id, threadId: thread.id, subject, from, date, snippet, amount, type });
  }

  return Response.json({ results });
}
'@ | Set-Content "app\api\gmail\search\route.js" -Encoding UTF8

Write-Host "Creating Gmail message route..." -ForegroundColor Cyan
@'
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  if (!messageId) return Response.json({ error: "No message ID" }, { status: 400 });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const subject = headers.find(h => h.name === "Subject")?.value || "";
  const from    = headers.find(h => h.name === "From")?.value || "";
  const date    = headers.find(h => h.name === "Date")?.value || "";

  function decodeBody(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const text = decodeBody(part);
        if (text) return text;
      }
    }
    return "";
  }

  const body = decodeBody(msg.data.payload);
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const amountMatch = text.match(/(?:Total(?:\s+(?:Paid|Fee|Charged))?)\s*(?:SGD|S\$)?\s*([\d,]+\.?\d*)\s*(?:SGD)?/i);
  const bookingMatch = text.match(/(?:Booking\s+(?:ID|Code)|Booking\s+code)\s*[:\s]*([A-Z0-9\-]{8,})/i);

  return Response.json({
    subject, from, date,
    text: text.slice(0, 2000),
    amount: amountMatch ? amountMatch[1] : null,
    booking: bookingMatch ? bookingMatch[1] : null,
  });
}
'@ | Set-Content "app\api\gmail\message\route.js" -Encoding UTF8

Write-Host "Creating voucher PDF route..." -ForegroundColor Cyan
@'
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
'@ | Set-Content "app\api\voucher\generate\route.js" -Encoding UTF8

Write-Host "Creating app pages..." -ForegroundColor Cyan
@'
"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const INITIAL_ITEMS = [
  { no:1, date:"14 Apr 2026", desc:"Grab Car - Carpark Alley BEA Bldg to 338 East Coast Rd", ref:"A-97GM4LKGX2X7AV", orig:"SGD 30.50", sgd:30.50 },
  { no:2, date:"14 Apr 2026", desc:"Grab Car - 406 East Coast Rd to 29 Lor Melayu, Palmera East", ref:"A-97H7GBLGWLIQAV", orig:"SGD 8.10", sgd:8.10 },
  { no:3, date:"16 Apr 2026", desc:"TADA GO - BEA Bldg, 60 Robinson Rd to Bigmama Korean Restaurant", ref:"019d95b0-bb35", orig:"SGD 15.48", sgd:15.48 },
  { no:4, date:"16 Apr 2026", desc:"Grab Car - GrabCar Standard", ref:"A-97PV8OOGXBHGAV", orig:"SGD 20.50", sgd:20.50 },
];

export default function Home() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [tab, setTab] = useState("voucher");
  const [searchQ, setSearchQ] = useState("receipt OR invoice");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [manualForm, setManualForm] = useState({ date:"", desc:"", ref:"", sgd:"" });

  const total = items.reduce((s, it) => s + it.sgd, 0);

  function removeItem(i) {
    const next = items.filter((_,idx) => idx !== i).map((it,idx) => ({ ...it, no: idx+1 }));
    setItems(next);
  }

  function addManual() {
    const { date, desc, ref, sgd } = manualForm;
    if (!date || !desc || !sgd) return alert("Please fill in date, description and amount.");
    const d = new Date(date);
    const label = d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    setItems(prev => [...prev, { no: prev.length+1, date: label, desc, ref: ref||"-", orig:`SGD ${parseFloat(sgd).toFixed(2)}`, sgd: parseFloat(sgd) }]);
    setManualForm({ date:"", desc:"", ref:"", sgd:"" });
  }

  async function searchGmail() {
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(searchQ)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch(e) { alert("Search failed: " + e.message); }
    setSearching(false);
  }

  function addFromSearch(r) {
    const amtNum = r.amount ? parseFloat(r.amount.replace(/[^0-9.]/g,"")) : 0;
    const dateStr = new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    setItems(prev => [...prev, { no: prev.length+1, date: dateStr, desc: r.subject, ref: r.id.slice(0,16), orig: r.amount || "SGD 0.00", sgd: amtNum }]);
    setTab("voucher");
  }

  async function generatePDF() {
    setGenerating(true);
    try {
      const res = await fetch("/api/voucher/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, pvNumber: "PV4" }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Payment_Voucher_Ivan_Ong_PV4.pdf";
      a.click();
    } catch(e) { alert("PDF generation failed: " + e.message); }
    setGenerating(false);
  }

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400 text-sm">Loading...</div></div>;

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm w-full">
        <div className="text-2xl font-medium text-gray-900 mb-1">Payment Voucher</div>
        <div className="text-sm text-gray-400 mb-8">Redington ASEAN - Ivan Ong</div>
        <button onClick={() => signIn("google")} className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition">
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400 mt-4">Uses read-only Gmail access to find receipts</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-medium text-gray-900">Payment Voucher</h1>
            <p className="text-sm text-gray-400">Ivan Ong - Redington ASEAN</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">PV4</span>
            <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {["voucher","search"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab===t ? "bg-white border border-gray-200 text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
              {t === "voucher" ? "Voucher" : "Search Gmail"}
            </button>
          ))}
        </div>
        {tab === "voucher" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-24">Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400">Description</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-36">Reference</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400 w-20">SGD</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-3 py-2 text-gray-400 text-xs">{it.no}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{it.date}</td>
                      <td className="px-3 py-2 text-gray-800">{it.desc}</td>
                      <td className="px-3 py-2 text-gray-400 font-mono text-xs">{it.ref}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{it.sgd.toFixed(2)}</td>
                      <td className="px-2 py-2"><button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition text-xs">x</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800">
                    <td colSpan="4" className="px-3 py-2.5 text-right text-xs font-medium text-white">TOTAL SGD</td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-white tabular-nums">{total.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
              <div className="text-xs font-medium text-gray-400 mb-3">Add item manually</div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <input type="date" value={manualForm.date} onChange={e=>setManualForm(f=>({...f,date:e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <input type="text" placeholder="Description" value={manualForm.desc} onChange={e=>setManualForm(f=>({...f,desc:e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm col-span-2" />
                <input type="number" placeholder="SGD" value={manualForm.sgd} onChange={e=>setManualForm(f=>({...f,sgd:e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input type="text" placeholder="Reference (optional)" value={manualForm.ref} onChange={e=>setManualForm(f=>({...f,ref:e.target.value}))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm col-span-3" />
                <button onClick={addManual} className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-700 transition">Add</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">Running total</div>
                <div className="text-2xl font-medium text-gray-900">SGD {total.toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTab("search")} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition">Search Gmail</button>
                <button onClick={generatePDF} disabled={generating} className="bg-gray-900 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">{generating ? "Generating..." : "Download PDF"}</button>
              </div>
            </div>
          </>
        )}
        {tab === "search" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-400 mb-3">Search Gmail for receipts</div>
            <div className="flex gap-2 mb-4">
              <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter" && searchGmail()} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Grab, TADA, invoice..." />
              <button onClick={searchGmail} disabled={searching} className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">{searching ? "Searching..." : "Search"}</button>
            </div>
            {searchResults.length === 0 && !searching && <div className="text-center py-8 text-sm text-gray-400">Results will appear here</div>}
            <div className="divide-y divide-gray-50">
              {searchResults.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.subject}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.from}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.snippet}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {r.amount && <div className="text-sm font-medium">{r.amount}</div>}
                    {r.type !== "grabfood" && <button onClick={() => addFromSearch(r)} className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50 transition">+ Add</button>}
                    {r.type === "grabfood" && <span className="text-xs text-gray-300">excluded</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'@ | Set-Content "app\page.jsx" -Encoding UTF8

@'
import "./globals.css";
import { SessionProvider } from "./providers";

export const metadata = {
  title: "PV Expense App - Redington ASEAN",
  description: "Payment voucher generator for Ivan Ong",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
'@ | Set-Content "app\layout.jsx" -Encoding UTF8

@'
"use client";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
export function SessionProvider({ children }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
'@ | Set-Content "app\providers.jsx" -Encoding UTF8

@'
@tailwind base;
@tailwind components;
@tailwind utilities;
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
'@ | Set-Content "app\globals.css" -Encoding UTF8

Write-Host "Creating .env.local..." -ForegroundColor Cyan
@'
GOOGLE_CLIENT_ID=REPLACE_WITH_YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_YOUR_CLIENT_SECRET
NEXTAUTH_SECRET=ivanpvapp2026secret
NEXTAUTH_URL=https://cd-pv-expense-app.vercel.app
'@ | Set-Content ".env.local" -Encoding UTF8

Write-Host "Updating package.json..." -ForegroundColor Cyan
@'
{
  "name": "cd-pv-expense-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "next-auth": "^4.24.7",
    "react": "^18",
    "react-dom": "^18",
    "googleapis": "^140.0.0",
    "pdf-lib": "^1.17.1"
  },
  "devDependencies": {
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "postcss": "^8",
    "tailwindcss": "^3.3.0"
  }
}
'@ | Set-Content "package.json" -Encoding UTF8

Write-Host ""
Write-Host "All files created!" -ForegroundColor Green
Write-Host "Now run: npm install" -ForegroundColor Yellow
