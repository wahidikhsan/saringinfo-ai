export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("API key tidak ditemukan, pakai fallback");
      const result = fallbackCheck(text);
      return Response.json({
        ...result,
        source: "fallback",
      });
    }

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
                  text: `Analisis apakah teks berikut hoaks atau valid.

Balas WAJIB dalam JSON tanpa penjelasan tambahan, tanpa teks lain, tanpa penanda kode:
{
  "status": "hoax | valid | neutral",
  "message": "...",
  "confidence": number (0-100),
  "reasons": ["...", "..."]
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

    const data = await response.json();

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsed;
    try {
      const clean = aiText
        ?.replace(/```json/g, "")
        ?.replace(/```/g, "")
        ?.trim();

      parsed = JSON.parse(clean);
    } catch {
      console.warn("AI tidak valid, pakai fallback");
      const result = fallbackCheck(text);
      return Response.json({
        ...result,
        source: "fallback",
      });
    }

    return Response.json({
      ...parsed,
      source: "gemini",
    });

  } catch (error) {
    console.error("Error:", error);
    return Response.json(
      { error: "Terjadi kesalahan server" },
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
    };
  }

  const lower = input
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  let scoreHoax = 0;
  let scoreValid = 0;
  const reasons: string[] = [];

  const hoaxPatterns = [
    "chip",
    "5g",
    "konspirasi",
    "elite global",
    "agenda rahasia",
    "tidak diberitakan media",
    "dokter disembunyikan",
    "fakta yang ditutup tutupi",
    "bohong pemerintah",
  ];

  hoaxPatterns.forEach((pattern) => {
    if (lower.includes(pattern)) {
      scoreHoax += 2;
      reasons.push(`Klaim mencurigakan: "${pattern}"`);
    }
  });

  const sensationalWords = [
    "viral",
    "heboh",
    "100",
    "pasti",
    "terbukti",
    "dijamin",
  ];

  sensationalWords.forEach((word) => {
    if (lower.includes(word)) {
      scoreHoax += 1;
      reasons.push(`Bahasa sensasional: "${word}"`);
    }
  });

  const validPatterns = [
    "penelitian",
    "studi",
    "data",
    "who",
    "kemenkes",
    "ilmiah",
    "jurnal",
    "dokter",
  ];

  validPatterns.forEach((pattern) => {
    if (lower.includes(pattern)) {
      scoreValid += 2;
      reasons.push(`Sumber terpercaya: "${pattern}"`);
    }
  });

  if (lower.includes("vaksin")) {
    scoreHoax += 1;
    reasons.push("Topik sensitif (perlu verifikasi)");
  }

  if (lower.length < 20) {
    reasons.push("Teks terlalu pendek");
  }

  const total = scoreHoax + scoreValid;

  const confidence =
    total === 0
      ? 50
      : Math.min(
          Math.round((Math.abs(scoreHoax - scoreValid) / total) * 100),
          95
        );

  let status: "hoax" | "valid" | "neutral";
  let message = "";

  if (scoreHoax > scoreValid + 1) {
    status = "hoax";
    message = "⚠️ Kemungkinan Hoaks";
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
  };
}