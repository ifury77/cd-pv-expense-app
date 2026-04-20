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
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const cameraRef = useRef(null);
  const cardCameraRef = useRef(null);

  // Load from Cloud
  useEffect(() => {
    if (session) {
      fetch('/api/sync').then(res => res.json()).then(data => {
        if (data.rows) setRows(data.rows);
      });
    }
  }, [session]);

  // Save to Cloud
  useEffect(() => {
    if (session && rows.length > 0) {
      setSyncing(true);
      const delayDebounce = setTimeout(() => {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows })
        }).finally(() => setSyncing(false));
      }, 1500);
      return () => clearTimeout(delayDebounce);
    }
  }, [rows, session]);

  const processReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        const data = await res.json();
        setRows(prev => [{
          date: data.date,
          desc: data.desc,
          sgd: parseFloat(data.amount) || 0,
          image: base64 // Save the screenshot!
        }, ...prev]);
      } catch (err) { alert("OCR failed"); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(22); doc.setTextColor(0, 150, 64);
    doc.text("REDINGTON", 14, 20);
    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Description', 'Amount (SGD)']],
      body: rows.map(r => [r.date, r.desc, `S$ ${parseFloat(r.sgd).toFixed(2)}`]),
      foot: [['', 'TOTAL', `S$ ${totalSgd.toFixed(2)}`]],
      headStyles: { fillColor: [0, 150, 64] }
    });
    rows.forEach((row, i) => {
      if (row.image) {
        doc.addPage();
        doc.text(`Attachment ${i + 1}: ${row.desc}`, 14, 20);
        doc.addImage(row.image, 'JPEG', 14, 30, 180, 0);
      }
    });
    doc.save(`Voucher.pdf`);
  };

  if (!session) return <div className="h-screen flex items-center justify-center p-8"><button onClick={() => signIn('google')} className="w-full max-w-xs bg-[#009640] text-white py-5 rounded-[2rem] font-black">Login</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50 pb-40">
      <div className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-[#009640] font-black text-xl uppercase">Redington</h1>
          <p className="text-[8px] font-bold text-slate-400 tracking-widest mt-1 uppercase">{syncing ? '● Syncing...' : '○ Saved'}</p>
        </div>
        <button onClick={() => signOut()} className="text-[10px] font-black text-slate-400">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === 'voucher' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === 'cards' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Cards</button>
        <button onClick={() => setActiveTab('gmail')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === 'gmail' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          <button onClick={() => cameraRef.current.click()} className="w-full bg-white border-4 border-dashed border-slate-200 py-10 rounded-[2rem] flex flex-col items-center">
            <span className="text-4xl mb-2">📸</span>
            <span className="text-[10px] font-black text-[#009640]">SCAN RECEIPT TO VOUCHER</span>
          </button>
          <input type="file" accept="image/*" ref={cameraRef} className="hidden" onChange={processReceipt} />

          {isProcessing && <p className="text-center text-[10px] font-bold animate-pulse">AI ANALYZING...</p>}

          {rows.map((row, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative">
              <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-5 right-6 text-slate-300">✕</button>
              <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">{row.date}</div>
              <input className="w-full font-black text-slate-800 text-sm mb-4 border-none p-0 focus:ring-0" value={row.desc} onChange={(e) => {
                const updated = [...rows]; updated[i].desc = e.target.value; setRows(updated);
              }} />
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-green-600 uppercase italic">{row.image ? "● Attached" : "○ No File"}</span>
                <div className="flex items-center bg-green-50 px-3 py-1 rounded-xl">
                   <span className="text-[10px] font-black text-green-700 mr-1">SGD</span>
                   <input type="number" className="w-16 bg-transparent border-none p-0 font-black text-green-700 text-sm focus:ring-0" value={row.sgd} onChange={(e) => {
                     const updated = [...rows]; updated[i].sgd = e.target.value; setRows(updated);
                   }} />
                </div>
              </div>
            </div>
          ))}
          {rows.length > 0 && (
            <button onClick={generatePDF} className="fixed bottom-10 left-6 right-6 bg-[#009640] text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl z-50">
               DOWNLOAD PDF (S$ {totalSgd.toFixed(2)})
            </button>
          )}
        </div>
      )}
      
      {/* ... (Keep your Cards and Gmail tab UI) */}
    </div>
  );
}
