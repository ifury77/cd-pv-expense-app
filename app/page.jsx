'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('cards');
  const [cards, setCards] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

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
    // VCF Format 3.0 is most compatible with Google/iPhone
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${card.name}`,
      `TEL;TYPE=CELL:${card.phone}`,
      `EMAIL:${card.email}`,
      "END:VCARD"
    ].join("\n");
    
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${card.name.split(' ')[0]}.vcf`);
    
    // Append to body to ensure it works on all mobile browsers
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-8 py-4 rounded-3xl font-black">Login</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50">
      <div className="flex justify-between items-center mb-8 pt-4">
        <h1 className="text-[#009640] font-black text-xl">REDINGTON</h1>
        <button onClick={() => signOut()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-xl text-[11px] font-black ${activeTab === 'voucher' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-3 rounded-xl text-[11px] font-black ${activeTab === 'cards' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Cards</button>
      </div>

      {activeTab === 'cards' && (
        <div className="space-y-4">
          <button onClick={() => cameraRef.current.click()} className="w-full border-4 border-dashed border-slate-200 aspect-video rounded-[2rem] bg-white flex flex-col items-center justify-center active:bg-slate-50 transition-all">
            <span className="text-5xl mb-4">🪪</span>
            <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Scan Business Card</span>
          </button>
          <input type="file" accept="image/*" ref={cameraRef} className="hidden" onChange={processCard} />

          {isProcessing && <div className="text-center py-4 animate-pulse text-[#009640] font-black text-[10px] uppercase">AI Extracting...</div>}

          {cards.map(card => (
            <div key={card.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="text-[9px] text-slate-400 font-bold uppercase mb-4">Contact Details</div>
              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Name</label>
                  <input className="w-full border-b border-slate-100 focus:border-[#009640] p-0 font-black text-slate-900 text-lg focus:ring-0" value={card.name} onChange={(e) => setCards(cards.map(c => c.id === card.id ? {...c, name: e.target.value} : c))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Phone</label>
                  <input className="w-full border-b border-slate-100 focus:border-[#009640] p-0 font-black text-slate-900 text-lg focus:ring-0" value={card.phone} onChange={(e) => setCards(cards.map(c => c.id === card.id ? {...c, phone: e.target.value} : c))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Email</label>
                  <input className="w-full border-b border-slate-100 focus:border-[#009640] p-0 font-black text-slate-900 text-lg focus:ring-0" value={card.email} onChange={(e) => setCards(cards.map(c => c.id === card.id ? {...c, email: e.target.value} : c))} />
                </div>
              </div>
              <button onClick={() => downloadVCF(card)} className="w-full bg-[#009640] text-white py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all">
                Add to Contacts
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
