'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Page() {
  const { data: session, status } = useSession();
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
          ref: "",
          origAmt: "SGD " + (data.amount || "0.00"),
          sgd: parseFloat(data.amount) || 0,
          image: base64Image,
          receiptHtml: null
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
    let emailHtml = "";
    try {
      const res = await fetch(`/api/gmail/message?id=${item.id}`);
      const data = await res.json();
      emailHtml = data.html;
    } catch (e) {}
    
    setRows(prev => [...prev, {
      date: item.date || new Date().toLocaleDateString('en-GB'),
      desc: item.subject,
      ref: item.snippet?.match(/[A-Z0-9]{8,}/)?.[0] || "",
      origAmt: "SGD " + item.editAmount,
      sgd: parseFloat(item.editAmount) || 0,
      image: null,
      receiptHtml: emailHtml
    }]);
    setActiveTab('voucher');
  };

  async function generatePDF() {
    setIsGenerating(true);
    try {
      const doc = new jsPDF('landscape');
      
      // Page 1: VOUCHER TABLE
      doc.setFontSize(20);
      doc.setTextColor(0, 150, 64);
      doc.text('REDINGTON', 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text('PAYMENT VOUCHER', 14, 30);
      doc.text(`PAY TO: Ivan Ong`, 14, 36);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 250, 30);

      const tableRows = rows.map((row, i) => [
        i + 1,
        row.date,
        row.desc,
        row.ref,
        row.origAmt,
        `S$ ${row.sgd.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['No.', 'Date', 'Description', 'Reference / Booking ID', 'Orig. Amount', 'SGD']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        foot: [[ { content: 'TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `S$ ${totalSgd.toFixed(2)}`, styles: { fontStyle: 'bold' } } ]]
      });

      // Subsequent Pages: ATTACHMENTS (Only for photos)
      rows.forEach((row, index) => {
        if (row.image) {
          doc.addPage('a4', 'portrait');
          doc.setTextColor(100);
          doc.setFontSize(12);
          doc.text(`Attachment ${index + 1}: ${row.desc}`, 14, 20);
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0); 
        }
      });

      doc.save(`Voucher_Ivan_Ong.pdf`);
    } catch (e) { alert("PDF Error: " + e.message); }
    setIsGenerating(false);
  }

  if (status === "loading") return <div className="p-20 text-center">Loading...</div>;
  if (!session) return <div className="p-20 text-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-10 py-4 rounded-xl font-bold">Sign In</button></div>;

  return (
    <div className="max-w-6xl mx-auto p-4 font-sans">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border shadow-sm">
        <h1 className="text-2xl font-black text-[#009640]">REDINGTON</h1>
        <button onClick={() => signOut()} className="text-xs text-slate-400 font-bold uppercase">Sign out</button>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-6 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'voucher' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'add' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-6 py-2.5 rounded-xl text-sm font-bold ${activeTab === 'search' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b">
                <th className="p-3">Date</th>
                <th className="p-3 w-1/3">Description</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Orig. Amount</th>
                <th className="p-3 text-right">SGD</th>
                <th className="p-3 text-center">Receipt</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="p-3"><input className="w-20 border-none bg-transparent" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)} /></td>
                  <td className="p-3"><input className="w-full border-none bg-transparent font-bold" value={row.desc} onChange={e => updateRow(i, 'desc', e.target.value)} /></td>
                  <td className="p-3"><input className="w-full border-none bg-transparent" value={row.ref} onChange={e => updateRow(i, 'ref', e.target.value)} /></td>
                  <td className="p-3"><input className="w-24 border-none bg-transparent" value={row.origAmt} onChange={e => updateRow(i, 'origAmt', e.target.value)} /></td>
                  <td className="p-3 text-right"><input className="w-16 border-none bg-transparent text-right font-bold" type="number" value={row.sgd} onChange={e => updateRow(i, 'sgd', e.target.value)} /></td>
                  <td className="p-3 text-center">
                    {row.receiptHtml ? (
                      <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-600 font-bold underline">View Email</button>
                    ) : row.image ? (
                      <span className="text-green-600 font-bold text-[9px] uppercase italic">Screenshot Added</span>
                    ) : null}
                  </td>
                  <td className="p-3"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={generatePDF} className="mt-8 w-full bg-[#3182ce] text-white py-4 rounded-xl font-bold text-lg shadow-lg">
            {isGenerating ? "Attaching Screenshots..." : "Download Voucher PDF"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => cameraInputRef.current.click()} className="p-16 border-2 border-dashed border-slate-200 rounded-[2rem] bg-white hover:bg-slate-50 flex flex-col items-center">
            <span className="text-4xl mb-4">📸</span>
            <span className="font-bold text-slate-700">Take Photo / Upload</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="col-span-full text-center p-12 animate-pulse text-[#009640] font-black uppercase">AI Scanning...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">Search Gmail</button>
          {searchResults.map((res, i) => (
            <div key={i} className="p-4 border rounded-2xl flex justify-between items-center bg-white shadow-sm">
              <div className="w-2/3">
                <div className="text-[10px] text-blue-600 font-bold uppercase">{res.date}</div>
                <div className="text-sm font-bold truncate">{res.subject}</div>
              </div>
              <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-5 py-2 rounded-xl text-xs font-bold">Add</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
