'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Page() {
  const { data: session } = useSession();
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [isGenerating, setIsGenerating] = useState(false);

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

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
      const a = document.createElement('a'); a.href = url; a.download = `PV_Ivan_Ong.pdf`; a.click();
    } catch (e) { alert("PDF Error"); }
    setIsGenerating(false);
  }

  if (!session) return <button onClick={() => signIn('google')}>Sign In</button>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between mb-8 items-center bg-white p-4 rounded-xl border">
        <h1 className="text-xl font-bold">Redington Expense Portal</h1>
        <button onClick={() => signOut()} className="text-xs text-red-400">Sign out</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          <table className="w-full text-sm border bg-white rounded-xl overflow-hidden">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-3 text-left">Details & Activity Description</th>
                <th className="p-3 text-right">SGD</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="p-3">
                    <div className="font-bold text-blue-600">{row.desc}</div>
                    <input 
                      className="w-full mt-1 p-1 border-b text-xs italic text-gray-600 focus:outline-none focus:border-blue-400" 
                      placeholder="Enter activity description (e.g. Meeting with ABC Corp)"
                      value={row.activity || ''}
                      onChange={(e) => updateRow(i, 'activity', e.target.value)}
                    />
                  </td>
                  <td className="p-3 text-right font-bold">S$ {row.sgd.toFixed(2)}</td>
                  <td className="p-3 text-right"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={generatePDF} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">
            {isGenerating ? "Generating..." : "Download PDF Voucher"}
          </button>
        </div>
      )}
    </div>
  );
}
