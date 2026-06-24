export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("❌ API Key TIDAK DITEMUKAN");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Kunci API tidak ditemukan"
      });
    }

    console.log("🔍 Memproses dengan kunci API...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analisis apakah teks berikut ini berisi hoaks, valid, atau perlu verifikasi. Berikan penjelasan yang jelas.

Balas HANYA dalam format JSON, tanpa teks lain, tanpa awalan \`\`\`json:
{
  "status": "hoax | valid | neutral",
  "message": "Ringkasan kesimpulan",
  "confidence": angka antara 0 sampai 100,
  "reasons": ["Alasan 1", "Alasan 2"],
  "explanation": "Penjelasan lengkap untuk bagian Analisis"
}

Teks:
${text}
`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      console.error("❌ Gagal terhubung ke Gemini:", response.status, errorDetail);
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: `Gagal terhubung ke AI (kode: ${response.status})`
      });
    }

    const data = await response.json();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.warn("❌ Respon dari AI kosong");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Respon AI kosong"
      });
    }

    const clean = aiText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(clean);

    console.log("✅ Berhasil dapat hasil dari Gemini!");
    return Response.json({
      ...parsed,
      source: "gemini"
    });

  } catch (error) {
    console.error("❌ Kesalahan proses:", error);
    return Response.json(
      {
        ...fallbackCheck(""),
        note: "Terjadi kesalahan sistem"
      },
      { status: 500 }
    );
  }
}

function fallbackCheck(input: string) {
  if (!input) {
    return {
      status: "neutral",
      message: "⚠️ Input tidak valid.",
      confidence: 0,
      reasons: [],
      explanation: "Masukkan teks berita yang ingin diperiksa."
    };
  }

  const lower = input.toLowerCase().replace(/[^\w\s]/g, "").trim();
  let scoreHoax = 0;
  let scoreValid = 0;
  const reasons: string[] = [];

  const hoaxPatterns = ["chip", "5g", "konspirasi", "elite global", "agenda rahasia", "tidak diberitakan media", "dokter disembunyikan", "ditutup-tutupi", "bohong pemerintah"];
  hoaxPatterns.forEach(p => lower.includes(p) && (scoreHoax += 2, reasons.push(`Klaim mencurigakan: "${p}"`)));

  const sensational = ["viral", "heboh", "100%", "pasti", "terbukti", "dijamin"];
  sensational.forEach(w => lower.includes(w) && (scoreHoax += 1, reasons.push(`Bahasa berlebihan: "${w}"`)));

  const validPatterns = ["penelitian", "studi", "data", "who", "kemenkes", "kemenkominfo", "ilmiah", "jurnal", "dokter", "berita resmi"];
  validPatterns.forEach(p => lower.includes(p) && (scoreValid += 2, reasons.push(`Sumber terpercaya: "${p}"`)));

  if (lower.length < 20) reasons.push("Teks terlalu pendek");

  const total = scoreHoax + scoreValid;
  const confidence = total === 0 ? 50 : Math.min(Math.round((Math.abs(scoreHoax - scoreValid) / total) * 100), 95);

  let status: "hoax" | "valid" | "neutral";
  let message = "";

  if (scoreHoax > scoreValid + 1) {
    status = "hoax";
    message = "⚠️ Kemungkinan Besar Hoaks";
  } else if (scoreValid > scoreHoax + 1) {
    status = "valid";
    message = "✅ Cenderung Valid";
  } else {
    status = "neutral";
    message = "ℹ️ Perlu Verifikasi";
  }

  return {
    status,
    message,
    confidence,
    reasons,
    explanation: "Belum bisa terhubung ke AI, menampilkan hasil pemeriksaan dasar."
  };
}