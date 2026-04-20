'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('voucher');
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
        setActiveTab('cards');
      } catch (err) { alert("Card scan failed."); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const downloadVCF = (card) => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${card.name}
TEL;TYPE=CELL:${card.phone}
EMAIL:${card.email}
END:VCARD`;
    
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${card.name.replace(/\s+/g, '_')}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-8 py-4 rounded-3xl font-black">Login to Redington</button></div>;

  return (
    <div className="max-w-md mx-auto p-4 font-sans min-h-screen bg-slate-50">
      <div className="flex justify-between mb-6">
        <h1 className="text-[#009640] font-black text-xl">REDINGTON</h1>
        <button onClick={() => signOut()} className="text-[10px] font-bold text-slate-400">LOGOUT</button>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-xl">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-2 rounded-lg text-[11px] font-bold ${activeTab === 'voucher' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('cards')} className={`flex-1 py-2 rounded-lg text-[11px] font-bold ${activeTab === 'cards' ? 'bg-white text-[#009640]' : 'text-slate-500'}`}>Contacts</button>
      </div>

      {activeTab === 'cards' && (
        <div className="space-y-4">
          <button onClick={() => cameraRef.current.click()} className="w-full border-2 border-dashed border-slate-300 py-8 rounded-2xl bg-white font-bold text-slate-500">
            {isProcessing ? "Reading Card..." : "📸 Scan Business Card"}
          </button>
          <input type="file" accept="image/*" ref={cameraRef} className="hidden" onChange={processCard} />

          {cards.map(card => (
            <div key={card.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <input className="text-lg font-black text-slate-800 w-full mb-1" value={card.name} onChange={(e) => {
                const updated = cards.map(c => c.id === card.id ? {...c, name: e.target.value} : c);
                setCards(updated);
              }} />
              <div className="text-sm text-slate-500 mb-4">
                <p>📞 {card.phone || "No Phone Found"}</p>
                <p>📧 {card.email || "No Email Found"}</p>
              </div>
              <button onClick={() => downloadVCF(card)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">
                Save to Contacts (.vcf)
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* (You can still keep your Voucher logic here below if needed) */}
    </div>
  );
}
