export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const hasil = deteksiLengkap(text);

    return Response.json({
      ...hasil,
      source: "analisis_sistem",
      note: "Analisis berdasarkan pola informasi yang teruji"
    });

  } catch (error) {
    console.error("❌ Kesalahan:", error);
    return Response.json({
      status: "neutral",
      message: "⚠️ Terjadi kesalahan sistem",
      confidence: 0,
      reasons: [],
      explanation: "Silakan coba lagi nanti."
    }, { status: 500 });
  }
}

function deteksiLengkap(input: string) {
  if (!input || input.trim().length < 10) {
    return {
      status: "neutral",
      message: "⚠️ Masukkan teks yang cukup jelas",
      confidence: 0,
      reasons: [],
      explanation: "Teks terlalu pendek atau kosong untuk diperiksa."
    };
  }

  const teks = input.toLowerCase().replace(/[^\w\s]/g, " ").trim();
  let skorHoaks = 0;
  let skorValid = 0;
  const alasan: string[] = [];

  const polaMencurigakan = [
    { kata: "sembuhkan", bobot: 2, keterangan: "Klaim penyembuhan" },
    { kata: "menyembuhkan", bobot: 2, keterangan: "Klaim penyembuhan" },
    { kata: "instan", bobot: 2, keterangan: "Janji hasil cepat" },
    { kata: "rahasia", bobot: 3, keterangan: "Informasi yang diklaim rahasia" },
    { kata: "dirahasiakan", bobot: 3, keterangan: "Informasi yang diklaim disembunyikan" },
    { kata: "tidak diberitakan", bobot: 3, keterangan: "Tuduhan media menutupi berita" },
    { kata: "konspirasi", bobot: 3, keterangan: "Teori konspirasi" },
    { kata: "100%", bobot: 2, keterangan: "Pernyataan mutlak" },
    { kata: "pasti", bobot: 2, keterangan: "Pernyataan mutlak" },
    { kata: "dijamin", bobot: 2, keterangan: "Pernyataan berlebihan" },
    { kata: "tanpa obat", bobot: 3, keterangan: "Menyarankan hentikan pengobatan" },
    { kata: "ganti obat dokter", bobot: 4, keterangan: "Menyarankan hentikan pengobatan medis" },
    { kata: "chip", bobot: 2, keterangan: "Klaim tidak berdasar" },
    { kata: "5g", bobot: 2, keterangan: "Klaim tidak berdasar" },
    { kata: "vaksin berbahaya", bobot: 3, keterangan: "Klaim tidak teruji" },
    { kata: "bohong pemerintah", bobot: 3, keterangan: "Tuduhan tanpa bukti" }
  ];

  polaMencurigakan.forEach(item => {
    if (teks.includes(item.kata)) {
      skorHoaks += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  const polaTerpercaya = [
    { kata: "penelitian", bobot: 2, keterangan: "Mengacu pada hasil penelitian" },
    { kata: "studi", bobot: 2, keterangan: "Mengacu pada hasil studi" },
    { kata: "data", bobot: 2, keterangan: "Mengacu pada data nyata" },
    { kata: "who", bobot: 3, keterangan: "Mengacu pada lembaga internasional" },
    { kata: "kemenkes", bobot: 3, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "bmkg", bobot: 3, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "kominfo", bobot: 3, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "lembaga resmi", bobot: 3, keterangan: "Mengacu pada sumber resmi" },
    { kata: "dokter", bobot: 2, keterangan: "Mengacu pada tenaga medis" },
    { kata: "ahli", bobot: 2, keterangan: "Mengacu pada sumber berkompeten" },
    { kata: "berita resmi", bobot: 3, keterangan: "Mengacu pada sumber terpercaya" }
  ];

  polaTerpercaya.forEach(item => {
    if (teks.includes(item.kata)) {
      skorValid += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  const total = skorHoaks + skorValid;
  let tingkatKeyakinan = 50;

  if (total > 0) {
    tingkatKeyakinan = Math.min(Math.round((Math.abs(skorHoaks - skorValid) / total) * 90) + 10, 95);
  }

  let status: "hoax" | "valid" | "neutral";
  let pesanSingkat = "";
  let penjelasanLengkap = "";

  if (skorHoaks > skorValid + 2) {
    status = "hoax";
    pesanSingkat = "⚠️ Kemungkinan Besar Hoaks / Menyesatkan";
    penjelasanLengkap = "Informasi ini mengandung pola klaim yang berlebihan, tidak memiliki sumber yang jelas, atau mengandung unsur yang menyesatkan. Disarankan untuk memeriksa kembali ke sumber resmi sebelum mempercayai atau menyebarkannya.";
  } else if (skorValid > skorHoaks + 2) {
    status = "valid";
    pesanSingkat = "✅ Cenderung Valid & Dapat Dipercaya";
    penjelasanLengkap = "Informasi ini merujuk pada lembaga atau sumber yang resmi dan berwenang. Isinya sesuai dengan kaidah penyampaian informasi yang baik dan dapat dipertanggungjawabkan.";
  } else {
    status = "neutral";
    pesanSingkat = "ℹ️ Perlu Verifikasi Lebih Lanjut";
    penjelasanLengkap = "Informasi ini belum memiliki tanda yang cukup jelas untuk dikategorikan pasti. Sebaiknya dicocokkan dengan situs verifikasi berita resmi seperti CekFakta Kominfo atau situs lembaga terkait sebelum disebarkan.";
  }

  return {
    status,
    message: pesanSingkat,
    confidence: tingkatKeyakinan,
    reasons: [...new Set(alasan)],
    explanation: penjelasanLengkap
  };
}