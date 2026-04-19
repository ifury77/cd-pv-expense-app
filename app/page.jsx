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
  const [manualData, setManualData] = useState({ date: '', desc: '', sgd: '' });

  const totalSgd = (rows || []).reduce((sum, row) => sum + (row.sgd || 0), 0);

  const handleDelete = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, no: i + 1 })));
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    const newRow = {
      no: rows.length + 1,
      date: manualData.date || new Date().toLocaleDateString('en-GB'),
      desc: manualData.desc,
      ref: 'Manual',
      orig: `SGD ${manualData.sgd}`,
      sgd: parseFloat(manualData.sgd) || 0,
      receiptSource: 'manual'
    };
    setRows([...rows, newRow]);
    setManualData({ date: '', desc: '', sgd: '' });
    setActiveTab('voucher');
  };

  async function handleSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=tada OR grab OR receipt`);
      const data = await res.json();
      const results = (data.results || []).map(r => {
        const amtMatch = r.snippet?.match(/(?:SGD|S\$|Total|Charged)\s?([\d.,]+)/i);
        return { ...r, editAmount: amtMatch ? amtMatch[1].replace(/,/g, '') : "0.00" };
      });
      setSearchResults(results);
    } catch (err) { console.error(err); }
    setIsSearching(false);
  }

  const addFromGmail = (item) => {
    setRows(prev => [...prev, {
      no: prev.length + 1,
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      ref: item.id?.slice(0, 12),
      orig: `SGD ${item.editAmount}`,
      sgd: parseFloat(item.editAmount) || 0,
      receiptHtml: item.html || null
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
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voucher_Ivan_Ong.pdf`;
      a.click();
    } catch (e) { alert("Error generating PDF. Check server logs."); }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="p-10 text-center">Loading...</div>;
  if (!session) return (
    <div className="flex h-screen items-center justify-center">
      <button onClick={() => signIn('google')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Sign in to Redington</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-slate-800">Payment Voucher</h1>
        <button onClick={() => signOut()} className="text-xs text-slate-400">Sign out</button>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {['voucher', 'add', 'search'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            {tab === 'voucher' ? 'My Voucher' : tab === 'add' ? '+ Add Photo' : 'Search Gmail'}
          </button>
        ))}
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left">#</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-right">SGD</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="p-4 text-slate-400">{row.no}</td>
                    <td className="p-4 font-medium">{row.desc}</td>
                    <td className="p-4 text-right font-bold">{row.sgd.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(i)} className="text-red-500 bg-red-50 px-3 py-1 rounded-lg font-bold">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan="2" className="p-4 text-right font-bold uppercase">Total SGD</td>
                  <td className="p-4 text-right font-bold text-lg">{totalSgd.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={generatePDF} disabled={isGenerating || rows.length === 0} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg disabled:bg-slate-300">
            {isGenerating ? "Preparing Professional PDF..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => cameraInputRef.current.click()} className="bg-slate-100 p-8 rounded-xl text-center border-2 border-dashed border-slate-300 hover:border-blue-400">
              <span className="block text-2xl mb-2">📸</span>
              <span className="text-sm font-bold">Camera</span>
            </button>
            <button onClick={() => fileInputRef.current.click()} className="bg-slate-100 p-8 rounded-xl text-center border-2 border-dashed border-slate-300 hover:border-blue-400">
              <span className="block text-2xl mb-2">📁</span>
              <span className="text-sm font-bold">Files</span>
            </button>
          </div>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" />
          <input type="file" ref={fileInputRef} className="hidden" />
          
          <form onSubmit={handleManualAdd} className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-sm text-slate-500 uppercase">Manual Entry</h3>
            <input placeholder="Date (e.g. 15 Mar 2026)" className="w-full border p-3 rounded-xl" value={manualData.date} onChange={e => setManualData({...manualData, date: e.target.value})} />
            <input placeholder="Description (e.g. Grab to Office)" className="w-full border p-3 rounded-xl" value={manualData.desc} onChange={e => setManualData({...manualData, desc: e.target.value})} required />
            <input type="number" step="0.01" placeholder="Amount (SGD)" className="w-full border p-3 rounded-xl font-bold" value={manualData.sgd} onChange={e => setManualData({...manualData, sgd: e.target.value})} required />
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Add to List</button>
          </form>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold mb-6">
            {isSearching ? "Searching Gmail..." : "Find Recent Ride Receipts"}
          </button>
          <div className="space-y-4">
            {searchResults.map((res, i) => (
              <div key={i} className="p-4 border rounded-xl flex flex-col gap-3 bg-slate-50">
                <div className="text-sm font-bold text-slate-800 leading-tight">{res.subject}</div>
                <div className="flex items-center gap-3">
                   <div className="text-xs font-bold text-slate-500">AMOUNT:</div>
                   <input className="border px-2 py-1 rounded bg-white w-24 font-bold" value={res.editAmount} onChange={(e) => {
                      const updated = [...searchResults];
                      updated[i].editAmount = e.target.value;
                      setSearchResults(updated);
                   }} />
                   <button onClick={() => addFromGmail(res)} className="ml-auto bg-blue-600 text-white px-4 py-1 rounded-lg text-sm font-bold">Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
