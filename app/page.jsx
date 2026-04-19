'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const fileInputRef = useRef(null);
  const [rows, setRows] = useState([
    { no: 1, date: '14 Apr 2026', desc: 'Grab Car – Carpark Alley BEA Bldg to 338 East Coast Rd', ref: 'A-97GM4LKGX2X7AV', orig: 'SGD 30.50', sgd: 30.5, receiptSource: 'gmail' }
  ]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [searchQuery, setSearchQuery] = useState('tada OR grab OR receipt');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Manual Form State
  const [formData, setFormData] = useState({ date: '', desc: '', ref: '', sgd: '', orig: '', image: null });

  const totalSgd = rows.reduce((sum, row) => sum + row.sgd, 0);

  const handleDelete = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, no: i + 1 })));
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    const newRow = {
      no: rows.length + 1,
      date: formData.date,
      desc: formData.desc,
      ref: formData.ref,
      orig: formData.orig || `SGD ${formData.sgd}`,
      sgd: parseFloat(formData.sgd),
      receiptSource: 'manual'
    };
    setRows([...rows, newRow]);
    setFormData({ date: '', desc: '', ref: '', sgd: '', orig: '', image: null });
    setActiveTab('voucher');
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
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PV_Ivan_Ong.pdf`;
      a.click();
    } catch (e) { alert("PDF Error"); }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <div className="p-10 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white px-4 py-2 rounded">Sign In</button></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold">Redington Payment Voucher</h1>
          <button onClick={() => signOut()} className="text-xs text-gray-400">Sign out</button>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-200 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('voucher')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'voucher' ? 'bg-white shadow-sm' : ''}`}>Voucher</button>
          <button onClick={() => setActiveTab('add')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'add' ? 'bg-white shadow-sm' : ''}`}>+ Add Photo</button>
          <button onClick={() => setActiveTab('search')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'search' ? 'bg-white shadow-sm' : ''}`}>Search Gmail</button>
        </div>

        {activeTab === 'voucher' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">SGD</th>
                    <th className="p-3 text-center">Receipt</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="p-3 text-gray-400">{row.no}</td>
                      <td className="p-3">{row.date}</td>
                      <td className="p-3 font-medium">{row.desc}</td>
                      <td className="p-3 text-right font-bold">{row.sgd.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        {row.receiptHtml ? (
                          <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 text-xs underline">View Email</button>
                        ) : <span className="text-gray-300">Manual</span>}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDelete(i)} className="text-red-500">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={generatePDF} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">{isGenerating ? 'Generating...' : 'Download PDF'}</button>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex gap-4 mb-6">
              <button onClick={() => fileInputRef.current.click()} className="flex-1 bg-gray-100 p-4 rounded-xl text-center">📁 Choose File</button>
              <button className="flex-1 bg-gray-100 p-4 rounded-xl text-center">📸 Camera</button>
              <input type="file" ref={fileInputRef} className="hidden" />
            </div>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <input type="text" placeholder="Date (e.g. 20 Apr 2026)" className="w-full border p-3 rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
              <input type="text" placeholder="Description" className="w-full border p-3 rounded-lg" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} required />
              <input type="number" step="0.01" placeholder="Amount (SGD)" className="w-full border p-3 rounded-lg" value={formData.sgd} onChange={e => setFormData({...formData, sgd: e.target.value})} required />
              <button type="submit" className="w-full bg-black text-white py-3 rounded-lg">Add to Voucher</button>
            </form>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex gap-2 mb-4">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 border p-3 rounded-lg" />
              <button onClick={handleSearch} className="bg-black text-white px-6 rounded-lg">Search</button>
            </div>
            {searchResults.map((res, i) => (
              <div key={i} className="py-4 border-b flex justify-between items-center">
                <div className="text-sm font-medium">{res.subject}</div>
                <button onClick={() => handleAddFromGmail(res)} className="border px-3 py-1 rounded-lg text-xs">+ Add</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
