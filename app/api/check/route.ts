export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.warn("❌ Kunci API tidak ditemukan, pakai mode cadangan");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Kunci AI belum diatur"
      });
    }

    console.log("🔍 Menghubungkan ke AI Groq...");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `Kamu adalah pemeriksa kebenaran informasi dan berita di Indonesia. 
Tugasmu: analisis apakah teks berita/kalimat yang diberikan adalah HOAKS, VALID, atau PERLU VERIFIKASI.
Jawab HANYA dalam format JSON yang valid, tanpa teks tambahan, tanpa awalan \`\`\`json atau penanda kode lainnya.
Gunakan bahasa Indonesia yang jelas dan mudah dipahami.`
          },
          {
            role: "user",
            content: `Analisis teks berikut: "${text}"

Keluarannya HARUS sesuai struktur ini:
{
  "status": "hoax | valid | neutral",
  "message": "Ringkasan kesimpulan singkat",
  "confidence": angka antara 0 sampai 100,
  "reasons": ["Alasan 1", "Alasan 2", "dst"],
  "explanation": "Penjelasan lengkap dan rinci mengapa hasilnya demikian"
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("❌ Gagal hubung ke AI:", response.status, err);
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Tidak dapat terhubung ke layanan AI"
      });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "";

    if (!aiText) {
      console.warn("❌ Respon dari AI kosong");
      return Response.json({
        ...fallbackCheck(text),
        source: "fallback",
        note: "Tidak ada jawaban dari AI"
      });
    }

    const clean = aiText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(clean);

    console.log("✅ Berhasil dapat hasil dari AI Groq!");
    return Response.json({
      ...parsed,
      source: "ai"
    });

  } catch (error) {
    console.error("❌ Kesalahan sistem:", error);
    return Response.json({
      ...fallbackCheck(""),
      note: "Terjadi kesalahan saat memproses"
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
      explanation: "Teks terlalu pendek atau kosong untuk diperiksa."
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
    "heboh", "viral", "penyembuhan ajaib", "semua penyakit", "bohong pemerintah"
  ];

  hoaxPatterns.forEach(p => {
    if (lower.includes(p)) {
      scoreHoax += 2;
      reasons.push(`Mengandung klaim yang perlu diwaspadai: "${p}"`);
    }
  });

  if (
    (lower.includes("tanaman") || lower.includes("ramuan") || lower.includes("jamu")) &&
    (lower.includes("sembuhkan") || lower.includes("obati")) &&
    (lower.includes("diabetes") || lower.includes("kanker") || lower.includes("jantung") || lower.includes("hipertensi"))
  ) {
    scoreHoax += 3;
    reasons.push("Klaim penyembuhan penyakit serius tanpa bukti ilmiah");
  }

  if (lower.includes("ganti obat") || lower.includes("berhenti minum obat") || lower.includes("tanpa obat dokter")) {
    scoreHoax += 4;
    reasons.push("Menyarankan menghentikan pengobatan medis yang berisiko");
  }

  const validPatterns = [
    "penelitian", "studi", "riset", "data", "who", "kemenkes", "kominfo",
    "bssn", "bmkg", "kementerian", "lembaga resmi", "ilmiah", "jurnal", "dokter",
    "ahli", "tenaga kesehatan", "berita resmi", "penjelasan resmi"
  ];

  validPatterns.forEach(p => {
    if (lower.includes(p)) {
      scoreValid += 2;
      reasons.push(`Mengacu pada sumber terpercaya: "${p}"`);
    }
  });

  if (input.length < 30) reasons.push("Teks cukup pendek, hasil kurang meyakinkan");

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
    explanation: "Hasil ini berdasarkan pemeriksaan pola kata kunci."
  };
}