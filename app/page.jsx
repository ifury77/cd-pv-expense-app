'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('cards');
  const [cards, setCards] = useState([]);
  const [rows, setRows] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  // --- BUSINESS CARD LOGIC ---
  const processCard = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      try {
        const res = await fetch('/api/card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        const data = await res.json();
        setCards(prev => [{ ...data, id: Date.now() }, ...prev]);
      } catch (err) { alert("Scan failed."); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const downloadVCF = (card) => {
    const vcard = ["BEGIN:VCARD","VERSION:3.0",`FN:${card.name}`,`TEL;TYPE=CELL:${card.phone}`,`EMAIL:${card.email}`,"END:VCARD"].join("\n");
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${card.name.split(' ')[0] || 'contact'}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- GMAIL SEARCH LOGIC ---
  async function handleGmailSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=receipt OR "tax invoice" OR bill OR "payment advice" OR "e-receipt"`);
      const data = await res.json();
      setSearchResults((data.results || []).map(r => {
        const amtMatch = r.snippet?.match(/(?:SGD|S\$|Total|Charged|Fee)\s?S?\$?\s?([\d.,]+)/i);
        return { ...r, editAmount: amtMatch ? amtMatch[1].replace(/,/g, '') : "0.00" };
      }));
    } catch (e) { alert("Gmail search failed."); }
    setIsSearching(false);
  }

  const addFromGmail = async (item) => {
    setRows(prev => [...prev, {
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      sgd: parseFloat(item.editAmount) || 0,
      id: item.id
    }]);
    setActiveTab('voucher');
  };

  if (status === "loading") return <div className="p-20 text-center font-bold text-slate-400">Loading...</div>;
  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-8 py-4 rounded-3xl font-black">Login to Redington</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50 pb-20">
      <div className="flex justify-between items-center mb-6 pt-4">
        <h1 className="text-[#009640] font-black text-xl">REDINGTON</h1>
        <button onClick={() => signOut()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl">
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'cards' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>CARDS</button>
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'voucher' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>VOUCHER</button>
        <button onClick={() => setActiveTab('gmail')} className={`flex-1 py-3 rounded-xl text-[10px] font-black ${activeTab === 'gmail' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>GMAIL</button>
      </div>

      {activeTab === 'cards' && (
        <div className="space-y-4">
          <button onClick={() => cameraRef.current.click()} className="w-full border-4 border-dashed border-slate-200 aspect-video rounded-[2rem] bg-white flex flex-col items-center justify-center">
            <span className="text-5xl mb-4">??</span>
            <span className="font-black text-slate-700 uppercase text-[10px]">Scan Business Card</span>
          </button>
          <input type="file" accept="image/*" ref={cameraRef} className="hidden" onChange={processCard} />
          {isProcessing && <div className="text-center animate-pulse text-[#009640] font-black text-[10px]">AI EXTRACTING...</div>}
          {cards.map(card => (
            <div key={card.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <input className="w-full font-black text-slate-900 text-lg mb-4 border-b border-slate-50" value={card.name} onChange={(e) => setCards(cards.map(c => c.id === card.id ? {...c, name: e.target.value} : c))} />
              <div className="text-xs text-slate-500 space-y-2 mb-6">
                <p>?? {card.phone || "---"}</p>
                <p>?? {card.email || "---"}</p>
              </div>
              <button onClick={() => downloadVCF(card)} className="w-full bg-[#009640] text-white py-4 rounded-2xl font-black text-xs">ADD TO CONTACTS</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="text-[9px] text-slate-400 font-bold uppercase">{row.date}</div>
              <div className="font-black text-slate-800 text-sm mb-4">{row.desc}</div>
              <div className="flex justify-end"><span className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-black text-sm">S$ {row.sgd.toFixed(2)}</span></div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-center py-20 text-slate-300 text-[10px] font-black">NO CLAIMS ADDED</div>}
        </div>
      )}

      {activeTab === 'gmail' && (
        <div className="space-y-4">
          <button onClick={handleGmailSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs">
            {isSearching ? "SEARCHING..." : "SEARCH GMAIL RECEIPTS"}
          </button>
          {searchResults.map((res, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="text-[9px] text-blue-500 font-bold uppercase mb-1">{res.date}</div>
              <div className="text-xs font-black text-slate-800 mb-4 line-clamp-2">{res.subject}</div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="bg-slate-100 px-3 py-2 rounded-xl font-black text-xs">S$ {res.editAmount}</div>
                <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-6 py-2 rounded-xl text-[10px] font-black">ADD</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
