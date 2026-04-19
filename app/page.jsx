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

  // Auto-extract amount helper
  const extractAmount = (text) => {
    const match = text.match(/(?:SGD|S\$|Total|Charged)\s?([\d.,]+)/i) || text.match(/[\d.,]+/);
    return match ? match[1].replace(/,/g, '') : "0.00";
  };

  async function handleSearch(q) {
    setIsSearching(true);
    const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.results.map(r => ({ ...r, editAmount: extractAmount(r.snippet) })));
    setIsSearching(false);
  }

  const addRow = (item, amt) => {
    setRows([...rows, {
      no: rows.length + 1,
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject || item.name,
      ref: item.id?.slice(0,10) || 'Manual',
      orig: `SGD ${amt}`,
      sgd: parseFloat(amt) || 0,
      receiptHtml: item.html || null
    }]);
    setActiveTab('voucher');
  };

  if (!session) return <button onClick={() => signIn('google')}>Sign In</button>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('voucher')} className="p-2 border">Voucher</button>
        <button onClick={() => setActiveTab('add')} className="p-2 border">+ Camera/Upload</button>
        <button onClick={() => setActiveTab('search')} className="p-2 border">Gmail</button>
      </div>

      {activeTab === 'add' && (
        <div className="flex gap-4">
          <button onClick={() => cameraInputRef.current.click()} className="bg-blue-500 text-white p-4 rounded">📸 Open Camera</button>
          <button onClick={() => fileInputRef.current.click()} className="bg-gray-500 text-white p-4 rounded">📁 Upload File</button>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={(e) => alert('Image captured!')} />
          <input type="file" ref={fileInputRef} className="hidden" />
        </div>
      )}

      {activeTab === 'search' && (
        <div>
          <button onClick={() => handleSearch('tada OR grab')} className="bg-black text-white p-2 mb-4">Find Receipts</button>
          {searchResults.map((res, i) => (
            <div key={i} className="border-b p-4 flex justify-between items-center">
              <div className="text-sm w-2/3">{res.subject}</div>
              <div className="flex gap-2">
                <input className="border w-20 p-1" value={res.editAmount} onChange={(e) => {
                  const newRes = [...searchResults];
                  newRes[i].editAmount = e.target.value;
                  setSearchResults(newRes);
                }} />
                <button onClick={() => addRow(res, res.editAmount)} className="bg-green-500 text-white px-2 rounded">+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'voucher' && (
        <div>
          <table className="w-full border mb-4">
            <thead><tr className="bg-gray-100"><th>#</th><th>Date</th><th>Desc</th><th>SGD</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t"><td>{r.no}</td><td>{r.date}</td><td>{r.desc}</td><td>{r.sgd.toFixed(2)}</td><td><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button></td></tr>
              ))}
            </tbody>
          </table>
          <button onClick={generatePDF} className="w-full bg-blue-600 text-white p-4 rounded">{isGenerating ? 'Processing...' : 'Download PDF'}</button>
        </div>
      )}
    </div>
  );
}
