const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const chaptersData = [
  {
    level: 9,
    id: 137,
    name: "Prototyping",
    description: "Konsep dasar prototyping: definisi, tujuan, Lo-Fi vs Hi-Fi, dimensi fidelity, serta metode Paper Prototyping, Wizard of Oz, dan Storyboarding.",
    material: {
      name: "Panduan Lengkap Prototyping dalam Desain Interaksi",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1 style="color: #2c3e50;">Prototyping dalam Desain Interaksi</h1>
          <p><strong>Definisi:</strong> Prototype adalah representasi awal atau model dari sebuah produk yang dibuat untuk mengeksplorasi, mengomunikasikan, dan menguji ide desain sebelum produk akhir dikembangkan. Prototype bukan produk jadi, melainkan <em>thinking tool</em>.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #3498db; margin: 20px 0;">
            <h2 style="margin-top: 0;">Mengapa Prototyping Penting?</h2>
            <ol>
              <li><strong>Validasi Ide Awal:</strong> Menguji konsep sebelum investasi besar dalam pengembangan.</li>
              <li><strong>Komunikasi Desain:</strong> Mempermudah diskusi antara tim desainer, developer, dan klien.</li>
              <li><strong>Temukan Masalah Lebih Awal:</strong> Bug dan ketidaksesuaian kebutuhan ditemukan di fase murah.</li>
              <li><strong>Iterasi Cepat:</strong> Memungkinkan siklus desain-uji-perbaiki yang efisien.</li>
            </ol>
          </div>

          <h2>Proses Prototyping dalam Desain Interaksi</h2>
          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; text-align: center; margin: 20px 0;">
            <div style="width: 120px; background: #e1f5fe; padding: 10px; border-radius: 5px; border: 1px solid #b3e5fc;">1. Riset Pengguna</div>
            <div style="width: 120px; background: #e1f5fe; padding: 10px; border-radius: 5px; border: 1px solid #b3e5fc;">2. Definisi Masalah</div>
            <div style="width: 120px; background: #bbdefb; padding: 10px; border-radius: 5px; font-weight: bold; border: 2px solid #3498db;">3. Ideasi & Prototyping</div>
            <div style="width: 120px; background: #e1f5fe; padding: 10px; border-radius: 5px; border: 1px solid #b3e5fc;">4. Uji & Evaluasi</div>
            <div style="width: 120px; background: #e1f5fe; padding: 10px; border-radius: 5px; border: 1px solid #b3e5fc;">5. Iterasi / Rilis</div>
          </div>

          <h2>Low-Fidelity (Lo-Fi) vs High-Fidelity (Hi-Fi)</h2>
          <table border="1" style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #34495e; color: white;">
              <th>Aspek</th>
              <th>Low-Fidelity (Lo-Fi)</th>
              <th>High-Fidelity (Hi-Fi)</th>
            </tr>
            <tr>
              <td><strong>Karakteristik</strong></td>
              <td>Sederhana, kasar, sketsa kertas.</td>
              <td>Menyerupai produk akhir, interaktif.</td>
            </tr>
            <tr>
              <td><strong>Keuntungan</strong></td>
              <td>Cepat, murah, fokus alur.</td>
              <td>Umpan balik akurat, siap handoff.</td>
            </tr>
            <tr>
              <td><strong>Tools</strong></td>
              <td>Paper, Balsamiq, Marvel.</td>
              <td>Figma, Adobe XD, Sketch.</td>
            </tr>
          </table>

          <h2>Metode Khusus Prototyping</h2>
          <ul>
            <li><strong>Paper Prototyping:</strong> Teknik klasik menggunakan sketsa tangan untuk mensimulasikan UI.</li>
            <li><strong>Wizard of Oz:</strong> Simulasi sistem pintar oleh manusia. Contoh: Voice Assistant manual.</li>
            <li><strong>Storyboarding:</strong> Rangkaian panel visual yang menggambarkan user journey secara kronologis.</li>
            <li><strong>Evolutionary:</strong> Prototype yang terus dikembangkan menjadi produk akhir (Agile).</li>
          </ul>

          <div style="background-color: #fff3e0; padding: 15px; border: 1px solid #ffe0b2; border-radius: 5px;">
            <h3>Evaluasi & Metrik</h3>
            <p><strong>Think-Aloud Protocol:</strong> Meminta pengguna "berpikir keras" saat mencoba prototype.</p>
            <p><strong>System Usability Scale (SUS):</strong> 10 pernyataan skala Likert untuk mengukur kepuasan (Skor > 68 dianggap baik).</p>
          </div>

          <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;"><em>Sumber: W09S01-11S2224-IMK-S1IF_Prototyping-RDS.pdf</em></p>
        </div>
      `
    }
  },
  {
    level: 10,
    id: 138,
    name: "HMSAM dalam Pembelajaran Berbasis Gamifikasi",
    description: "Materi Hedonic Motivation System Adoption Model (HMSAM) dan pengaruh elemen gamifikasi terhadap motivasi dan niat penggunaan sistem pembelajaran.",
    material: {
      name: "Detail Hedonic Motivation System Adoption Model (HMSAM)",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1 style="color: #8e44ad;">HMSAM: Hedonic Motivation System Adoption Model</h1>
          <p>HMSAM menjelaskan mengapa orang mengadopsi sistem yang bersifat "menyenangkan" (hedonic), seperti game atau aplikasi pembelajaran interaktif.</p>

          <h2 style="border-bottom: 2px solid #8e44ad;">Struktur Komponen HMSAM</h2>
          <div style="background: #f3e5f5; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <div style="padding: 10px; background: white; border: 1px solid #8e44ad; border-radius: 5px; width: 200px;">Perceived Ease of Use</div>
            <div style="font-size: 20px;">⬇️</div>
            <div style="padding: 15px; background: #e1bee7; border: 2px solid #8e44ad; border-radius: 20px; width: 220px;">
              <strong>Joy, Curiosity, Control</strong><br>(Intrinsik)
            </div>
            <div style="font-size: 20px;">⬇️</div>
            <div style="padding: 10px; background: white; border: 1px solid #8e44ad; border-radius: 5px; width: 200px;">Focused Immersion (Flow State)</div>
            <div style="font-size: 20px;">⬇️</div>
            <div style="padding: 10px; background: #ce93d8; border: 1px solid #8e44ad; font-weight: bold; border-radius: 5px; width: 200px;">Behavioral Intention to Use</div>
          </div>

          <h2>Penjelasan 7 Variabel Utama</h2>
          <ul>
            <li><strong>Joy (Kesenangan):</strong> Hiburan instan (suara "ding!" di Quizizz).</li>
            <li><strong>Curiosity (Rasa Ingin Tahu):</strong> Dorongan eksplorasi ("apa level berikutnya?").</li>
            <li><strong>Control (Kendali):</strong> Rasa berdaya dalam menentukan alur belajar.</li>
            <li><strong>Perceived Usefulness:</strong> Keyakinan bahwa sistem membantu belajar.</li>
            <li><strong>Perceived Ease of Use:</strong> Kemudahan akses tanpa training rumit.</li>
            <li><strong>Focused Immersion:</strong> Keadaan "lupa waktu" saat berinteraksi.</li>
            <li><strong>Behavioral Intention:</strong> Niat untuk terus kembali menggunakan aplikasi.</li>
          </ul>

          <h2>HMSAM dalam Gamifikasi</h2>
          <p>Gamifikasi yang efektif memenuhi variabel HMSAM melalui elemen:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1; min-width: 140px; background: #ede7f6; padding: 15px; border-radius: 5px; border: 1px solid #d1c4e9;"><strong>Poin & Skor:</strong> Joy & Curiosity.</div>
            <div style="flex: 1; min-width: 140px; background: #ede7f6; padding: 15px; border-radius: 5px; border: 1px solid #d1c4e9;"><strong>Leaderboard:</strong> Immersion & Kompetisi.</div>
            <div style="flex: 1; min-width: 140px; background: #ede7f6; padding: 15px; border-radius: 5px; border: 1px solid #d1c4e9;"><strong>Badge:</strong> Niat Penggunaan (Prestasi).</div>
            <div style="flex: 1; min-width: 140px; background: #ede7f6; padding: 15px; border-radius: 5px; border: 1px solid #d1c4e9;"><strong>Quest:</strong> Rasa ingin tahu (Curiosity).</div>
          </div>

          <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;"><em>Sumber: W10S01-11S2224-IMK-S1IF-HMSAM-RDS.pdf</em></p>
        </div>
      `
    }
  },
  {
    level: 11,
    id: 139,
    name: "User Psychology, Emotional Design and Affordance",
    description: "Eksplorasi psikologi kognitif (Gestalt, Hick's, Fitts', Jakob's Law), level desain emosional, serta konsep affordance dan signifier dalam UI/UX.",
    material: {
      name: "Psikologi Pengguna dan Prinsip Desain Intuitif",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1 style="color: #e67e22;">User Psychology & Emotional Design</h1>
          
          <h2>1. Bagaimana Pengguna Berpikir?</h2>
          <ul>
            <li><strong>Mental Models:</strong> Ekspektasi pengguna terhadap cara kerja UI. Jika melanggar (misal: tombol 'X' di kiri bawah), pengguna akan frustrasi.</li>
            <li><strong>Cognitive Load:</strong> Batasan memori manusia. Kurangi beban dengan visual hierarki yang jelas.</li>
          </ul>

          <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffe0b2;">
            <h3>Prinsip Gestalt (Pengelompokan Visual)</h3>
            <ul>
              <li><strong>Proximity:</strong> Objek dekat = satu grup.</li>
              <li><strong>Similarity:</strong> Objek serupa (warna/bentuk) = fungsi sama.</li>
              <li><strong>Closure:</strong> Otak melengkapi bentuk terputus (ikon 🔍).</li>
              <li><strong>Continuity:</strong> Mata mengikuti jalur linear (breadcrumbs).</li>
            </ul>
          </div>

          <h2>2. Hukum UX Terkenal</h2>
          <ul>
            <li><strong>Hick's Law:</strong> Makin banyak pilihan, makin lama waktu pilih.</li>
            <li><strong>Fitts' Law:</strong> Target harus besar dan dekat.</li>
            <li><strong>Jakob's Law:</strong> Gunakan konvensi standar (Hamburger menu).</li>
          </ul>

          <h2>3. Level Desain Emosional (Don Norman)</h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
            <div style="border: 2px solid #e67e22; padding: 10px; border-radius: 5px; background: #fffcf5;">
              <strong>Visceral:</strong> "Cantik!" (Reaksi instan/estetika).
            </div>
            <div style="border: 2px solid #e67e22; padding: 10px; border-radius: 5px; background: #fffcf5;">
              <strong>Behavioral:</strong> "Enak dipakai!" (Usability/fungsi).
            </div>
            <div style="border: 2px solid #e67e22; padding: 10px; border-radius: 5px; background: #fffcf5;">
              <strong>Reflective:</strong> "Ini saya banget!" (Identitas/jangka panjang).
            </div>
          </div>

          <h2>4. Affordance vs Signifier</h2>
          <p><strong>Affordance:</strong> Apa yang bisa dilakukan (misal: tombol bisa ditekan).</p>
          <p><strong>Signifier:</strong> Tanda visualnya (misal: bayangan/shadow di bawah tombol).</p>

          <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;"><em>Sumber: W11S01-11S2224-IMK-S1IF-User_Psychology_Emotional_Design_Affordance-RDS.pdf</em></p>
        </div>
      `
    }
  },
  {
    level: 12,
    id: 140,
    name: "GenderMag dalam Desain Antarmuka",
    description: "Pengenalan metode GenderMag untuk mengevaluasi inklusivitas kognitif perangkat lunak menggunakan persona (Abi, Pat, Tim) dan walkthrough sistematis.",
    material: {
      name: "Metode GenderMag: Evaluasi Inklusivitas Kognitif",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1 style="color: #27ae60;">GenderMag dalam Desain Antarmuka</h1>
          <p>Metode GenderMag membantu desainer menemukan "Inclusivity Bugs" — hambatan karena desain tidak mendukung gaya kognitif yang beragam.</p>

          <h2>5 Facet Gaya Kognitif</h2>
          <ol>
            <li><strong>Motivation:</strong> Task-oriented vs Technology-oriented.</li>
            <li><strong>Information Processing:</strong> Comprehensive vs Selective.</li>
            <li><strong>Self-Efficacy:</strong> Kepercayaan diri menggunakan fitur.</li>
            <li><strong>Risk Aversion:</strong> Sikap terhadap risiko kegagalan.</li>
            <li><strong>Tinkering:</strong> Kecenderungan untuk bereksperimen.</li>
          </ol>

          <h2>Tiga Persona Utama</h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
            <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; border: 1px solid #c8e6c9;">
              <strong>Abi:</strong> Rendah self-efficacy, risk-averse, tidak suka tinkering. (Deteksi bug kritis).
            </div>
            <div style="background: #f1f8e9; padding: 15px; border-radius: 10px; border: 1px solid #dcedc8;">
              <strong>Pat:</strong> Moderat di semua facet.
            </div>
            <div style="background: #e0f2f1; padding: 15px; border-radius: 10px; border: 1px solid #b2dfdb;">
              <strong>Tim:</strong> Tinggi self-efficacy, suka tinkering, berani risiko.
            </div>
          </div>

          <h2>Proses Walkthrough</h2>
          <p>Lakukan simulasi sebagai <strong>Abi</strong> dan tanyakan:</p>
          <ol>
            <li>Apakah saya tahu harus melakukan ini?</li>
            <li>Apakah saya melihat petunjuknya?</li>
            <li>Apakah saya yakin ini benar?</li>
            <li>Apakah saya tahu hasilnya sukses?</li>
          </ol>

          <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;"><em>Sumber: IMK_GenderMag_Method_in_SE_Riyanthi.pdf</em></p>
        </div>
      `
    }
  },
  {
    level: 13,
    id: 141,
    name: "Voice-Based Interaction, Gesture, and Touch",
    description: "Mempelajari modalitas interaksi multimodal: Voice UI, gestur, dan sentuhan, serta tantangan pengembangannya dalam desain interaksi.",
    material: {
      name: "Interaksi Multimodal: Voice, Gesture, dan Touch",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1 style="color: #2980b9;">Voice-Based, Gesture, and Touch Interaction</h1>
          
          <h2>1. Voice User Interface (VUI)</h2>
          <p>Interaksi menggunakan suara alami. Komponen: Speech Recognition, NLU, dan TTS. Desain harus peka terhadap konteks dan turn-taking.</p>

          <h2>2. Gesture Interaction</h2>
          <p>Menggunakan gerakan tubuh/tangan. Tantangannya adalah <strong>Gorilla Arm Problem</strong> (kelelahan fisik akibat tangan menggantung lama).</p>

          <h2>3. Touch Interaction</h2>
          <p>Sentuhan langsung. Prinsip: Ukuran tombol minimal 44x44px (sesuai Fitts' Law) dan feedback instan. Tantangan: <strong>Finger Occlusion</strong>.</p>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px; border: 1px solid #bbdefb;">
            <p style="margin:0;">Kombinasi modalitas ini menciptakan interaksi yang lebih natural dan mendukung aksesibilitas.</p>
          </div>

          <p style="font-size: 0.9em; color: #7f8c8d; margin-top: 30px;"><em>Sumber: W13S01-11S2224-IMK-S1IF-RDS.pdf</em></p>
        </div>
      `
    }
  }
];

async function main() {
  const courseId = 19;

  for (const data of chaptersData) {
    console.log(`Updating Chapter ${data.level} (ID: ${data.id}) with mobile-optimized content...`);
    
    await prisma.chapter.update({
      where: { id: data.id },
      data: { 
        name: data.name,
        description: data.description 
      }
    });

    await prisma.material.deleteMany({
      where: { chapterId: data.id }
    });

    await prisma.material.create({
      data: {
        chapterId: data.id,
        name: data.material.name,
        content: data.material.content
      }
    });
  }

  console.log("Database update with mobile-optimized CSS visuals completed.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
