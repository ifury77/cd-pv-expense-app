'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Page() {
  const { data: session } = useSession();
  const cameraInputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalSgd = rows.reduce((sum, row) => sum + (parseFloat(row.sgd) || 0), 0);

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const processImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image })
        });
        const data = await res.json();
        setRows(prev => [...prev, {
          date: data.date || new Date().toLocaleDateString('en-GB'),
          desc: data.desc || "Scanned Receipt",
          ref: "",
          sgd: parseFloat(data.amount) || 0,
          image: base64Image
        }]);
        setActiveTab('voucher');
      } catch (err) { alert("AI Scan failed."); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  async function generatePDF() {
    setIsGenerating(true);
    try {
      const doc = new jsPDF('landscape');
      doc.setFontSize(18); doc.setTextColor(0, 150, 64);
      doc.text('REDINGTON', 14, 18);
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text('PAYMENT VOUCHER', 14, 30);
      doc.text(`PAY TO: Ivan Ong`, 14, 36);
      doc.text(`DATE: ${new Date().toLocaleDateString('en-GB')}`, 250, 30);

      const tableRows = rows.map((row, i) => [
        i + 1, row.date, row.desc, row.ref, `S$ ${row.sgd.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['No.', 'Date', 'Description', 'Reference', 'Amount (SGD)']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        foot: [[{ content: 'TOTAL CLAIM', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `S$ ${totalSgd.toFixed(2)}`, styles: { fontStyle: 'bold' } }]]
      });

      rows.forEach((row, index) => {
        if (row.image) {
          doc.addPage('a4', 'portrait');
          doc.setFontSize(12); doc.setTextColor(100);
          doc.text(`Attachment ${index + 1}: ${row.desc}`, 15, 20);
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0); 
        }
      });

      doc.save(`Voucher_Ivan_Ong.pdf`);
    } catch (e) { alert("PDF Error: " + e.message); }
    setIsGenerating(false);
  }

  if (!session) return <div className="flex h-screen items-center justify-center p-6"><button onClick={() => signIn('google')} className="w-full max-w-sm bg-[#009640] text-white py-4 rounded-2xl font-bold shadow-lg">Sign In with Google</button></div>;

  return (
    <div className="max-w-full md:max-w-4xl mx-auto p-4 md:p-6 font-sans bg-slate-50 min-h-screen">
      {/* Top Left Header */}
      <div className="flex flex-col mb-6 pt-2">
        <h1 className="text-[#009640] font-black text-xl tracking-tight leading-none">REDINGTON</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Payment Voucher</p>
      </div>

      {/* Tabs - Centered for iOS */}
      <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-xl w-full">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>+ Add Receipt</button>
        <button onClick={() => signOut()} className="px-4 py-3 text-slate-400 text-[10px] font-bold uppercase">Exit</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative">
                <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-slate-300">✕</button>
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{row.date}</div>
                <input className="w-full border-none p-0 font-bold text-slate-800 text-sm mb-2 focus:ring-0" value={row.desc} onChange={e => updateRow(i, 'desc', e.target.value)} />
                <div className="flex justify-between items-end mt-4">
                   <div className="text-[10px] text-green-600 font-bold italic">{row.image ? "✓ Attached" : ""}</div>
                   <div className="flex items-center bg-green-50 px-3 py-1 rounded-lg">
                      <span className="text-[10px] font-bold text-green-700 mr-2">SGD</span>
                      <input className="w-16 bg-transparent border-none p-0 text-right font-black text-slate-900 focus:ring-0" type="number" step="0.01" value={row.sgd} onChange={e => updateRow(i, 'sgd', e.target.value)} />
                   </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No receipts added yet.</div>}
          </div>

          {/* Desktop Table Layout (hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-3xl border p-6">
            <table className="w-full text-xs text-left">
              <thead><tr className="text-slate-400 border-b text-[10px] font-bold uppercase tracking-widest"><th className="pb-4">Date</th><th className="pb-4 w-1/2">Description</th><th className="pb-4 text-right">SGD</th><th className="pb-4"></th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row, i) => (
                  <tr key={i} className="group">
                    <td className="py-4 text-slate-500">{row.date}</td>
                    <td className="py-4 font-bold text-slate-800">{row.desc}</td>
                    <td className="py-4 text-right font-black">S$ {row.sgd.toFixed(2)}</td>
                    <td className="py-4 text-right"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-red-300">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={generatePDF} className="fixed bottom-6 left-4 right-4 md:relative md:bottom-0 md:left-0 md:mt-6 bg-[#009640] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-200">
            {isGenerating ? "Creating PDF..." : "Download PDF"}
          </button>
          <div className="h-20 md:hidden"></div> {/* Spacer for fixed button */}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="flex flex-col gap-4">
          <button onClick={() => cameraInputRef.current.click()} className="aspect-square w-full border-4 border-dashed border-slate-200 rounded-[2.5rem] bg-white flex flex-col items-center justify-center active:bg-slate-50 transition-colors">
            <span className="text-5xl mb-4">📸</span>
            <span className="font-bold text-slate-700 uppercase tracking-wider text-sm">Capture Receipt</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="text-center py-4 animate-pulse text-[#009640] font-bold text-xs uppercase tracking-widest">AI Scanning...</div>}
        </div>
      )}
    </div>
  );
}
