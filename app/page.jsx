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
          date: data.date || new Date().toLocaleDateString('en-GB'),
          desc: data.desc || "Scanned Receipt",
          activity: "",
          sgd: parseFloat(data.amount) || 0
        }]);
        setActiveTab('voucher');
      } catch (err) { alert("AI Scan failed. Please try a clearer photo."); }
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
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      activity: "",
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

  if (status === "loading") return <div className="p-20 text-center">Loading...</div>;
  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-8 py-3 rounded-xl font-bold">Sign In to Redington</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      {/* Redington Branded Header */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col">
          <span className="text-2xl font-black text-[#009640] tracking-tighter">REDINGTON</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Expense Portal</span>
        </div>
        <button onClick={() => signOut()} className="text-[10px] text-slate-300 uppercase font-bold hover:text-red-500 transition-colors">Sign out</button>
      </div>

      {/* Primary Navigation */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow-md text-[#009640]' : 'text-slate-500'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow-md text-[#009640]' : 'text-slate-500'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow-md text-[#009640]' : 'text-slate-500'}`}>Search Gmail</button>
      </div>

      {/* Main Expense Table */}
      {activeTab === 'voucher' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[#1a202c] text-white">
                <tr>
                  <th className="p-4 text-left font-bold uppercase text-[10px] tracking-widest">Details & Activity Description</th>
                  <th className="p-4 text-right font-bold uppercase text-[10px] tracking-widest">Amount (SGD)</th>
                  <th className="p-4 text-center font-bold uppercase text-[10px] tracking-widest">Receipt</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr><td colSpan="4" className="p-16 text-center text-slate-300 italic">No expenses added yet.</td></tr>
                ) : rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                       <div className="font-bold text-slate-800">{row.desc}</div>
                       <div className="text-[10px] text-slate-400 mb-2 uppercase">{row.date}</div>
                       <input 
                         className="w-full p-2 bg-blue-50/30 border border-blue-100/50 rounded-lg text-xs italic text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-200" 
                         placeholder="Describe activity (e.g., Client lunch at Jurong)"
                         value={row.activity || ''}
                         onChange={(e) => updateRow(i, 'activity', e.target.value)}
                       />
                    </td>
                    <td className="p-4 text-right font-black text-slate-900">S$ {(row.sgd || 0).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {row.receiptHtml ? (
                        <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 text-[10px] font-bold underline uppercase">View Email</button>
                      ) : <span className="text-slate-300 text-[10px] font-bold">SCANNED</span>}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-slate-200 hover:text-red-500 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td className="p-5 text-right font-bold uppercase text-[10px] tracking-widest text-slate-400">Total Claim</td>
                  <td className="p-5 text-right font-black text-xl">S$ {totalSgd.toFixed(2)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={generatePDF} disabled={rows.length === 0 || isGenerating} className="w-full bg-[#3182ce] hover:bg-[#2b6cb0] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 transition-all disabled:bg-slate-200">
            {isGenerating ? "Assembling PDF..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {/* AI Scanning Section */}
      {activeTab === 'add' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-300">
          <button onClick={() => cameraInputRef.current.click()} className="group p-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white hover:border-[#009640] hover:bg-[#f0fff4] transition-all flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 group-hover:bg-white rounded-full flex items-center justify-center text-3xl mb-4 transition-colors">📸</div>
            <span className="font-bold text-slate-700">Take Photo</span>
          </button>
          <button onClick={() => fileInputRef.current.click()} className="group p-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white hover:border-[#009640] hover:bg-[#f0fff4] transition-all flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 group-hover:bg-white rounded-full flex items-center justify-center text-3xl mb-4 transition-colors">📁</div>
            <span className="font-bold text-slate-700">Upload File</span>
          </button>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={processImage} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={processImage} />
          {isProcessing && (
            <div className="col-span-full text-center p-12 bg-white rounded-3xl border shadow-sm">
              <div className="w-10 h-10 border-4 border-[#009640] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-[#009640] font-black uppercase tracking-widest text-sm">AI Scanning Receipt...</div>
            </div>
          )}
        </div>
      )}

      {/* Gmail Integration */}
      {activeTab === 'search' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-colors">
            {isSearching ? "Searching Gmail..." : "Search Transport Receipts"}
          </button>
          <div className="grid gap-3">
            {searchResults.map((res, i) => (
              <div key={i} className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="w-2/3">
                  <div className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">{res.date}</div>
                  <div className="text-sm font-bold text-slate-800 truncate">{res.subject}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <input className="border border-slate-200 w-20 p-2 text-xs font-bold rounded-xl bg-slate-50" value={res.editAmount} onChange={e => {
                    const updated = [...searchResults];
                    updated[i].editAmount = e.target.value;
                    setSearchResults(updated);
                  }} />
                  <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#007a33] transition-colors">Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
