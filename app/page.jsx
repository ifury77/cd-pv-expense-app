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
