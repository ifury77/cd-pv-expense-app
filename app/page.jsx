'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Page() {
  const { data: session, status } = useSession();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('voucher');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
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
          activity: "",
          sgd: parseFloat(data.amount) || 0,
          image: base64Image
        }]);
        setActiveTab('voucher');
      } catch (err) { alert("AI Scan failed."); }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  async function handleSearch() {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/gmail/search?q=tada OR grab OR receipt`);
      const data = await res.json();
      setSearchResults((data.results || []).map(r => ({
        ...r, 
        editAmount: r.snippet?.match(/(?:SGD|S\$|Total|Charged)\s?([\d.,]+)/i)?.[1].replace(/,/g, '') || "0.00"
      })));
    } catch (e) {}
    setIsSearching(false);
  }

  const addFromGmail = async (item) => {
    setRows(prev => [...prev, {
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      activity: "",
      sgd: parseFloat(item.editAmount) || 0,
      image: null
    }]);
    setActiveTab('voucher');
  };

  async function generatePDF() {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      
      // BRANDING
      doc.setFontSize(22);
      doc.setTextColor(0, 150, 64);
      doc.text('REDINGTON', 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('PAYMENT VOUCHER', 14, 28);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 160, 28);

      const tableRows = rows.map(row => [
        { content: `${row.desc}\n(${row.activity || 'No activity description'})`, styles: { fontSize: 9 } },
        { content: `S$ ${row.sgd.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]);

      // Using the standalone autoTable function which is more reliable in Next.js
      autoTable(doc, {
        startY: 35,
        head: [['Details & Activity Description', 'Amount']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [26, 32, 44], textColor: [255, 255, 255] },
        foot: [[
          { content: 'TOTAL CLAIM', styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `S$ ${totalSgd.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        footStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0] }
      });

      // ATTACHMENTS
      rows.forEach((row, index) => {
        if (row.image) {
          doc.addPage();
          doc.setTextColor(100); doc.setFontSize(12);
          doc.text(`Attachment ${index + 1}: ${row.desc}`, 14, 20);
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0); 
        }
      });

      doc.save(`Voucher_Ivan_Ong.pdf`);
    } catch (e) { 
      console.error(e);
      alert("PDF Error: " + e.message); 
    }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="p-20 text-center font-bold">Loading...</div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-10 py-4 rounded-2xl font-black shadow-xl">Sign In to Redington</button></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-[#009640] tracking-tighter">REDINGTON</h1>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Expense Portal</span>
        </div>
        <button onClick={() => signOut()} className="text-[10px] text-slate-300 hover:text-red-500 font-bold uppercase">Sign out</button>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a202c] text-white">
                <tr>
                  <th className="p-4 text-left font-bold uppercase text-[10px]">Details & Activity</th>
                  <th className="p-4 text-right font-bold uppercase text-[10px]">SGD</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr><td colSpan="3" className="p-16 text-center text-slate-300 italic">No items.</td></tr>
                ) : rows.map((row, i) => (
                  <tr key={i}>
                    <td className="p-4">
                       <div className="font-bold text-slate-800">{row.desc}</div>
                       <div className="text-[10px] text-slate-400 mb-2 uppercase font-bold">{row.date}</div>
                       <input 
                         className="w-full p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-xs italic" 
                         placeholder="Describe activity..."
                         value={row.activity || ''}
                         onChange={(e) => updateRow(i, 'activity', e.target.value)}
                       />
                    </td>
                    <td className="p-4 text-right font-black">S$ {(row.sgd || 0).toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-slate-200 hover:text-red-500 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold">
                <tr>
                  <td className="p-5 text-right uppercase text-[10px]">Total Claim</td>
                  <td className="p-5 text-right text-xl">S$ {totalSgd.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={generatePDF} disabled={rows.length === 0 || isGenerating} className="w-full bg-[#3182ce] hover:bg-[#2b6cb0] text-white py-5 rounded-2xl font-black text-lg shadow-xl">
            {isGenerating ? "Processing..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => cameraInputRef.current.click()} className="p-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white flex flex-col items-center">
            <span className="text-4xl mb-4">📸</span>
            <span className="font-bold text-slate-700">Take Photo / Upload</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="col-span-full text-center p-12 animate-pulse text-[#009640] font-black uppercase tracking-widest text-sm">AI Scanning...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">Search Gmail</button>
          {searchResults.map((res, i) => (
            <div key={i} className="p-4 border rounded-2xl flex justify-between items-center bg-white">
              <div className="w-2/3">
                <div className="text-[10px] text-blue-600 font-bold uppercase">{res.date}</div>
                <div className="text-sm font-bold truncate">{res.subject}</div>
              </div>
              <div className="flex gap-2 items-center">
                <input className="border w-20 p-2 text-xs font-bold rounded-xl" value={res.editAmount} onChange={e => {
                  const updated = [...searchResults];
                  updated[i].editAmount = e.target.value;
                  setSearchResults(updated);
                }} />
                <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-5 py-2 rounded-xl text-xs font-bold">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
