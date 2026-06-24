export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("❌ API Key tidak ditemukan, pakai mode cadangan");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Kunci API belum diatur"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analisis apakah teks berikut ini hoaks, valid, atau perlu verifikasi.

Balas HANYA dalam format JSON, tanpa teks lain, tanpa awalan kode:
{
  "status": "hoax | valid | neutral",
  "message": "Ringkasan kesimpulan",
  "confidence": angka antara 0 sampai 100,
  "reasons": ["Alasan 1", "Alasan 2"],
  "explanation": "Penjelasan lengkap untuk bagian Analisis"
}

Teks:
${text}
`
            }]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("❌ Gagal hubung ke Gemini:", response.status, err);
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Tidak dapat terhubung ke AI"
      });
    }

    const data = await response.json();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.warn("❌ Respon AI kosong");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Tidak ada jawaban dari AI"
      });
    }

    const clean = aiText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({
      ...parsed,
      source: "gemini"
    });

  } catch (error) {
    console.error("❌ Kesalahan:", error);
    return Response.json({
      ...fallbackCheck(""),
      note: "Terjadi kesalahan sistem"
    }, { status: 500 });
  }
}

function fallbackCheck(input: string) {
  if (!input || input.trim().length < 5) {
    return {
      status: "neutral",
      message: "⚠️ Masukkan teks yang ingin diperiksa",
      confidence: 0,
      reasons: [],
      explanation: "Teks terlalu pendek atau kosong."
    };
  }

  const lower = input.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  let scoreHoax = 0;
  let scoreValid = 0;
  const reasons: string[] = [];

  const hoaxPatterns = [
    "sembuhkan", "menyembuhkan", "obat alami", "tanaman obat", "instan",
    "tanpa efek samping", "menggantikan obat dokter", "tidak perlu obat",
    "rahasia", "dirahasiakan", "tidak diberitakan media", "konspirasi",
    "chip", "5g", "vaksin berbahaya", "terbukti 100%", "pasti", "dijamin",
    "heboh", "viral", "penyembuhan ajaib", "semua penyakit"
  ];

  hoaxPatterns.forEach(p => {
    if (lower.includes(p)) {
      scoreHoax += 2;
      reasons.push(`Klaim perlu diwaspadai: "${p}"`);
    }
  });

  if (
    (lower.includes("tanaman") || lower.includes("ramuan") || lower.includes("jamu")) &&
    (lower.includes("sembuhkan") || lower.includes("obati")) &&
    (lower.includes("diabetes") || lower.includes("kanker") || lower.includes("jantung") || lower.includes("hipertensi"))
  ) {
    scoreHoax += 3;
    reasons.push("Klaim sembuhkan penyakit serius tanpa bukti ilmiah");
  }

  if (lower.includes("ganti obat") || lower.includes("berhenti minum obat") || lower.includes("tanpa obat dokter")) {
    scoreHoax += 4;
    reasons.push("Menyarankan hentikan pengobatan medis (berisiko)");
  }

  const validPatterns = [
    "penelitian", "studi", "riset", "data", "who", "kemenkes", "kominfo",
    "bssn", "kementerian", "lembaga resmi", "ilmiah", "jurnal", "dokter",
    "ahli", "tenaga kesehatan", "berita resmi"
  ];

  validPatterns.forEach(p => {
    if (lower.includes(p)) {
      scoreValid += 2;
      reasons.push(`Mengacu pada sumber terpercaya: "${p}"`);
    }
  });

  if (input.length < 30) reasons.push("Teks cukup pendek, hasil kurang akurat");

  const total = scoreHoax + scoreValid;
  const confidence = total === 0 ? 50 : Math.min(Math.round((Math.abs(scoreHoax - scoreValid) / total) * 90) + 10, 95);

  let status: "hoax" | "valid" | "neutral";
  let message = "";

  if (scoreHoax > scoreValid + 2) {
    status = "hoax";
    message = "⚠️ Kemungkinan Besar Hoaks / Menyesatkan";
  } else if (scoreValid > scoreHoax + 2) {
    status = "valid";
    message = "✅ Cenderung Valid & Dapat Dipercaya";
  } else {
    status = "neutral";
    message = "ℹ️ Perlu Verifikasi Lebih Lanjut";
  }

  return {
    status,
    message,
    confidence,
    reasons,
    explanation: "Hasil pemeriksaan pola kata kunci. Belum terhubung ke AI."
  };
}