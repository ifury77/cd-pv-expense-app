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
  const [manualData, setManualData] = useState({ date: '', desc: '', sgd: '' });

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  // AI OCR Processing
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
          ref: 'AI Scan',
          orig: `SGD ${data.amount}`,
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
      ref: item.id?.slice(0, 12),
      orig: `SGD ${item.editAmount}`,
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
      a.download = `PV_Ivan_Ong.pdf`;
      a.click();
    } catch (e) { alert("PDF Error"); }
    setIsGenerating(false);
  }

  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Sign In</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between mb-8 items-center">
        <h1 className="text-xl font-bold">Payment Voucher</h1>
        <button onClick={() => signOut()} className="text-xs text-gray-400">Sign out</button>
      </div>

      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'voucher' ? 'bg-white shadow-sm font-bold' : ''}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'add' ? 'bg-white shadow-sm font-bold' : ''}`}>+ Add Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'search' ? 'bg-white shadow-sm font-bold' : ''}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr><th className="p-3 text-left">Description</th><th className="p-3 text-right">SGD</th><th className="p-3 text-center">Receipt</th><th className="p-3 text-right">Action</th></tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3">
                       <div className="font-bold">{row.desc}</div>
                       <div className="text-xs text-gray-400">{row.date}</div>
                    </td>
                    <td className="p-3 text-right font-bold">{row.sgd.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      {row.receiptHtml ? (
                        <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 text-xs underline">View Email</button>
                      ) : <span className="text-gray-300">Manual</span>}
                    </td>
                    <td className="p-3 text-right"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={generatePDF} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:bg-gray-300">
            {isGenerating ? "Generating..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => cameraInputRef.current.click()} className="p-10 border-2 border-dashed rounded-xl bg-gray-50 hover:bg-gray-100">📸 Take Photo</button>
            <button onClick={() => fileInputRef.current.click()} className="p-10 border-2 border-dashed rounded-xl bg-gray-50 hover:bg-gray-100">📁 Upload File</button>
          </div>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={processImage} />
          <input type="file" ref={fileInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="text-center text-blue-600 font-bold animate-pulse">🤖 AI is reading receipt...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} className="w-full bg-black text-white py-3 rounded-xl">Search Ride Receipts</button>
          {searchResults.map((res, i) => (
            <div key={i} className="p-4 border rounded-xl flex justify-between items-center bg-gray-50">
              <div className="text-xs font-bold truncate w-1/2">{res.subject}</div>
              <div className="flex gap-2">
                <input className="border w-16 p-1 text-xs" value={res.editAmount} onChange={e => {
                  const updated = [...searchResults];
                  updated[i].editAmount = e.target.value;
                  setSearchResults(updated);
                }} />
                <button onClick={() => addFromGmail(res)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
