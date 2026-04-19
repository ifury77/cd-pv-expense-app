'use client';
import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const [rows, setRows] = useState([
    { no: 1, date: '14 Apr 2026', desc: 'Grab Car – Carpark Alley BEA Bldg to 338 East Coast Rd', ref: 'A-97GM4LKGX2X7AV', orig: 'SGD 30.50', sgd: 30.5, receiptSource: 'gmail' },
    { no: 2, date: '14 Apr 2026', desc: 'Grab Car – 406 East Coast Rd to 29 Lor Melayu, Palmera East', ref: 'A-97H7GBLGWLIQAV', orig: 'SGD 8.10', sgd: 8.1, receiptSource: 'gmail' }
  ]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [searchQuery, setSearchQuery] = useState('tada OR grab OR receipt');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalSgd = rows.reduce((sum, row) => sum + row.sgd, 0);

  const handleDelete = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, no: i + 1 })));
  };

  async function handleSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) { alert("Search failed"); }
    setIsSearching(false);
  }

  async function handleAddFromGmail(item) {
    const tadaMatch = item.snippet.match(/Total Fee Charged\s*([\d.]+)/i);
    const genericMatch = item.snippet.match(/[\d.]+/g)?.find(n => n.includes("."));
    let amt = item.amount ? parseFloat(item.amount.replace(/[^0-9.]/g, "")) : (tadaMatch ? parseFloat(tadaMatch[1]) : (genericMatch ? parseFloat(genericMatch) : 0));
    
    let emailHtml = null;
    try {
      const res = await fetch(`/api/gmail/message?id=${item.id}`);
      const data = await res.json();
      emailHtml = data.html;
    } catch (e) {}

    setRows(prev => [...prev, {
      no: prev.length + 1,
      date: item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "",
      desc: item.subject,
      ref: item.id.slice(0, 16),
      orig: item.amount || `SGD ${amt.toFixed(2)}`,
      sgd: amt,
      receiptSource: 'gmail',
      receiptHtml: emailHtml
    }]);
    setActiveTab('voucher');
  }

  async function generatePDF() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/voucher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows, pvNumber: "PV4" })
      });
      if (!res.ok) throw new Error("PDF Generation failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PV_Ivan_Ong_PV4.pdf`;
      a.click();
    } catch (e) { alert(e.message); }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl border text-center shadow-sm max-w-sm w-full">
        <img src="/redington-logo.png" className="h-10 mx-auto mb-6" alt="Redington" />
        <h1 className="text-xl font-bold mb-8">Payment Voucher</h1>
        <button onClick={() => signIn('google')} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium">Sign in with Google</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <img src="/redington-logo.png" className="h-8 mb-2" alt="Redington" />
            <h1 className="text-lg font-bold text-gray-900">Payment Voucher</h1>
            <p className="text-sm text-gray-500">Ivan Ong – Redington ASEAN</p>
          </div>
          <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-red-500">Sign out</button>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('voucher')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'voucher' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Voucher</button>
          <button onClick={() => setActiveTab('search')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'search' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Search Gmail</button>
        </div>

        {activeTab === 'voucher' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium w-10">#</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-gray-500 font-medium">SGD</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-medium">Receipt</th>
                    <th className="px-4 py-3 text-right text-gray-500 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{row.no}</td>
                      <td className="px-4 py-3 text-gray-600">{row.date}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{row.desc}</td>
                      <td className="px-4 py-3 text-right font-semibold">{row.sgd.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.receiptHtml ? (
                          <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 hover:underline text-xs">View Email</button>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(i)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white">
                  <tr>
                    <td colSpan="3" className="px-4 py-4 text-right font-bold">TOTAL SGD</td>
                    <td className="px-4 py-4 text-right font-bold text-lg">{totalSgd.toFixed(2)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button onClick={generatePDF} disabled={isGenerating} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 disabled:bg-gray-400">
              {isGenerating ? "Processing PDF Attachments..." : "Download PDF Voucher"}
            </button>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <div className="flex gap-2 mb-6">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-4 py-3" placeholder="Search receipts..." />
              <button onClick={handleSearch} className="bg-slate-900 text-white px-6 rounded-xl font-medium">{isSearching ? "..." : "Search"}</button>
            </div>
            <div className="divide-y">
              {searchResults.map((res, i) => (
                <div key={i} className="py-4 flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 mb-1">{res.subject}</div>
                    <div className="text-xs text-gray-400 mb-2">{new Date(res.date).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded-lg">{res.snippet}</div>
                  </div>
                  <button onClick={() => handleAddFromGmail(res)} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50">+ Add</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
