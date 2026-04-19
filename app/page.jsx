'use client';
import { useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LOGO_SVG = `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 170.1 36.9" style="enable-background:new 0 0 170.1 36.9;" xml:space="preserve"><style type="text/css">.st0{fill:#ED1C24;}.st1{fill:#009640;}.st2{fill:#F15A29;}</style><g><path class="st0" d="M33,18.5l-9.8,9.8V18.5c0-1.8,1.4-3.2,3.2-3.2h9.8C34.4,15.2,33,16.7,33,18.5"/><path class="st1" d="M13,28.3l9.8-9.8v9.8c0,1.8-1.4,3.2-3.2,3.2h-9.8C11.6,31.6,13,30.1,13,28.3"/><path class="st1" d="M33,3.3l-9.8,9.8V3.3c0-1.8,1.4-3.2,3.2-3.2h9.8C34.4,0,33,1.4,33,3.3"/><path class="st0" d="M13,13.2l9.8-9.8v9.8c0,1.8-1.4,3.2-3.2,3.2h-9.8C11.6,16.4,13,15,13,13.2"/><path class="st2" d="M3.2,28.3C1.4,28.3,0,26.9,0,25.1v-9.8l9.8,9.8v3.2H3.2z"/><path class="st2" d="M3.2,3.3C1.4,3.3,0,4.7,0,6.5v9.8l9.8-9.8V3.3H3.2z"/></g><g><path class="st1" d="M43.3,31.4V11.8h4.7v2.3c1.1-1.7,2.8-2.6,5-2.6c1.2,0,2.1,0.2,2.8,0.7s1.2,1,1.5,1.7s0.4,1.6,0.4,2.8v14.7h-4.7V18.2c0-1.2-0.2-2.1-0.7-2.7c-0.5-0.6-1.1-0.9-2-0.9s-1.5,0.3-2,0.8s-0.7,1.4-0.7,2.5v13.5H43.3z"/><path class="st1" d="M68.5,31.6c-2,0-3.6-0.5-4.8-1.4s-2.1-2.2-2.5-3.8l4.1-1.6c0.6,1.9,1.7,2.9,3.3,2.9c0.7,0,1.2-0.2,1.6-0.5s0.6-0.8,0.6-1.3c0-0.4-0.1-0.7-0.4-1c-0.3-0.3-0.7-0.5-1.3-0.7s-1.5-0.5-2.6-0.8s-2.1-0.6-2.9-1c-0.8-0.4-1.4-0.9-1.9-1.6s-0.6-1.5-0.6-2.6c0-1.5,0.5-2.8,1.6-3.8s2.5-1.5,4.3-1.5c1.6,0,2.9,0.4,3.9,1.1s1.7,1.7,2.1,3l-3.9,1.7c-0.6-1.4-1.5-2-2.6-2c-0.6,0-1.1,0.1-1.4,0.4s-0.5,0.6-0.5,1.1c0,0.4,0.1,0.7,0.4,0.9s0.7,0.4,1.2,0.6c0.6,0.2,1.4,0.4,2.5,0.7c1.1,0.3,2,0.6,2.8,1c0.8,0.4,1.5,0.9,1.9,1.6s0.6,1.6,0.6,2.7c0,1.6-0.6,3-1.7,4C71.8,31,70.3,31.6,68.5,31.6z"/><path class="st1" d="M84.3,31.6c-1.8,0-3.3-0.6-4.4-1.8s-1.7-2.9-1.7-5c0-1.3,0.3-2.5,0.8-3.5c0.5-1,1.3-1.9,2.2-2.5c1-0.6,2.1-0.9,3.4-0.9c1.6,0,2.9,0.5,3.8,1.5c0.9,1,1.4,2.4,1.4,4.2h-7c0.1,1.1,0.4,1.9,0.9,2.4s1.2,0.8,2.1,0.8c1.5,0,2.5-0.6,2.9-1.9l3.8,1.6c-0.3,0.9-0.8,1.7-1.5,2.4C87.8,30.9,86.3,31.6,84.3,31.6z M86.6,19.3c-0.4-0.6-1-1-1.9-1s-1.5,0.3-1.9,1c-0.4,0.6-0.7,1.5-0.7,2.6h5.2C87.3,20.8,87.1,19.9,86.6,19.3z"/><path class="st1" d="M101.4,31.4V11.8h4.7v1.8c1-1.3,2.4-2,4.1-2c0.3,0,0.6,0,0.8,0.1l-0.3,4.4c-0.4-0.1-0.8-0.1-1.2-0.1c-1.1,0-2.1,0.4-2.8,1.2c-0.7,0.8-1.1,2-1.1,3.6v10.6H101.4z"/><path class="st1" d="M117.5,31.4V2h4.7v29.4H117.5z"/><path class="st1" d="M129.5,31.4V11.8h4.7v2.3c1.1-1.7,2.8-2.6,5-2.6c1.2,0,2.1,0.2,2.8,0.7s1.2,1,1.5,1.7s0.4,1.6,0.4,2.8v14.7h-4.7V18.2c0-1.2-0.2-2.1-0.7-2.7c-0.5-0.6-1.1-0.9-2-0.9s-1.5,0.3-2,0.8s-0.7,1.4-0.7,2.5v13.5H129.5z"/><path class="st1" d="M152,36.9v-2c0-1.8,1.4-3.2,3.2-3.2h11.7c1.8,0,3.2,1.4,3.2,3.2v2"/></g></svg>`;

export default function Page() {
  const { data: session } = useSession();
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
          sgd: parseFloat(data.amount) || 0,
          image: base64Image,
          isEmail: false
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
      receiptHtml: emailHtml,
      image: null,
      isEmail: true
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

      const tableRows = rows.map((row, i) => [
        i + 1, row.date, row.desc, row.ref, `S$ ${row.sgd.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['No.', 'Date', 'Description', 'Reference / Booking ID', 'Amount (SGD)']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        foot: [[{ content: 'TOTAL CLAIM', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `S$ ${totalSgd.toFixed(2)}`, styles: { fontStyle: 'bold' } }]]
      });

      // LOOP THROUGH ROWS FOR ATTACHMENTS
      for (const [index, row] of rows.entries()) {
        if (row.image) {
          // It is a photo
          doc.addPage('a4', 'portrait');
          doc.setFontSize(12); doc.setTextColor(100);
          doc.text(`Attachment ${index + 1}: ${row.desc}`, 15, 20);
          doc.addImage(row.image, 'JPEG', 15, 30, 180, 0);
        } else if (row.isEmail && row.receiptHtml) {
          // It is a Gmail receipt
          doc.addPage('a4', 'portrait');
          doc.setFontSize(12); doc.setTextColor(100);
          doc.text(`Attachment ${index + 1} (Email): ${row.desc}`, 15, 20);
          
          // Use jsPDF's built-in html worker to render the email content
          await doc.html(row.receiptHtml, {
            callback: function(d) { /* handled by loop */ },
            x: 15,
            y: 30,
            width: 180,
            windowWidth: 800 // Scale email to fit
          });
        }
      }

      doc.save(`Voucher_Ivan_Ong.pdf`);
    } catch (e) { alert("PDF Error: " + e.message); }
    setIsGenerating(false);
  }

  if (!session) return <div className="flex h-screen items-center justify-center"><button onClick={() => signIn('google')} className="bg-[#009640] text-white px-10 py-4 rounded-xl font-bold">Sign In</button></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans">
      <div className="flex justify-between items-center mb-10 pb-6 border-b">
        <div dangerouslySetInnerHTML={{ __html: LOGO_SVG }} className="h-10 w-auto" />
        <button onClick={() => signOut()} className="text-[10px] font-bold text-slate-300 uppercase hover:text-red-500">Sign Out</button>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('voucher')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'voucher' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>My Voucher</button>
        <button onClick={() => setActiveTab('add')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'add' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>+ Take Photo</button>
        <button onClick={() => setActiveTab('search')} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white shadow text-[#009640]' : 'text-slate-500'}`}>Search Gmail</button>
      </div>

      {activeTab === 'voucher' && (
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-400 border-b uppercase text-[10px] tracking-widest font-bold">
                <th className="pb-4">Date</th>
                <th className="pb-4 w-1/2">Description</th>
                <th className="pb-4">Reference</th>
                <th className="pb-4 text-right">SGD</th>
                <th className="pb-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => (
                <tr key={i} className="group">
                  <td className="py-4"><input className="w-20 border-none bg-transparent" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)} /></td>
                  <td className="py-4">
                    <input className="w-full border-none bg-transparent font-bold text-slate-800" value={row.desc} onChange={e => updateRow(i, 'desc', e.target.value)} />
                    {row.receiptHtml && <button onClick={() => { const w = window.open(); w.document.write(row.receiptHtml); }} className="text-blue-500 text-[10px] block mt-1 underline uppercase font-bold">View Source Email</button>}
                  </td>
                  <td className="py-4"><input className="w-full border-none bg-transparent text-slate-500" value={row.ref} placeholder="Ref#" onChange={e => updateRow(i, 'ref', e.target.value)} /></td>
                  <td className="py-4 text-right">
                    <input className="w-20 border-none bg-green-50 rounded p-1 text-right font-black text-slate-900" type="number" step="0.01" value={row.sgd} onChange={e => updateRow(i, 'sgd', e.target.value)} />
                  </td>
                  <td className="py-4 text-right opacity-0 group-hover:opacity-100"><button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-red-300">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={generatePDF} className="mt-10 w-full bg-[#009640] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-green-100">
            {isGenerating ? "Rendering Email Attachments..." : "Download PDF Voucher"}
          </button>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => cameraInputRef.current.click()} className="p-20 border-4 border-dashed border-slate-100 rounded-[3rem] bg-white hover:bg-slate-50 flex flex-col items-center justify-center transition-all group">
            <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📸</span>
            <span className="font-bold text-slate-700 uppercase tracking-wider">Scan Receipt</span>
          </button>
          <input type="file" accept="image/*" ref={cameraInputRef} className="hidden" onChange={processImage} />
          {isProcessing && <div className="p-20 text-center animate-pulse text-[#009640] font-black uppercase tracking-widest">AI Analyzing...</div>}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="space-y-4">
          <button onClick={handleSearch} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">{isSearching ? "Searching Gmail..." : "Search Transport Receipts"}</button>
          {searchResults.map((res, i) => (
            <div key={i} className="p-5 border rounded-2xl flex justify-between items-center bg-white shadow-sm">
              <div className="w-2/3">
                <div className="text-[10px] text-blue-500 font-bold mb-1 uppercase tracking-tighter">{res.date}</div>
                <div className="text-sm font-bold truncate">{res.subject}</div>
                <div className="text-[10px] text-slate-400 italic truncate mt-1">{res.snippet}</div>
              </div>
              <div className="flex items-center gap-3">
                <input className="w-20 p-2 border rounded-lg text-right font-bold bg-slate-50" value={res.editAmount} onChange={e => {
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
