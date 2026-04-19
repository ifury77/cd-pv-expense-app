'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const processImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result })
        });
        const data = await res.json();
        setRows(prev => [...prev, {
          no: prev.length + 1,
          date: data.date || new Date().toLocaleDateString('en-GB'),
          desc: data.desc || "Scanned Receipt",
          activity: "",
          ref: 'AI Scan',
          sgd: parseFloat(data.amount) || 0
        }]);
        setActiveTab('voucher');
      } catch (err) { alert("OCR Failed"); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  async function handleSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=tada OR grab OR receipt`);
      const data = await res.json();
      setSearchResults((data.results || []).map(r => ({
        ...r, 
        editAmount: r.snippet?.match(/(?:SGD|S\$|Total|Charged)\s?([\d.,]+)/i)?.[1].replace(/,/g, '') || "0.00"
      })));
    } catch (e) {}
    setIsSearching(false);
  }

  const addFromGmail = async (item) => {
    let emailHtml = "";
    try {
      const res = await fetch(`/api/gmail/message?id=${item.id}`);
      const data = await res.json();
      emailHtml = data.html;
    } catch (e) {}

    setRows(prev => [...prev, {
      no: prev.length + 1,
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      activity: "",
      ref: item.id?.slice(0, 12),
      sgd: parseFloat(item.editAmount) || 0,
      receiptHtml: emailHtml
    }]);
    setActiveTab('voucher');
  };

  async function generatePDF() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/voucher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows, pvNumber: "PV4" })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voucher_Ivan_Ong.pdf`;
      a.click();
    } catch (e) { alert("PDF Error"); }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="p-20 text-center">Loading Portal...</div>;
  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Sign In to Redington</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header with Redington Style */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">REDINGTON <span className="text-blue-600 font-light">EXPENSE</span></h1>
          <p className="text-xs text-slate-400 font-medium">Voucher Portal • {session.user.email}</p>
        </div>
        <button onClick={() => signOut()} className="bg-slate-50 text-slate-400 text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-widest hover:bg-red-50 hover:text-red-500 transition-colors">Sign out</button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Search Gmail</button>
      </div>

      {/* Main Voucher View */}
      {activeTab === 'voucher' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-4 text-left font-bold uppercase text-[10px] tracking-widest">Details & Activity Description</th>
                  <th className="p-4 text-right font-bold uppercase text-[10px] tracking-widest">Amount</th>
                  <th className="p-4 text-center font-bold uppercase text-[10px] tracking-widest">Receipt</th>
                  <th className="p-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td colSpan="4" className="p-20 text-center text-slate-300 italic">No items added yet. Search Gmail or snap a photo to begin.</td></tr>
                ) : rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                       <div className="font-bold text-slate-800 mb-1">{row.desc}</div>
                       <div className="flex items-center gap-2 mb-2">
                         <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono uppercase">{row.date}</span>
                       </div>
                       <input 
                         className="w-full p-2 bg-blue-50/30 border border-blue-100/50 rounded-lg text-xs italic text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300" 
                         placeholder="Describe activity (e.g., Lunch meeting with client)"
                         value={row.activity || ''}
                         onChange={(e) => updateRow(i, 'activity', e.target.value)}
                       />
                    </td>
                    <td className="p-4 text-right align-top">
                      <div className="font-black text-slate-900 text-base">S$ { (row.sgd || 0).toFixed(2) }</div>
                    </td>
                    <td className="p-4 text-center align-top">
                      {row.receiptHtml ? (
                        <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="inline-flex items-center gap-1.5 text-blue-600 text-[10px] font-bold uppercase tracking-wider bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                          View Email
                        </button>
                      ) : <span className="text-slate-300 text-[10px] uppercase font-bold tracking-widest">Scanned</span>}
                    </td>
                    <td className="p-4 text-right align-top">
                      <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-slate-200 hover:text-red-500 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td className="p-6 text-right font-bold uppercase text-[10px] text-slate-400 tracking-widest">Total Claim Amount</td>
                  <td className="p-6 text-right font-black text-xl text-blue-600">S$ {totalSgd.toFixed(2)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={generatePDF} disabled={rows.length === 0 || isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none">
            {isGenerating ? "Assembling PDF Document..." : "Download Professional PDF"}
          </button>
        </div>
      )}

      {/* Add Photo/Camera Section */}
      {activeTab === 'add' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => cameraInputRef.current.click()} className="group p-16 border-2 border-dashed border-blue-200 rounded-[2rem] bg-white hover:bg-blue-50 hover:border-blue-400 transition-all flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform">📸</div>
              <span className="font-black text-blue-600 text-xl tracking-tight">Snap Receipt</span>
              <span className="text-blue-300 text-xs font-medium mt-1">Uses mobile camera</span>
            </button>
            <button onClick={() => fileInputRef.current.click()} className="group p-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white hover:bg-slate-50 hover:border-slate-400 transition-all flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform">📁</div>
              <span className="font-black text-slate-600 text-xl tracking-tight">Upload File</span>
              <span className="text-slate-300 text-xs font-medium mt-1">Image or PDF</span>
            </button>
          </div>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={processImage} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={processImage} />
          {isProcessing && (
            <div className="mt-8 text-center p-12 bg-white rounded-3xl border shadow-sm">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-slate-800 font-black text-lg">AI ANALYZING RECEIPT</div>
              <p className="text-slate-400 text-sm">Identifying date, merchant, and total SGD...</p>
            </div>
          )}
        </div>
      )}

      {/* Gmail Search Section */}
      {activeTab === 'search' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black transition-all active:scale-[0.98]">
            {isSearching ? "Synchronizing with Gmail..." : "Auto-Fetch Grab & Tada Receipts"}
          </button>
          <div className="grid gap-4">
            {searchResults.map((res, i) => (
              <div key={i} className="p-5 border rounded-2xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="w-2/3">
                  <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1">{res.date}</div>
                  <div className="text-sm font-black text-slate-800 truncate">{res.subject}</div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">S$</span>
                    <input className="border-slate-200 border w-24 pl-8 pr-2 py-2 text-sm font-black rounded-xl bg-slate-50 focus:bg-white transition-colors" value={res.editAmount} onChange={e => {
                      const updated = [...searchResults];
                      updated[i].editAmount = e.target.value;
                      setSearchResults(updated);
                    }} />
                  </div>
                  <button onClick={() => addFromGmail(res)} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-tight hover:bg-blue-700 transition-colors">Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
