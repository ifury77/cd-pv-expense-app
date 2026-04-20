'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Page() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('voucher');
  const [rows, setRows] = useState([]);
  const [cards, setCards] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // LOAD DATA FROM CLOUD ON LOGIN
  useEffect(() => {
    if (session) {
      fetch('/api/sync').then(res => res.json()).then(data => {
        if (data.rows) setRows(data.rows);
      });
    }
  }, [session]);

  // SAVE DATA TO CLOUD WHENEVER ROWS CHANGE
  useEffect(() => {
    if (session && rows.length > 0) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
    }
  }, [rows, session]);

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(20); doc.text("REDINGTON PAYMENT VOUCHER", 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Description', 'Amount (SGD)']],
      body: rows.map(r => [r.date, r.desc, `S$ ${parseFloat(r.sgd).toFixed(2)}`]),
      foot: [['', 'TOTAL CLAIM', `S$ ${totalSgd.toFixed(2)}`]]
    });
    doc.save('Voucher.pdf');
  };

  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-8 py-4 rounded-3xl font-black">Login</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50 pb-32">
      <div className="flex justify-between items-center mb-6 pt-4">
        <h1 className="text-[#009640] font-black text-xl">REDINGTON</h1>
        <button onClick={() => signOut()} className="text-[10px] font-black text-slate-400">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl">
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'cards' ? 'bg-white text-[#009640]' : ''}`}>CARDS</button>
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'voucher' ? 'bg-white text-[#009640]' : ''}`}>VOUCHER</button>
        <button onClick={() => setActiveTab('gmail')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'gmail' ? 'bg-white text-[#009640]' : ''}`}>GMAIL</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative">
              <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-slate-300">✕</button>
              <div className="text-[9px] text-slate-400 font-bold mb-1">{row.date}</div>
              <div className="font-black text-slate-800 text-sm mb-4">{row.desc}</div>
              <div className="flex justify-end"><span className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-black text-sm">S$ {parseFloat(row.sgd).toFixed(2)}</span></div>
            </div>
          ))}
          
          {/* THE MISSING PDF BUTTON */}
          {rows.length > 0 && (
            <button onClick={generatePDF} className="fixed bottom-6 left-4 right-4 bg-[#009640] text-white py-5 rounded-[2rem] font-black shadow-2xl z-50">
              Download PDF (S$ {totalSgd.toFixed(2)})
            </button>
          )}
        </div>
      )}
      
      {/* ... (Keep your existing Cards and Gmail tab content) */}
    </div>
  );
}
