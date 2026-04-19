'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export default function Page() {
  const { data: session } = useSession();
  const cameraInputRef = useRef(null);
  const emailRenderRef = useRef(null);
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
          sgd: parseFloat(data.amount) || 0,
          image: base64Image,
          html: null
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
      setSearchResults((data.results || []).map(r => {
        const amtMatch = r.snippet?.match(/(?:SGD|S\$|Total|Charged|Fee)\s?S?\$?\s?([\d.,]+)/i);
        return { ...r, editAmount: amtMatch ? amtMatch[1].replace(/,/g, '') : "0.00" };
      }));
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
      sgd: parseFloat(item.editAmount) || 0,
      image: null,
      html: emailHtml
    }]);
    setActiveTab('voucher');
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

      autoTable(doc, {
        startY: 45,
        head: [['No.', 'Date', 'Description', 'Reference', 'Amount (SGD)']],
        body: rows.map((row, i) => [i + 1, row.date, row.desc, row.ref, `S$ ${row.sgd.toFixed(2)}`]),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        foot: [[{ content: 'TOTAL CLAIM', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `S$ ${totalSgd.toFixed(2)}`, styles: { fontStyle: 'bold' } }]]
      });

      // ATTACHMENTS LOOP
      for (const [index, row] of rows.entries()) {
        doc.addPage('a4', 'portrait');
        doc.setFontSize(12); doc.setTextColor(100);
        doc.text(`Attachment ${index + 1}: ${row.desc}`, 15, 20);

        if (row.image) {
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0);
        } else if (row.html) {
          // Convert HTML to Image for PDF stability
          const container = document.createElement('div');
          container.style.width = '800px';
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.innerHTML = row.html;
          document.body.appendChild(container);
          const canvas = await html2canvas(container, { useCORS: true, scale: 1 });
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          doc.addImage(imgData, 'JPEG', 15, 30, 180, 0);
          document.body.removeChild(container);
        }
      }

      doc.save(`Voucher_Ivan_Ong.pdf`);
    } catch (e) { alert("PDF Error: " + e.message); }
    setIsGenerating(false);
  }

  if (!session) return <div className="flex h-screen items-center justify-center p-6 bg-white"><button onClick={() => signIn('google')} className="w-full max-w-sm bg-[#009640] text-white py-4 rounded-2xl font-bold">Sign In</button></div>;

  return (
    <div className="max-w-full md:max-w-4xl mx-auto p-4 md:p-6 font-sans bg-slate-50 min-h-screen">
      <div className="flex flex-col mb-6 pt-2">
        <h1 className="text-[#009640] font-black text-xl leading-none">REDINGTON</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Payment Voucher</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-xl w-full">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-3 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>+ Upload</button>
        <button onClick={() => setActiveTab('search')} className={`flex-1 py-3 rounded-lg text-[11px] font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4 pb-32">
          {rows.map((row, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border shadow-sm relative">
              <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-slate-300">✕</button>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{row.date}</div>
              <input className="w-full border-none p-0 font-bold text-slate-800 text-sm focus:ring-0" value={row.desc} onChange={e => updateRow(i, 'desc', e.target.value)} />
              
              {row.html && (
                <button onClick={() => { const w = window.open(); w.document.write(row.html); }} className="text-blue-500 text-[10px] font-bold uppercase mt-2 block">View Email Source</button>
              )}

              <div className="flex justify-between items-end mt-4">
                <span className="text-[9px] font-bold text-green-600 uppercase italic">{(row.image || row.html) ? "✓ Attachment Linked" : "No Attachment"}</span>
                <div className="flex items-center bg-green-50 px-3 py-1 rounded-lg">
                  <span className="text-[10px] font-bold text-green-700 mr-2">SGD</span>
                  <input className="w-16 bg-transparent border-none p-0 text-right font-black text-slate-900 focus:ring-0" type="number" step="0.01" value={row.sgd} onChange={e => updateRow(i, 'sgd', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={generatePDF} className="fixed bottom-6 left-4 right-4 bg-[#009640] text-white py-4 rounded-2xl font-black text-lg shadow-xl z-10">
            {isGenerating ? "Capturing Attachments..." : "Download PDF"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="flex flex-col gap-4">
          <button onClick={() => cameraInputRef.current.click()} className="aspect-square w-full border-4 border-dashed border-slate-200 rounded-[2.5rem] bg-white flex flex-col items-center justify-center">
            <span className="text-5xl mb-4">📸</span>
            <span className="font-bold text-slate-700 uppercase tracking-wider text-sm">Upload Photo / Snip</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">
            {isSearching ? "Searching..." : "🔍 Search Gmail"}
          </button>
          {searchResults.map((res, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border mb-3">
              <div className="text-[9px] text-blue-500 font-bold mb-1">{res.date}</div>
              <div className="text-sm font-bold text-slate-800 mb-3">{res.subject}</div>
              <div className="flex justify-between items-center pt-3 border-t">
                <div className="bg-slate-50 px-3 py-1 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 mr-2">S$</span>
                  <input className="w-16 bg-transparent border-none p-0 font-bold text-slate-900 text-sm" value={res.editAmount} onChange={e => {
                    const updated = [...searchResults];
                    updated[i].editAmount = e.target.value;
                    setSearchResults(updated);
                  }} />
                </div>
                <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-6 py-2 rounded-xl text-xs font-bold">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
