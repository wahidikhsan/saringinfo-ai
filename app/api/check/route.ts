export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";

    const hasil = deteksiCerdas(text);

    return Response.json({
      ...hasil,
      source: "sistem_analisis",
      note: "Hasil berdasarkan analisis pola informasi"
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

function deteksiCerdas(input: string) {
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

  const polaHoaks = [
    { kata: "sembuhkan", bobot: 2, keterangan: "Klaim penyembuhan" },
    { kata: "menyembuhkan", bobot: 2, keterangan: "Klaim penyembuhan" },
    { kata: "instan", bobot: 2, keterangan: "Janji hasil terlalu cepat" },
    { kata: "rahasia", bobot: 3, keterangan: "Diklaim sebagai informasi rahasia" },
    { kata: "dirahasiakan", bobot: 3, keterangan: "Diklaim disembunyikan" },
    { kata: "tidak diberitakan", bobot: 3, keterangan: "Tuduhan media menutupi berita" },
    { kata: "konspirasi", bobot: 3, keterangan: "Teori konspirasi" },
    { kata: "100%", bobot: 2, keterangan: "Pernyataan mutlak tanpa bukti" },
    { kata: "pasti", bobot: 2, keterangan: "Pernyataan mutlak" },
    { kata: "dijamin", bobot: 2, keterangan: "Janji berlebihan" },
    { kata: "tanpa obat", bobot: 3, keterangan: "Menyarankan hentikan pengobatan" },
    { kata: "ganti obat dokter", bobot: 4, keterangan: "Menyarankan hentikan pengobatan medis" },
    { kata: "hemat bensin", bobot: 3, keterangan: "Klaim menghemat bahan bakar tidak berdasar" },
    { kata: "magnet", bobot: 3, keterangan: "Klaim teknologi tidak terbukti" },
    { kata: "stiker", bobot: 2, keterangan: "Barang tidak berfungsi sesuai klaim" },
    { kata: "bantuan 5 juta", bobot: 4, keterangan: "Janji bantuan tidak resmi" },
    { kata: "disebarkan", bobot: 2, keterangan: "Mengajak penyebaran informasi" },
    { kata: "tanpa syarat", bobot: 2, keterangan: "Janji manis tidak realistis" }
  ];

  polaHoaks.forEach(item => {
    if (teks.includes(item.kata)) {
      skorHoaks += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  const polaValid = [
    { kata: "penelitian", bobot: 2, keterangan: "Mengacu pada hasil penelitian" },
    { kata: "studi", bobot: 2, keterangan: "Mengacu pada kajian ilmiah" },
    { kata: "data", bobot: 2, keterangan: "Mengacu pada data terukur" },
    { kata: "bpom", bobot: 4, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "badan pom", bobot: 4, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "kemenkes", bobot: 4, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "bmkg", bobot: 4, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "kominfo", bobot: 4, keterangan: "Mengacu pada lembaga resmi pemerintah" },
    { kata: "lembaga resmi", bobot: 3, keterangan: "Mengacu pada sumber terpercaya" },
    { kata: "berita resmi", bobot: 3, keterangan: "Mengacu pada sumber terpercaya" },
    { kata: "peringatan", bobot: 2, keterangan: "Informasi imbauan resmi" },
    { kata: "tanpa izin edar", bobot: 2, keterangan: "Pernyataan berdasarkan peraturan" }
  ];

  polaValid.forEach(item => {
    if (teks.includes(item.kata)) {
      skorValid += item.bobot;
      alasan.push(item.keterangan);
    }
  });

  if (teks.includes("penelitian") && teks.includes("belum dipublikasikan")) {
    skorValid -= 2;
    alasan.push("Penelitian belum dipublikasikan secara luas");
  }

  if (teks.includes("ada kabar") || teks.includes("dikatakan")) {
    skorHoaks += 1;
    alasan.push("Hanya kabar yang belum dikonfirmasi");
  }

  const total = skorHoaks + skorValid;
  let keyakinan = 50;

  if (total > 0) {
    keyakinan = Math.min(Math.round((Math.abs(skorHoaks - skorValid) / total) * 90) + 10, 95);
  }

  let status: "hoax" | "valid" | "neutral";
  let pesan = "";
  let penjelasan = "";

  if (skorHoaks > skorValid + 1) {
    status = "hoax";
    pesan = "⚠️ Kemungkinan Besar Hoaks / Menyesatkan";
    penjelasan = "Informasi ini mengandung klaim yang tidak berdasar, berlebihan, atau tidak memiliki sumber resmi. Sebaiknya tidak dipercaya dan tidak disebarkan sebelum dibuktikan kebenarannya.";
  } else if (skorValid > skorHoaks + 1) {
    status = "valid";
    pesan = "✅ Cenderung Valid & Dapat Dipercaya";
    penjelasan = "Informasi ini berasal dari lembaga atau sumber yang resmi dan berwenang. Isinya sesuai dengan kaidah penyampaian informasi yang dapat dipertanggungjawabkan.";
  } else {
    status = "neutral";
    pesan = "ℹ️ Perlu Verifikasi Lebih Lanjut";
    penjelasan = "Informasi ini belum memiliki tanda yang cukup jelas untuk dikategorikan pasti. Sebaiknya dicocokkan dengan situs verifikasi berita resmi seperti CekFakta Kominfo.";
  }

  return {
    status,
    message: pesan,
    confidence: keyakinan,
    reasons: [...new Set(alasan)],
    explanation: penjelasan
  };
}