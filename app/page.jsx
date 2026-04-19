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
      } catch (err) { alert("AI Scan failed. Please add manually."); }
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
  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Sign In</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border shadow-sm">
        <h1 className="text-xl font-black text-[#009640]">REDINGTON</h1>
        <button onClick={() => signOut()} className="text-[10px] text-slate-400 uppercase font-bold">Sign out</button>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-6 py-2 rounded-xl text-sm font-bold ${activeTab === 'voucher' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-2 rounded-xl text-sm font-bold ${activeTab === 'add' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-6 py-2 rounded-xl text-sm font-bold ${activeTab === 'search' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a202c] text-white">
                <tr>
                  <th className="p-4 text-left">Details & Activity</th>
                  <th className="p-4 text-right">SGD</th>
                  <th className="p-4 text-center">Receipt</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="p-4">
                       <div className="font-bold text-slate-800">{row.desc}</div>
                       <div className="text-[10px] text-slate-400 mb-2">{row.date}</div>
                       <input 
                         className="w-full p-2 bg-slate-50 border border-slate-100 rounded text-xs italic" 
                         placeholder="Activity description..."
                         value={row.activity || ''}
                         onChange={(e) => updateRow(i, 'activity', e.target.value)}
                       />
                    </td>
                    <td className="p-4 text-right font-black">{(row.sgd || 0).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {row.receiptHtml ? (
                        <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 text-[10px] font-bold underline uppercase">View Email</button>
                      ) : <span className="text-slate-300 text-[10px]">SCANNED</span>}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td className="p-5 text-right uppercase text-[10px] font-bold tracking-widest">Total Claim</td>
                  <td className="p-5 text-right font-black text-lg">S$ {totalSgd.toFixed(2)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={generatePDF} disabled={rows.length === 0 || isGenerating} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold shadow-lg">
            {isGenerating ? "Generating..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="grid grid-cols-2 gap-6">
          <button onClick={() => cameraInputRef.current.click()} className="p-16 border-2 border-dashed rounded-3xl bg-white hover:bg-slate-50 flex flex-col items-center">
            <span className="text-4xl mb-4">📸</span>
            <span className="font-bold text-slate-700">Take Photo</span>
          </button>
          <button onClick={() => fileInputRef.current.click()} className="p-16 border-2 border-dashed rounded-3xl bg-white hover:bg-slate-50 flex flex-col items-center">
            <span className="text-4xl mb-4">📁</span>
            <span className="font-bold text-slate-700">Upload File</span>
          </button>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={processImage} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="col-span-full text-center p-10 font-bold text-blue-600 animate-pulse">🤖 AI Scanning...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">Search Gmail</button>
          {searchResults.map((res, i) => (
            <div key={i} className="p-4 border rounded-2xl flex justify-between items-center bg-white">
              <div className="w-2/3">
                <div className="text-[10px] text-blue-600 font-bold">{res.date}</div>
                <div className="text-sm font-bold truncate">{res.subject}</div>
              </div>
              <button onClick={() => addFromGmail(res)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Add</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
