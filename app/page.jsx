"use client";

import { useState, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

/* ───────────────────────────────
   IMAGE COMPRESSION
────────────────────────────── */
async function compressImage(dataUrl, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");

      let w = img.width;
      let h = img.height;

      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.src = dataUrl;
  });
}

/* ───────────────────────────────
   SAMPLE DATA
────────────────────────────── */
const INITIAL_ITEMS = [
  {
    no: 1,
    date: "14 Apr 2026",
    desc: "Grab Car Ride",
    ref: "A-97GM4LKG",
    orig: "SGD 30.50",
    sgd: 30.5,
    receiptSource: "gmail",
  },
];

/* ───────────────────────────────
   MAIN COMPONENT
────────────────────────────── */
export default function Home() {
  const { data: session, status } = useSession();

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [tab, setTab] = useState("voucher");

  const [searchQ, setSearchQ] = useState("receipt OR invoice");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [generating, setGenerating] = useState(false);

  const attachInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [uploadingFor, setUploadingFor] = useState(null);

  /* ───────────────────────────────
     TOTAL
  ─────────────────────────────── */
  const total = items.reduce((sum, i) => sum + (Number(i.sgd) || 0), 0);

  /* ───────────────────────────────
     REMOVE ITEM
  ─────────────────────────────── */
  function removeItem(i) {
    setItems((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((it, idx) => ({ ...it, no: idx + 1 }))
    );
  }

  /* ───────────────────────────────
     OCR RESPONSE HANDLER (FIXED)
  ─────────────────────────────── */
  async function extractFromImage(dataUrl, mediaType) {
    try {
      const base64 = dataUrl.split(",")[1];

      const res = await fetch("/api/receipt/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "OCR failed");
      }

      const d = json.data || {};

      // 🔥 FIXED MAPPING (this was your main bug)
      setAddForm((f) => ({
        ...f,
        date: d.date || "",
        desc: d.merchant || d.description || "",
        sgd: d.amount || d.sgd_amount || "",
        orig: d.original_amount || "",
        currency: d.currency || "SGD",
      }));
    } catch (err) {
      console.error(err);
      alert("OCR failed — please fill manually.");
    }
  }

  /* ───────────────────────────────
     ATTACH IMAGE TO ITEM
  ─────────────────────────────── */
  async function handleAttachFile(e) {
    const file = e.target.files?.[0];
    if (!file || uploadingFor === null) return;

    const reader = new FileReader();

    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result);

      setItems((prev) =>
        prev.map((it, i) =>
          i === uploadingFor
            ? { ...it, receiptImage: compressed }
            : it
        )
      );

      setUploadingFor(null);
    };

    reader.readAsDataURL(file);
  }

  /* ───────────────────────────────
     GMAIL SEARCH (FIXED)
  ─────────────────────────────── */
  async function searchGmail() {
    setSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(
        `/api/gmail/search?q=${encodeURIComponent(searchQ)}`
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSearchResults(data.results || []);
    } catch (err) {
      alert("Search failed: " + err.message);
    }

    setSearching(false);
  }

  /* ───────────────────────────────
     ADD FROM GMAIL
  ─────────────────────────────── */
  function addFromSearch(r) {
    const amt = parseFloat((r.amount || "0").replace(/[^0-9.]/g, ""));

    setItems((prev) => [
      ...prev,
      {
        no: prev.length + 1,
        date: r.date || "",
        desc: r.subject || "",
        ref: r.id?.slice(0, 10) || "—",
        sgd: amt || 0,
        orig: r.amount || "",
        receiptSource: "gmail",
      },
    ]);

    setTab("voucher");
  }

  /* ───────────────────────────────
     LOADING STATES
  ─────────────────────────────── */
  if (status === "loading") return <div>Loading...</div>;

  if (!session)
    return (
      <div className="p-10">
        <button onClick={() => signIn("google")}>
          Sign in with Google
        </button>
      </div>
    );

  /* ───────────────────────────────
     UI (kept minimal here)
────────────────────────────── */
  return (
    <div className="p-6">
      <h1>Expense App</h1>

      <div>Total: SGD {total.toFixed(2)}</div>

      {/* Gmail Search */}
      <div>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <button onClick={searchGmail}>
          {searching ? "Searching..." : "Search Gmail"}
        </button>
      </div>

      {/* Results */}
      {searchResults.map((r, i) => (
        <div key={i}>
          <div>{r.subject}</div>
          <button onClick={() => addFromSearch(r)}>Add</button>
        </div>
      ))}
    </div>
  );
}
