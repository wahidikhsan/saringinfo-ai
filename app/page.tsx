"use client";
import { useState } from "react";

type Status = "hoax" | "neutral" | "valid" | null;

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);

  const checkHoax = async () => {
    if (!text.trim()) {
      setResult("⚠️ Masukkan teks terlebih dahulu.");
      setStatus("neutral");
      return;
    }

    setLoading(true);
    setResult("Menganalisis...");
    setStatus(null);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("API error");
      }

      const data = await res.json();

      // ✅ Ambil dari backend (sudah structured)
      setResult(`
${data.message}

📊 Tingkat keyakinan: ${data.confidence}%

🧠 Analisis:
- ${data.reasons.join("\n- ")}
      `);

      setStatus(data.status);

      if (data.source === "fallback") {
        console.log("⚠️ Mode offline (fallback aktif)");
      }
    } catch (error) {
      console.error("Error:", error);
      setResult("❌ Terjadi error saat analisis.");
      setStatus("hoax");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-800 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-gray-900/80 backdrop-blur-lg border border-gray-700 p-6 rounded-2xl shadow-2xl">

        <h1 className="text-3xl font-bold text-center mb-2 tracking-wide">
          🛡️ SaringInfo AI 🛡️
        </h1>

        <p className="text-center text-gray-400 mb-6">
          Deteksi Hoaks & Literasi Digital Berbasis AI
        </p>

        <textarea
          placeholder="Tempel berita atau komentar di sini..."
          className="w-full h-32 p-4 rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          onClick={checkHoax}
          disabled={loading}
          className={`w-full mt-4 px-4 py-3 rounded-xl font-semibold transition-all
            ${
              loading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-linear-to-r from-blue-600 to-blue-500 hover:scale-105 hover:shadow-lg"
            }`}
        >
          {loading ? "⏳ Menganalisis..." : "🔍 Cek Sekarang"}
        </button>

        {result && (
          <div
            className={`mt-6 p-4 rounded-xl text-center font-medium whitespace-pre-line transition-all duration-300 ${
              status === "hoax"
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : status === "valid"
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            }`}
          >
            <p className="text-lg">
              {status === "hoax"
                ? "❌"
                : status === "valid"
                ? "✅"
                : "⚠️"}{" "}
            </p>

            <p className="mt-2">{result}</p>

            <p className="text-xs text-gray-400 mt-4">
              Hasil ini berdasarkan analisis AI sederhana
            </p>
            <p className="text-xs text-gray-400">
              Tugas Pendidikan Pancasila Kelompok 3
            </p>
            <p className="text-xs text-gray-400">
              UNIPMA Madiun
            </p>
          </div>
        )}
      </div>
    </main>
  );
}