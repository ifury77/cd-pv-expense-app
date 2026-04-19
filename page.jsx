"use client";
import { useState, useRef } from "react";
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
  const [manualForm, setManualForm] = useState({ date:"", desc:"", ref:"", sgd:"" });
  const [uploadingFor, setUploadingFor] = useState(null);
  const fileInputRef = useRef(null);
  const addReceiptRef = useRef(null);
  const [addReceiptForm, setAddReceiptForm] = useState({ date:"", desc:"", ref:"", sgd:"", image:null, imagePreview:null });

  const total = items.reduce((s, it) => s + it.sgd, 0);

  function removeItem(i) {
    const next = items.filter((_,idx) => idx !== i).map((it,idx) => ({ ...it, no: idx+1 }));
    setItems(next);
  }

  // Attach image to existing item
  function handleAttachImage(itemIndex) {
    setUploadingFor(itemIndex);
    fileInputRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (uploadingFor !== null) {
        // Attach to existing item
        setItems(prev => prev.map((it, i) => i === uploadingFor
          ? { ...it, receiptImage: ev.target.result, receiptSource: file.name }
          : it
        ));
        setUploadingFor(null);
      } else {
        // New item image
        setAddReceiptForm(f => ({ ...f, image: ev.target.result, imagePreview: ev.target.result }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleAddReceiptImage() {
    setUploadingFor(null);
    fileInputRef.current.click();
  }

  function addWithReceipt() {
    const { date, desc, ref, sgd, image } = addReceiptForm;
    if (!date || !desc || !sgd) return alert("Please fill in date, description and amount.");
    const d = new Date(date);
    const label = d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    setItems(prev => [...prev, {
      no: prev.length+1,
      date: label,
      desc,
      ref: ref||"—",
      orig: `SGD ${parseFloat(sgd).toFixed(2)}`,
      sgd: parseFloat(sgd),
      receiptImage: image || null,
      receiptSource: "uploaded",
    }]);
    setAddReceiptForm({ date:"", desc:"", ref:"", sgd:"", image:null, imagePreview:null });
  }

  async function searchGmail() {
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(searchQ)}`);

if (!res.ok) {
  const text = await res.text();
  throw new Error(text || "Gmail API failed");
}

let data;
try {
  data = await res.json();
} catch (e) {
  throw new Error("Server did not return valid JSON");
}

setSearchResults(data.results || []);
  }

  function addFromSearch(r) {
    const amtNum = r.amount ? parseFloat(r.amount.replace(/[^0-9.]/g,"")) : 0;
    const dateStr = new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    setItems(prev => [...prev, {
      no: prev.length+1,
      date: dateStr,
      desc: r.subject,
      ref: r.id.slice(0,16),
      orig: r.amount || "SGD 0.00",
      sgd: amtNum,
      receiptSource: "gmail",
    }]);
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

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm w-full">
        <div className="text-2xl font-medium text-gray-900 mb-1">Payment Voucher</div>
        <div className="text-sm text-gray-400 mb-8">Redington ASEAN – Ivan Ong</div>
        <button onClick={() => signIn("google")} className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400 mt-4">Read-only Gmail access to find receipts</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
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

        {/* VOUCHER TAB */}
        {tab === "voucher" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
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
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-sm">{it.sgd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        {it.receiptImage ? (
                          <div className="flex items-center justify-center gap-1">
                            <img src={it.receiptImage} alt="receipt" className="w-8 h-8 object-cover rounded border border-gray-200" />
                            <button onClick={() => handleAttachImage(i)} className="text-xs text-gray-400 hover:text-blue-500">↺</button>
                          </div>
                        ) : (
                          <button onClick={() => handleAttachImage(i)}
                            className="text-xs border border-dashed border-gray-300 rounded px-2 py-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
                            + photo
                          </button>
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

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">Running total</div>
                <div className="text-2xl font-medium text-gray-900">SGD {total.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">{items.filter(i=>i.receiptImage).length}/{items.length} receipts attached</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTab("search")} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition">Search Gmail</button>
                <button onClick={() => setTab("add")} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition">+ Add Receipt</button>
                <button onClick={generatePDF} disabled={generating} className="bg-gray-900 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
                  {generating ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ADD RECEIPT TAB */}
        {tab === "add" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-700 mb-4">Add new receipt</div>

            {/* Image upload area */}
            <div
              onClick={handleAddReceiptImage}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition mb-4"
            >
              {addReceiptForm.imagePreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={addReceiptForm.imagePreview} alt="preview" className="max-h-48 rounded-lg object-contain" />
                  <span className="text-xs text-gray-400">Tap to change</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="text-3xl">📷</div>
                  <div className="text-sm font-medium text-gray-600">Take photo or choose from gallery</div>
                  <div className="text-xs text-gray-400">Supports JPG, PNG • Receipt will be appended to PDF</div>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date *</label>
                <input type="date" value={addReceiptForm.date} onChange={e=>setAddReceiptForm(f=>({...f,date:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (SGD) *</label>
                <input type="number" placeholder="0.00" step="0.01" value={addReceiptForm.sgd} onChange={e=>setAddReceiptForm(f=>({...f,sgd:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-400 mb-1 block">Description *</label>
              <input type="text" placeholder="e.g. Taxi to client meeting" value={addReceiptForm.desc} onChange={e=>setAddReceiptForm(f=>({...f,desc:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Reference / Booking ID (optional)</label>
              <input type="text" placeholder="e.g. A-97GM4LKGX2X7AV" value={addReceiptForm.ref} onChange={e=>setAddReceiptForm(f=>({...f,ref:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setTab("voucher")} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={addWithReceipt} className="flex-1 bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition">
                Add to Voucher
              </button>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5 ${r.type==="grab"||r.type==="grabfood" ? "bg-green-100 text-green-800" : r.type==="tada" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.type==="grab"||r.type==="grabfood" ? "GB" : r.type==="tada" ? "TD" : "RX"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.subject}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.snippet}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {r.amount && <div className="text-sm font-medium text-gray-900">{r.amount}</div>}
                    {r.type !== "grabfood" ? (
                      <button onClick={() => addFromSearch(r)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50 transition">
                        + Add
                      </button>
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
