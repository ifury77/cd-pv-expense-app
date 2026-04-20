'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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
        
        // Improved data fallback
        setRows(prev => [...prev, {
          date: data.date || new Date().toLocaleDateString('en-GB'),
          desc: data.description || data.desc || "Scanned Receipt",
          ref: data.reference || "",
          sgd: parseFloat(data.amount) || 0,
          image: base64Image,
          html: null
        }]);
        setActiveTab('voucher');
      } catch (err) { 
        // Fallback row if AI fails completely
        setRows(prev => [...prev, {
          date: new Date().toLocaleDateString('en-GB'),
          desc: "New Receipt (Manual Edit)",
          ref: "",
          sgd: 0,
          image: base64Image,
          html: null
        }]);
        setActiveTab('voucher');
      }
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
        body: rows.map((row, i) => [i + 1, row.date, row.desc, row.ref, `S$ ${parseFloat(row.sgd).toFixed(2)}`]),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        foot: [[{ content: 'TOTAL CLAIM', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `S$ ${totalSgd.toFixed(2)}`, styles: { fontStyle: 'bold' } }]]
      });

      for (const [index, row] of rows.entries()) {
        doc.addPage('a4', 'portrait');
        doc.setFontSize(12); doc.setTextColor(100);
        doc.text(`Attachment ${index + 1}: ${row.desc}`, 15, 20);

        if (row.image) {
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0);
        } else if (row.html) {
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

  if (status === "loading") return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading...</div>;
  
  if (!session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 bg-white text-center">
        <h1 className="text-[#009640] font-black text-4xl tracking-tighter">REDINGTON</h1>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-12">Voucher Portal</p>
        <button onClick={() => signIn('google')} className="w-full max-w-sm bg-[#009640] text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-green-100">
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-full md:max-w-4xl mx-auto p-4 md:p-6 font-sans bg-slate-50 min-h-screen pb-32">
      <div className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-[#009640] font-black text-xl leading-none">REDINGTON</h1>
          <p className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-1">Payment Voucher</p>
        </div>
        <button onClick={() => signOut()} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase shadow-sm">Log Out</button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-200 p-1 rounded-2xl w-full">
        <button onClick={() => setActiveTab('voucher')} className={`flex-1 py-3.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'voucher' ? 'bg-white shadow-sm text-[#009640]' : 'text-slate-500'}`}>My Claims</button>
        <button onClick={() => setActiveTab('add')} className={`flex-1 py-3.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'add' ? 'bg-white shadow-sm text-[#009640]' : 'text-slate-500'}`}>+ Photo</button>
        <button onClick={() => setActiveTab('search')} className={`flex-1 py-3.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'search' ? 'bg-white shadow-sm text-[#009640]' : 'text-slate-500'}`}>Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative">
              <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="absolute top-5 right-5 text-slate-300 w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full">✕</button>
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{row.date}</div>
              
              {/* Editable Description */}
              <input 
                className="w-full border-b border-transparent hover:border-slate-100 focus:border-[#009640] p-0 font-black text-slate-900 text-lg focus:ring-0 mb-1 transition-colors" 
                value={row.desc} 
                onChange={e => updateRow(i, 'desc', e.target.value)} 
                placeholder="Description"
              />
              
              {row.html && <button onClick={() => { const w = window.open(); w.document.write(row.html); }} className="text-blue-500 text-[10px] font-bold uppercase underline decoration-2 underline-offset-4">View Email</button>}
              
              <div className="flex justify-between items-end mt-6">
                <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter italic">{(row.image || row.html) ? "● Attached" : "○ No File"}</span>
                <div className="flex items-center bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                  <span className="text-[10px] font-black text-green-700 mr-3">SGD</span>
                  <input 
                    className="w-20 bg-transparent border-none p-0 text-right font-black text-slate-900 text-xl focus:ring-0" 
                    type="number" 
                    step="0.01" 
                    value={row.sgd} 
                    onChange={e => updateRow(i, 'sgd', e.target.value)} 
                  />
                </div>
              </div>
            </div>
          ))}
          
          <button onClick={generatePDF} className="fixed bottom-8 left-6 right-6 bg-[#009640] text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-green-200 z-50">
            {isGenerating ? "Creating PDF..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="flex flex-col gap-4">
          <button onClick={() => cameraInputRef.current.click()} className="aspect-square w-full border-4 border-dashed border-slate-200 rounded-[3rem] bg-white flex flex-col items-center justify-center active:bg-slate-50 transition-all">
            <span className="text-6xl mb-6">📸</span>
            <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Snap Receipt</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="text-center py-8 animate-pulse text-[#009640] font-black text-[10px] uppercase tracking-[0.3em]">AI OCR Reading...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} disabled={isSearching} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black shadow-lg">
            {isSearching ? "Searching Gmail..." : "🔍 Search Receipts"}
          </button>
          {searchResults.map((res, i) => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="text-[10px] text-blue-500 font-bold mb-1 uppercase">{res.date}</div>
              <div className="text-sm font-black text-slate-800 mb-4 leading-tight">{res.subject}</div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="bg-slate-100 px-4 py-2 rounded-xl">
                  <span className="text-[10px] font-black text-slate-400 mr-2">S$</span>
                  <input className="w-16 bg-transparent border-none p-0 font-black text-slate-900 text-base focus:ring-0" value={res.editAmount} onChange={e => {
                    const updated = [...searchResults];
                    updated[i].editAmount = e.target.value;
                    setSearchResults(updated);
                  }} />
                </div>
                <button onClick={() => addFromGmail(res)} className="bg-[#009640] text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-md">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
