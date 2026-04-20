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
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const cameraRef = useRef(null);

  // LOAD FROM CLOUD
  useEffect(() => {
    if (session) {
      fetch('/api/sync').then(res => res.json()).then(data => {
        if (data.rows) setRows(data.rows);
      });
    }
  }, [session]);

  // SAVE TO CLOUD
  useEffect(() => {
    if (session && rows.length > 0) {
      setSyncing(true);
      const delayDebounce = setTimeout(() => {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows })
        }).finally(() => setSyncing(false));
      }, 1000);
      return () => clearTimeout(delayDebounce);
    }
  }, [rows, session]);

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(22); doc.setTextColor(0, 150, 64);
    doc.text("REDINGTON", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`EXPENSE VOUCHER: ${session?.user?.name}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Description', 'Amount (SGD)']],
      body: rows.map(r => [r.date, r.desc, `S$ ${parseFloat(r.sgd).toFixed(2)}`]),
      foot: [['', 'TOTAL', `S$ ${totalSgd.toFixed(2)}`]],
      headStyles: { fillColor: [0, 150, 64] }
    });
    doc.save(`Voucher_${new Date().toLocaleDateString()}.pdf`);
  };

  const processCard = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result })
        });
        const data = await res.json();
        setCards(prev => [{ ...data, id: Date.now() }, ...prev]);
      } catch (err) { alert("Scan failed"); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  async function handleGmailSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=receipt OR invoice OR bill`);
      const data = await res.json();
      setSearchResults((data.results || []).map(r => {
        const amtMatch = r.snippet?.match(/(?:SGD|S\$|Total|Charged|Fee)\s?S?\$?\s?([\d.,]+)/i);
        return { ...r, editAmount: amtMatch ? amtMatch[1].replace(/,/g, '') : "0.00" };
      }));
    } catch (e) { alert("Gmail search failed"); }
    setIsSearching(false);
  }

  if (status === "loading") return <div className="p-20 text-center font-black text-slate-300">LOADING...</div>;
  if (!session) return <div className="h-screen flex items-center justify-center p-8 bg-white"><button onClick={() => signIn('google')} className="w-full max-w-xs bg-[#009640] text-white py-5 rounded-[2rem] font-black text-lg shadow-xl">Login to Redington</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50 pb-40">
      <div className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-[#009640] font-black text-xl leading-none uppercase">Redington</h1>
          <p className="text-[8px] font-bold text-slate-400 tracking-widest mt-1 uppercase">{syncing ? '● Syncing to Cloud...' : '○ Saved'}</p>
        </div>
        <button onClick={() => signOut()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl">
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'cards' ? 'bg-white text-[#009640] shadow-sm' : 'text-slate-500'}`}>Cards</button>
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'voucher' ? 'bg-white text-[#009640] shadow-sm' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('gmail')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'gmail' ? 'bg-white text-[#009640] shadow-sm' : 'text-slate-500'}`}>Gmail</button>
      </div>

      {activeTab === 'cards' && (
        <div className="space-y-4">
          <button onClick={() => cameraRef.current.click()} className="w-full border-4 border-dashed border-slate-200 aspect-video rounded-[2rem] bg-white flex flex-col items-center justify-center active:scale-95 transition-all">
            <span className="text-5xl mb-3">🪪</span>
            <span className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Scan Business Card</span>
          </button>
          <input type="file" accept="image/*" ref={cameraRef} className="hidden" onChange={processCard} />
          {isProcessing && <div className="text-center animate-pulse text-[#009640] font-black text-[10px] uppercase">Processing...</div>}
          {cards.map(card => (
            <div key={card.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <input className="w-full font-black text-slate-900 text-lg mb-2 border-none p-0 focus:ring-0" value={card.name} onChange={(e) => setCards(cards.map(c => c.id === card.id ? {...c, name: e.target.value} : c))} />
              <div className="text-[11px] text-slate-500 space-y-1 mb-6">
                <p>📞 {card.phone || "---"}</p>
                <p>📧 {card.email || "---"}</p>
              </div>
              <button onClick={() => {
                const vcard = ["BEGIN:VCARD","VERSION:3.0",`FN:${card.name}`,`TEL;TYPE=CELL:${card.phone}`,`EMAIL:${card.email}`,"END:VCARD"].join("\n");
                const blob = new Blob([vcard], { type: 'text/vcard' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${card.name}.vcf`);
                link.click();
              }} className="w-full bg-[#009640] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Save Contact</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative">
              <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-5 right-6 text-slate-300">✕</button>
              <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">{row.date}</div>
              <div className="font-black text-slate-800 text-sm mb-4 leading-tight">{row.desc}</div>
              <div className="flex justify-end"><span className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-black text-sm">S$ {parseFloat(row.sgd).toFixed(2)}</span></div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-center py-20 text-slate-300 text-[10px] font-black uppercase tracking-widest">No claims found</div>}
          {rows.length > 0 && (
            <button onClick={generatePDF} className="fixed bottom-10 left-6 right-6 bg-[#009640] text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl z-50 uppercase tracking-widest">
               Download PDF (S$ {totalSgd.toFixed(2)})
            </button>
          )}
        </div>
      )}

      {activeTab === 'gmail' && (
        <div className="space-y-4">
          <button onClick={handleGmailSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest">
            {isSearching ? "Searching..." : "🔍 Search Gmail Receipts"}
          </button>
          {searchResults.map((res, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="text-[9px] text-blue-500 font-bold uppercase mb-1">{res.date}</div>
              <div className="text-xs font-black text-slate-800 mb-4 line-clamp-2">{res.subject}</div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="bg-slate-100 px-3 py-2 rounded-xl font-black text-xs text-slate-600">S$ {res.editAmount}</div>
                <button onClick={() => {
                   setRows(prev => [...prev, { date: res.date, desc: res.subject, sgd: parseFloat(res.editAmount) || 0 }]);
                   setActiveTab('voucher');
                }} className="bg-[#009640] text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
