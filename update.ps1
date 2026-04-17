# PV Expense App - Master Update Script
# Run from inside your pv-expense-app folder
# Usage: .\update.ps1

Write-Host "PV Expense App - Updating all files..." -ForegroundColor Cyan

# Create all folders
$folders = @(
    "app\api\auth\[...nextauth]",
    "app\api\gmail\search",
    "app\api\gmail\message",
    "app\api\receipt\extract",
    "app\api\voucher\generate"
)
foreach ($f in $folders) {
    New-Item -Path $f -ItemType Directory -Force | Out-Null
}
Write-Host "Folders ready" -ForegroundColor Green

Write-Host "Writing app/page.jsx..." -ForegroundColor Gray
@'
"use client";
import { useState, useRef } from "react";

// Compress image before sending to API
async function compressImage(dataUrl, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}
import { useSession, signIn, signOut } from "next-auth/react";

const INITIAL_ITEMS = [
  { no:1, date:"14 Apr 2026", desc:"Grab Car – Carpark Alley BEA Bldg to 338 East Coast Rd", ref:"A-97GM4LKGX2X7AV", orig:"SGD 30.50", sgd:30.50, receiptSource:"gmail" },
  { no:2, date:"14 Apr 2026", desc:"Grab Car – 406 East Coast Rd to 29 Lor Melayu, Palmera East", ref:"A-97H7GBLGWLIQAV", orig:"SGD 8.10", sgd:8.10, receiptSource:"gmail" },
  { no:3, date:"16 Apr 2026", desc:"TADA GO – BEA Bldg, 60 Robinson Rd to Bigmama Korean Restaurant", ref:"019d95b0-bb35", orig:"SGD 15.48", sgd:15.48, receiptSource:"gmail" },
  { no:4, date:"16 Apr 2026", desc:"Grab Car – GrabCar Standard", ref:"A-97PV8OOGXBHGAV", orig:"SGD 20.50", sgd:20.50, receiptSource:"gmail" },
];

export default function Home() {
  const { data: session, status } = useSession();
  const [items, setItems]         = useState(INITIAL_ITEMS);
  const [tab, setTab]             = useState("voucher");
  const [searchQ, setSearchQ]     = useState("receipt OR invoice");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef   = useRef(null);
  const attachInputRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);

  // Add receipt form
  const [addForm, setAddForm] = useState({ date:"", desc:"", ref:"", sgd:"", orig:"", currency:"SGD", image:null, imagePreview:null, rateNote:null });
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");

  const total = items.reduce((s, it) => s + it.sgd, 0);

  function removeItem(i) {
    setItems(prev => prev.filter((_,idx) => idx !== i).map((it,idx) => ({ ...it, no: idx+1 })));
  }

  // ── Auto-extract from image ──────────────────────────────────────
  async function extractFromImage(dataUrl, mediaType) {
    setExtracting(true);
    setExtractMsg("Reading receipt with AI...");
    try {
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("/api/receipt/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Extraction failed");
      const d = json.data;
      setAddForm(f => ({
        ...f,
        date:     d.date     || f.date,
        desc:     d.description || d.merchant || f.desc,
        ref:      d.reference || f.ref,
        sgd:      d.sgd_amount || f.sgd,
        orig:     d.orig_amount_str || (d.currency && d.amount ? `${d.currency} ${d.amount}` : f.orig),
        currency: d.currency || f.currency,
        rateNote: d.rate_note || null,
      }));
      setExtractMsg("✓ Receipt details extracted — please review and confirm");
    } catch(e) {
      setExtractMsg("Could not auto-extract — please fill in manually");
    }
    setExtracting(false);
  }

  // ── Handle file selection for new receipt ─────────────────────────
  function handleNewReceiptFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const mediaType = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setAddForm(f => ({ ...f, image: dataUrl, imagePreview: dataUrl }));
      extractFromImage(dataUrl, mediaType);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Handle attach image to existing item ──────────────────────────
  function handleAttachFile(e) {
    const file = e.target.files[0];
    if (!file || uploadingFor === null) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, 1200, 0.75);
      setItems(prev => prev.map((it, i) => i === uploadingFor
        ? { ...it, receiptImage: compressed, receiptSource: file.name }
        : it
      ));
      setUploadingFor(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function triggerAttach(i) {
    setUploadingFor(i);
    attachInputRef.current.click();
  }

  function addWithReceipt() {
    const { date, desc, sgd, ref, orig, currency, image } = addForm;
    if (!date || !desc || !sgd) return alert("Please fill in date, description and amount.");
    const sgdNum = parseFloat(sgd);
    setItems(prev => [...prev, {
      no: prev.length + 1,
      date,
      desc,
      ref: ref || "—",
      orig: orig || `${currency} ${sgdNum.toFixed(2)}`,
      sgd: sgdNum,
      receiptImage: image || null,
      receiptSource: "uploaded",
    }]);
    setAddForm({ date:"", desc:"", ref:"", sgd:"", orig:"", currency:"SGD", image:null, imagePreview:null, rateNote:null });
    setExtractMsg("");
    setTab("voucher");
  }

  // ── Gmail search ──────────────────────────────────────────────────
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

  async function addFromSearch(r) {
    const amtNum = r.amount ? parseFloat(r.amount.replace(/[^0-9.]/g,"")) : 0;
    const dateStr = r.date ? new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "";

    // Fetch full Gmail HTML body for receipt screenshot
    let receiptHtml = null;
    try {
      const res = await fetch(`/api/gmail/message?id=${r.id}`);
      const data = await res.json();
      if (data.html) receiptHtml = data.html;
    } catch(e) {}

    setItems(prev => [...prev, {
      no: prev.length+1, date: dateStr, desc: r.subject,
      ref: r.id.slice(0,16), orig: r.amount || "SGD 0.00", sgd: amtNum,
      receiptSource: "gmail", receiptHtml,
    }]);
    setTab("voucher");
  }

  // ── Generate PDF ──────────────────────────────────────────────────
  async function generatePDF() {
    setGenerating(true);
    try {
      // Compress receipt images before sending to avoid payload size limits
      const itemsWithCompressed = await Promise.all(items.map(async (it) => {
        if (!it.receiptImage) return it;
        const compressed = await compressImage(it.receiptImage, 1200, 0.75);
        return { ...it, receiptImage: compressed };
      }));
      // receiptHtml is already included in items state
      const res = await fetch("/api/voucher/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsWithCompressed, pvNumber: "PV4" }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Payment_Voucher_Ivan_Ong_PV4.pdf"; a.click();
    } catch(e) { alert("PDF generation failed: " + e.message); }
    setGenerating(false);
  }

  // ── Auth screens ──────────────────────────────────────────────────
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm w-full">
        <img src="/redington-logo.png" alt="Redington" className="h-10 mx-auto mb-6" />
        <div className="text-xl font-medium text-gray-900 mb-1">Payment Voucher</div>
        <div className="text-sm text-gray-400 mb-8">Ivan Ong – Redington ASEAN</div>
        <button onClick={() => signIn("google")} className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400 mt-4">Read-only Gmail access</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden file inputs */}
      <input ref={fileInputRef}   type="file" accept="image/*" capture="environment" onChange={handleNewReceiptFile} className="hidden" />
      <input ref={attachInputRef} type="file" accept="image/*" capture="environment" onChange={handleAttachFile}    className="hidden" />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <img src="/redington-logo.png" alt="Redington" className="h-8 mb-1" />
            <h1 className="text-lg font-medium text-gray-900">Payment Voucher</h1>
            <p className="text-sm text-gray-400">Ivan Ong – Redington ASEAN</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">PV4</span>
            <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {["voucher","add","search"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab===t ? "bg-white border border-gray-200 text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
              {t === "voucher" ? "Voucher" : t === "add" ? "+ Add Receipt" : "Search Gmail"}
            </button>
          ))}
        </div>

        {/* ── VOUCHER TAB ─────────────────────────────────────────── */}
        {tab === "voucher" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              {/* Desktop table - hidden on mobile */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-8">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-24">Date</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400">Description</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 w-32">Reference</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400 w-20">SGD</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-400 w-20">Receipt</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="px-3 py-2 text-gray-400 text-xs">{it.no}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{it.date}</td>
                        <td className="px-3 py-2 text-gray-800 text-sm">{it.desc}</td>
                        <td className="px-3 py-2 text-gray-400 font-mono text-xs">{it.ref}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{it.sgd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          {it.receiptImage ? (
                            <div className="flex items-center justify-center gap-1">
                              <img src={it.receiptImage} alt="receipt" className="w-8 h-8 object-cover rounded border border-gray-200" />
                              <div className="relative text-xs text-gray-400 hover:text-blue-500 cursor-pointer overflow-hidden" title="Replace">
                                ↺
                                <input type="file" accept="image/*" onChange={(e) => { setUploadingFor(i); handleAttachFile(e); }}
                                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                              </div>
                            </div>
                          ) : (
                            <div className="relative text-xs border border-dashed border-gray-300 rounded px-2 py-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition cursor-pointer overflow-hidden">
                              + photo
                              <input type="file" accept="image/*" onChange={(e) => { setUploadingFor(i); handleAttachFile(e); }}
                                style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800">
                      <td colSpan="5" className="px-3 py-2.5 text-right text-xs font-medium text-white">TOTAL SGD</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium text-white tabular-nums">{total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards - shown only on small screens */}
              <div className="md:hidden divide-y divide-gray-50">
                {items.map((it, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xs text-gray-400 mt-0.5 w-4 flex-shrink-0">{it.no}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 leading-snug">{it.desc}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">{it.date}</span>
                            {it.ref && it.ref !== "—" && (
                              <span className="text-xs text-gray-400 font-mono truncate max-w-32">{it.ref}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-base font-semibold text-gray-900">SGD {it.sgd.toFixed(2)}</span>
                            {it.orig && it.orig !== `SGD ${it.sgd.toFixed(2)}` && (
                              <span className="text-xs text-gray-400">({it.orig})</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {it.receiptImage ? (
                          <div className="relative overflow-hidden rounded border border-gray-200">
                            <img src={it.receiptImage} alt="receipt" className="w-10 h-10 object-cover" />
                            <input type="file" accept="image/*" onChange={(e) => { setUploadingFor(i); handleAttachFile(e); }}
                              style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                          </div>
                        ) : (
                          <div className="relative overflow-hidden border border-dashed border-gray-300 rounded px-2 py-1.5 text-gray-400 cursor-pointer">
                            <span className="text-xs">📎</span>
                            <input type="file" accept="image/*" onChange={(e) => { setUploadingFor(i); handleAttachFile(e); }}
                              style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                          </div>
                        )}
                        <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition p-1">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-slate-800 px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-medium text-white">TOTAL SGD</span>
                  <span className="text-base font-semibold text-white tabular-nums">{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs text-gray-400">Running total</div>
                <div className="text-2xl font-medium text-gray-900">SGD {total.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">{items.filter(i=>i.receiptImage).length}/{items.length} receipts attached</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
                <button onClick={() => setTab("search")} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition text-center">Search Gmail</button>
                <button onClick={() => setTab("add")} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition text-center">+ Add Receipt</button>
                <button onClick={generatePDF} disabled={generating} className="col-span-2 sm:col-span-1 bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50 text-center">
                  {generating ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── ADD RECEIPT TAB ─────────────────────────────────────── */}
        {tab === "add" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-4">Add new receipt</div>

            {/* Image upload — triggers AI extraction */}
            {addForm.imagePreview ? (
              <div className="border-2 border-gray-200 rounded-xl p-4 text-center mb-4">
                <img src={addForm.imagePreview} alt="preview" className="max-h-48 rounded-lg object-contain mx-auto mb-2" />
                <div className="flex gap-2 justify-center">
                  <div className="relative text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer overflow-hidden">
                    📷 Camera
                    <input type="file" accept="image/*" capture="environment" onChange={handleNewReceiptFile}
                      style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                  </div>
                  <div className="relative text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer overflow-hidden">
                    🖼️ Library
                    <input type="file" accept="image/*" onChange={handleNewReceiptFile}
                      style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2 text-center">AI will automatically read and fill in the receipt details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer overflow-hidden">
                    <span className="text-3xl">📷</span>
                    <span className="text-sm font-medium text-gray-700">Camera</span>
                    <span className="text-xs text-gray-400">Take new photo</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleNewReceiptFile}
                      style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                  </div>
                  <div className="relative flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer overflow-hidden">
                    <span className="text-3xl">🖼️</span>
                    <span className="text-sm font-medium text-gray-700">Photo Library</span>
                    <span className="text-xs text-gray-400">Choose existing</span>
                    <input type="file" accept="image/*" onChange={handleNewReceiptFile}
                      style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}} />
                  </div>
                </div>
              </div>
            )}

            {/* Extraction status */}
            {extracting && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-4 bg-blue-50 rounded-xl px-4 py-3">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {extractMsg}
              </div>
            )}
            {!extracting && extractMsg && (
              <div className={`text-sm mb-4 rounded-xl px-4 py-3 ${extractMsg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                {extractMsg}
              </div>
            )}

            {/* Exchange rate note */}
            {addForm.rateNote && (
              <div className="text-xs bg-amber-50 text-amber-700 rounded-xl px-4 py-2 mb-3 flex items-center gap-2">
                <span>💱</span> {addForm.rateNote}
              </div>
            )}

            {/* Form fields — auto-filled after extraction */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date *</label>
                <input type="text" placeholder="e.g. 14 Apr 2026" value={addForm.date} onChange={e=>setAddForm(f=>({...f,date:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (SGD) *</label>
                <input type="number" placeholder="0.00" step="0.01" value={addForm.sgd} onChange={e=>setAddForm(f=>({...f,sgd:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-400 mb-1 block">Description *</label>
              <input type="text" placeholder="e.g. Taxi to client meeting" value={addForm.desc} onChange={e=>setAddForm(f=>({...f,desc:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Reference / Booking ID</label>
                <input type="text" placeholder="Optional" value={addForm.ref} onChange={e=>setAddForm(f=>({...f,ref:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Original Amount</label>
                <input type="text" placeholder="e.g. IDR 250,000" value={addForm.orig} onChange={e=>setAddForm(f=>({...f,orig:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setTab("voucher"); setExtractMsg(""); }}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={addWithReceipt} disabled={extracting}
                className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
                Add to Voucher
              </button>
            </div>
          </div>
        )}

        {/* ── SEARCH TAB ──────────────────────────────────────────── */}
        {tab === "search" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-400 mb-3">Search Gmail for receipts</div>
            <div className="flex gap-2 mb-4">
              <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                onKeyDown={e=>e.key==="Enter" && searchGmail()}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                placeholder="e.g. Grab, TADA, invoice..." />
              <button onClick={searchGmail} disabled={searching}
                className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
            {searchResults.length === 0 && !searching && (
              <div className="text-center py-8 text-sm text-gray-400">Results will appear here</div>
            )}
            <div className="divide-y divide-gray-50">
              {searchResults.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5
                    ${r.type==="grab"||r.type==="grabfood" ? "bg-green-100 text-green-800" : r.type==="tada" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.type==="grab"||r.type==="grabfood" ? "GB" : r.type==="tada" ? "TD" : "RX"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.subject}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.date ? new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : ""}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.snippet}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {r.amount && <div className="text-sm font-medium text-gray-900">{r.amount}</div>}
                    {r.type !== "grabfood" ? (
                      <button onClick={() => addFromSearch(r)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50 transition">+ Add</button>
                    ) : (
                      <span className="text-xs text-gray-300">excluded</span>
                    )}
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

'@ | Set-Content "app\page.jsx" -Encoding utf8NoBOM

Write-Host "Writing app/layout.jsx..." -ForegroundColor Gray
@'
import "./globals.css";
import { SessionProvider } from "./providers";

export const metadata = {
  title: "PV Expense App · Redington ASEAN",
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

'@ | Set-Content "app\layout.jsx" -Encoding utf8NoBOM

Write-Host "Writing app/providers.jsx..." -ForegroundColor Gray
@'
"use client";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}

'@ | Set-Content "app\providers.jsx" -Encoding utf8NoBOM

Write-Host "Writing app/globals.css..." -ForegroundColor Gray
@'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

'@ | Set-Content "app\globals.css" -Encoding utf8NoBOM

Write-Host "Writing app/api/auth/[...nextauth]/route.js..." -ForegroundColor Gray
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

'@ | Set-Content "app\api\auth\[...nextauth]\route.js" -Encoding utf8NoBOM

Write-Host "Writing app/api/gmail/search/route.js..." -ForegroundColor Gray
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

  // Search threads
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

    // Parse amount from snippet
    const amountMatch = snippet.match(/(?:SGD|S\$|MYR|IDR|THB|USD)\s?[\d,]+\.?\d*/i);
    const amount = amountMatch ? amountMatch[0] : null;

    // Detect receipt type
    let type = "other";
    if (from.includes("grab.com")) type = snippet.toLowerCase().includes("food") ? "grabfood" : "grab";
    if (from.includes("tada.global")) type = "tada";

    results.push({ id: msg.id, threadId: thread.id, subject, from, date, snippet, amount, type });
  }

  return Response.json({ results });
}

'@ | Set-Content "app\api\gmail\search\route.js" -Encoding utf8NoBOM

Write-Host "Writing app/api/gmail/message/route.js..." -ForegroundColor Gray
@'
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/options";
import { google } from "googleapis";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  if (!messageId) return Response.json({ error: "No ID" }, { status: 400 });

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

  // Decode body - get HTML preferably, fallback to text
  function decodeBody(payload) {
    // Try to get HTML part first
    if (payload.mimeType === "text/html" && payload.body?.data) {
      return { html: Buffer.from(payload.body.data, "base64").toString("utf-8"), text: null };
    }
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return { html: null, text: Buffer.from(payload.body.data, "base64").toString("utf-8") };
    }
    if (payload.parts) {
      let html = null, text = null;
      for (const part of payload.parts) {
        const result = decodeBody(part);
        if (result.html) html = result.html;
        if (result.text && !text) text = result.text;
      }
      return { html, text };
    }
    return { html: null, text: null };
  }

  const { html, text } = decodeBody(msg.data.payload);

  // Extract key fields from text for fallback
  const plainText = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
  const amountMatch = plainText.match(/(?:Total(?:\s+(?:Paid|Fee|Charged))?)\s*(?:SGD|S\$)?\s*([\d,]+\.?\d*)\s*(?:SGD)?/i);
  const bookingMatch = plainText.match(/(?:Booking\s+(?:ID|Code)|Booking\s+code)\s*[:\s]*([A-Z0-9\-]{8,})/i);

  return Response.json({
    subject, from, date,
    html: html || null,
    text: plainText.slice(0, 1000),
    amount: amountMatch ? amountMatch[1] : null,
    booking: bookingMatch ? bookingMatch[1] : null,
  });
}

'@ | Set-Content "app\api\gmail\message\route.js" -Encoding utf8NoBOM

Write-Host "Writing app/api/receipt/extract/route.js..." -ForegroundColor Gray
@'
async function getLiveRate(fromCurrency, toCurrency = "SGD") {
  if (fromCurrency === toCurrency) return 1;
  try {
    // Using open.er-api.com - free, no key needed
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    const data = await res.json();
    if (data.result === "success" && data.rates[toCurrency]) {
      return data.rates[toCurrency];
    }
  } catch(e) {}

  // Fallback: frankfurter.app
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`);
    const data = await res.json();
    if (data.rates && data.rates[toCurrency]) {
      return data.rates[toCurrency];
    }
  } catch(e) {}

  return null;
}

export async function POST(req) {
  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) return Response.json({ error: "No image provided" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No Anthropic API key configured" }, { status: 500 });

  // Step 1: Extract receipt details via Claude vision
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 },
            },
            {
              type: "text",
              text: `You are a receipt parser. Extract the following fields from this receipt image and return ONLY a valid JSON object with no other text, preamble, or markdown fences:
{
  "date": "DD Mon YYYY format e.g. 14 Apr 2026, or null if not found",
  "merchant": "merchant or company name",
  "description": "concise expense description e.g. Grab Car pickup to dropoff, Hotel Stay, Lunch with client",
  "reference": "booking ID, receipt number, invoice number, or transaction ID if visible, else null",
  "amount": numeric value only e.g. 85000,
  "currency": "3-letter currency code e.g. SGD, IDR, MYR, THB, USD, EUR",
  "orig_amount_str": "formatted original amount with currency e.g. IDR 85,000 or SGD 25.50"
}
Be precise with the currency — check for currency symbols (Rp=IDR, RM=MYR, ฿=THB, $=USD or SGD depending on context, €=EUR). If amount is in SGD, set currency to SGD.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return Response.json({ error: "Claude API error: " + err }, { status: 500 });
  }

  const claudeData = await response.json();
  const text = claudeData.content?.[0]?.text || "";

  let extracted;
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    extracted = JSON.parse(clean);
  } catch(e) {
    return Response.json({ error: "Could not parse Claude response", raw: text }, { status: 500 });
  }

  // Step 2: Fetch live exchange rate if not SGD
  let sgdAmount = null;
  let exchangeRate = null;
  let rateDate = null;

  if (extracted.currency && extracted.currency !== "SGD" && extracted.amount) {
    const rate = await getLiveRate(extracted.currency, "SGD");
    if (rate) {
      exchangeRate = rate;
      sgdAmount = Math.round(extracted.amount * rate * 100) / 100;
      rateDate = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    }
  } else if (extracted.currency === "SGD" && extracted.amount) {
    sgdAmount = extracted.amount;
    exchangeRate = 1;
  }

  return Response.json({
    success: true,
    data: {
      ...extracted,
      sgd_amount: sgdAmount,
      exchange_rate: exchangeRate,
      rate_date: rateDate,
      rate_note: exchangeRate && exchangeRate !== 1
        ? `Live rate: 1 ${extracted.currency} = ${exchangeRate.toFixed(6)} SGD (${rateDate})`
        : null,
    },
  });
}

'@ | Set-Content "app\api\receipt\extract\route.js" -Encoding utf8NoBOM

Write-Host "Writing app/api/voucher/generate/route.js..." -ForegroundColor Gray
@'
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
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "''").replace(/&copy;/g, "©")
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

'@ | Set-Content "app\api\voucher\generate\route.js" -Encoding utf8NoBOM

Write-Host "Writing next.config.mjs..." -ForegroundColor Gray
@'
/** @type {import(''next'').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};
export default nextConfig;

'@ | Set-Content "next.config.mjs" -Encoding utf8NoBOM

Write-Host "Writing tailwind.config.js..." -ForegroundColor Gray
@'
/** @type {import(''tailwindcss'').Config} */
module.exports = {
  content: [
    ''./app/**/*.{js,jsx,ts,tsx}'',
    ''./components/**/*.{js,jsx,ts,tsx}'',
  ],
  theme: { extend: {} },
  plugins: [],
}
'@ | Set-Content "tailwind.config.js" -Encoding utf8NoBOM

Write-Host "Writing postcss.config.js..." -ForegroundColor Gray
@'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
'@ | Set-Content "postcss.config.js" -Encoding utf8NoBOM

Write-Host ""
Write-Host "All files updated!" -ForegroundColor Green
Write-Host "Running npm install..." -ForegroundColor Cyan
npm install
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git add .
git commit -m "Update all app files"
git push
Write-Host ""
Write-Host "Done! Vercel will deploy in ~1 minute." -ForegroundColor Green
