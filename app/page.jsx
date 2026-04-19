'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session } = useSession();
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraInputRef = useRef(null);

  const handleOcr = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result })
        });
        const data = await res.json();
        
        // AUTO-ADD TO TABLE
        const newEntry = {
          date: data.date,
          desc: data.desc,
          activity: "",
          sgd: parseFloat(data.amount) || 0,
        };
        
        setRows(prev => [...prev, newEntry]);
        setActiveTab('voucher'); // Switch back to view the table
      } catch (err) {
        alert("Could not extract info. Try a clearer photo.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!session) return <div className="p-10 text-center"><button onClick={() => signIn('google')} className="bg-blue-600 text-white p-4 rounded">Sign In</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Redington Expense</h1>
        <div className="flex gap-4">
          <button onClick={() => setActiveTab('voucher')} className={`p-2 ${activeTab === 'voucher' ? 'border-b-2 border-blue-600 font-bold' : ''}`}>My Voucher</button>
          <button onClick={() => setActiveTab('add')} className={`p-2 ${activeTab === 'add' ? 'border-b-2 border-blue-600 font-bold' : ''}`}>+ Snap Receipt</button>
        </div>
      </div>

      {activeTab === 'add' && (
        <div className="text-center p-20 border-2 border-dashed rounded-3xl bg-white">
          {isProcessing ? (
            <div className="animate-pulse text-blue-600 font-bold text-xl">🤖 AI is reading & adding to voucher...</div>
          ) : (
            <button onClick={() => cameraInputRef.current.click()} className="bg-blue-600 text-white px-10 py-5 rounded-2xl text-xl font-bold">📸 TAKE PHOTO</button>
          )}
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleOcr} />
        </div>
      )}

      {activeTab === 'voucher' && (
        <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-900 text-white">
            <tr><th className="p-4 text-left">Description & Activity</th><th className="p-4 text-right">Amount (SGD)</th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="p-4">
                  <div className="font-bold">{row.desc}</div>
                  <input 
                    placeholder="Describe activity..." 
                    className="w-full text-xs text-blue-600 border-b border-transparent focus:border-blue-200 outline-none"
                    value={row.activity}
                    onChange={(e) => {
                      const updated = [...rows];
                      updated[i].activity = e.target.value;
                      setRows(updated);
                    }}
                  />
                </td>
                <td className="p-4 text-right font-bold">S$ {row.sgd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
