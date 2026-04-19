'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

const initialData = [
  { no: 1, date: '14 Apr 2026', desc: 'Grab Car – Carpark Alley BEA Bldg to 338 East Coast Rd', ref: 'A-97GM4LKGX2X7AV', orig: 'SGD 30.50', sgd: 30.5, receiptSource: 'gmail' },
  { no: 2, date: '14 Apr 2026', desc: 'Grab Car – 406 East Coast Rd to 29 Lor Melayu, Palmera East', ref: 'A-97H7GBLGWLIQAV', orig: 'SGD 8.10', sgd: 8.1, receiptSource: 'gmail' }
];

export default function Page() {
  const { data: session, status } = useSession();
  const [rows, setRows] = useState(initialData);
  const [activeTab, setActiveTab] = useState('voucher');
  const [searchQuery, setSearchQuery] = useState('receipt OR invoice');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [formData, setFormData] = useState({ date: '', desc: '', ref: '', sgd: '', orig: '', currency: 'SGD', image: null });

  const totalSgd = rows.reduce((sum, row) => sum + row.sgd, 0);

  // SEARCH GMAIL
  async function handleSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) { alert("Search failed: " + err.message); }
    setIsSearching(false);
  }

  // THE FIX: ADD RECEIPT FROM GMAIL
  async function handleAddFromGmail(item) {
    // 1. Better extraction for TADA (Total Fee Charged) and Grab (SGD)
    const tadaMatch = item.snippet.match(/Total Fee Charged\s*([\d.]+)/i);
    const genericMatch = item.snippet.match(/[\d.]+/g)?.find(n => n.includes("."));
    
    let amountValue = item.amount ? parseFloat(item.amount.replace(/[^0-9.]/g, "")) : 
                      (tadaMatch ? parseFloat(tadaMatch[1]) : (genericMatch ? parseFloat(genericMatch) : 0));
    
    let formattedDate = item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "";
    
    let emailHtml = null;
    try {
      const res = await fetch(`/api/gmail/message?id=${item.id}`);
      const data = await res.json();
      if (data.html) emailHtml = data.html;
    } catch (e) { console.error("Fetch HTML failed", e); }

    setRows(prev => [...prev, {
      no: prev.length + 1,
      date: formattedDate,
      desc: item.subject,
      ref: item.id.slice(0, 16),
      orig: item.amount || `SGD ${amountValue.toFixed(2)}`,
      sgd: amountValue,
      receiptSource: 'gmail',
      receiptHtml: emailHtml
    }]);
    setActiveTab('voucher');
  }

  if (status === "loading") return <div className="p-10 text-center">Loading...</div>;
  if (!session) return <div className="p-10 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white px-4 py-2 rounded">Sign In</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('voucher')} className={`px-4 py-2 ${activeTab === 'voucher' ? 'border-b-2 border-blue-500' : ''}`}>Voucher</button>
        <button onClick={() => setActiveTab('search')} className={`px-4 py-2 ${activeTab === 'search' ? 'border-b-2 border-blue-500' : ''}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">SGD</th>
                <th className="p-2 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.desc}</td>
                  <td className="p-2 text-right">{row.sgd.toFixed(2)}</td>
                  <td className="p-2 text-center">
                    {row.receiptHtml && (
                      <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 underline text-xs">View Email</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-800 text-white">
              <tr>
                <td colSpan="2" className="p-2 text-right font-bold">TOTAL</td>
                <td className="p-2 text-right font-bold">{totalSgd.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'search' && (
        <div>
          <div className="flex gap-2 mb-4">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border p-2 flex-1 rounded" />
            <button onClick={handleSearch} className="bg-black text-white px-4 py-2 rounded">{isSearching ? '...' : 'Search'}</button>
          </div>
          <div className="divide-y">
            {searchResults.map((res, i) => (
              <div key={i} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{res.subject}</div>
                  <div className="text-xs text-gray-500">{res.snippet}</div>
                </div>
                <button onClick={() => handleAddFromGmail(res)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">+ Add</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
