// prisma/seed.js
const { PrismaClient, Role, QuestType, BadgeType } = require('@prisma/client');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const prisma = new PrismaClient();

async function ensureBadgesBucketAndUpload() {
  const assetsUrl = process.env.SUPABASE_ASSETS_URL;
  const serviceKey = process.env.SUPABASE_ASSETS_SERVICE_ROLE_KEY

  if (!serviceKey) {
    console.warn('[seed] Skipping storage upload: missing SUPABASE_ASSETS_SERVICE_ROLE_KEY');
    return { assetsUrl };
  }

  const supabase = createClient(assetsUrl, serviceKey);

  try {
    const { data: bucket } = await supabase.storage.getBucket('badges');
    if (!bucket) {
      const { error: createErr } = await supabase.storage.createBucket('badges', { public: true });
      if (createErr) {
        console.warn('[seed] Failed to create badges bucket:', createErr.message);
      }
    }
  } catch (e) {
    // continue even if bucket check fails
    console.warn('[seed] Bucket check error:', e.message || e);
  }

  const localDir = path.resolve(__dirname, '../../Mobile/lib/assets/badges');
  const wantFiles = ['imk-1.png', 'imk-2.png', 'imk-3.png'];
  for (const f of wantFiles) {
    try {
      const full = path.join(localDir, f);
      if (!fs.existsSync(full)) {
        console.warn(`[seed] Local badge image not found, skipping: ${full}`);
        continue;
      }
      const bytes = fs.readFileSync(full);
      const { error: upErr } = await supabase.storage.from('badges').upload(f, bytes, {
        contentType: 'image/png',
        upsert: true,
      });
      if (upErr) {
        console.warn(`[seed] Upload failed for ${f}:`, upErr.message);
      } else {
        console.log(`[seed] Uploaded ${f} to badges bucket`);
      }
    } catch (e) {
      console.warn('[seed] Upload step error:', e.message || e);
    }
  }

  return { assetsUrl };
}

async function main() {
  try {
    const { assetsUrl } = await ensureBadgesBucketAndUpload();

    // Create Users
    const hashedPassword = await bcrypt.hash('password', 10);
    const userPassword = await bcrypt.hash('123', 10);
    
    const administrator = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Admin',
        role: Role.ADMIN,
        image: '',
      },
    });

    const administrator2 = await prisma.user.create({
      data: {
        username: 'archico',
        password: hashedPassword,
        name: 'Archico',
        role: Role.ADMIN,
        image: '',
      },
    });

    const instructor = await prisma.user.create({
      data: {
        username: 'rafael',
        password: hashedPassword,
        name: 'Rafael',
        role: Role.INSTRUCTOR,
        instructorId: '11S21028',
        instructorCourses: 0,
        image: '',
      },
    });     
    
    const student = await prisma.user.create({
      data: {
        username: 'benhard',
        password: hashedPassword,
        name: 'Benhard',
        role: Role.STUDENT,
        studentId: '11S21003',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const emely = await prisma.user.create({
      data: {
        username: 'emely',
        password: hashedPassword,
        name: 'Emely',
        role: Role.STUDENT,
        studentId: '11S21052',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const boy = await prisma.user.create({
      data: {
        username: 'boy',
        password: hashedPassword,
        name: 'Boy',
        role: Role.STUDENT,
        studentId: '11S21025',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const enrico = await prisma.user.create({
      data: {
        username: 'enrico',
        password: hashedPassword,
        name: 'Enrico',
        role: Role.STUDENT,
        studentId: '11S21034',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const gerry = await prisma.user.create({
      data: {
        username: 'gerry',
        password: hashedPassword,
        name: 'Gerry',
        role: Role.STUDENT,
        studentId: '11S21055',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const tabitha = await prisma.user.create({
      data: {
        username: 'tabitha',
        password: hashedPassword,
        name: 'Tabitha',
        role: Role.STUDENT,
        studentId: '11S21042',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const tesalonika = await prisma.user.create({
      data: {
        username: 'tesalonika',
        password: hashedPassword,
        name: 'Tesalonika',
        role: Role.STUDENT,
        studentId: '11S21005',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const dedi = await prisma.user.create({
      data: {
        username: 'dedi',
        password: hashedPassword,
        name: 'Dedi',
        role: Role.STUDENT,
        studentId: '11S21014',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const gerald = await prisma.user.create({
      data: {
        username: 'gerald',
        password: hashedPassword,
        name: 'Gerald',
        role: Role.STUDENT,
        studentId: '11S21015',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user1 = await prisma.user.create({
      data: {
        username: 'User 1',
        password: userPassword,
        name: 'User 1',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user2 = await prisma.user.create({
      data: {
        username: 'User 2',
        password: userPassword,
        name: 'User 2',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user3 = await prisma.user.create({
      data: {
        username: 'User 3',
        password: userPassword,
        name: 'User 3',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user4 = await prisma.user.create({
      data: {
        username: 'User 4',
        password: userPassword,
        name: 'User 4',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user5 = await prisma.user.create({
      data: {
        username: 'User 5',
        password: userPassword,
        name: 'User 5',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });

    const user6 = await prisma.user.create({
      data: {
        username: 'User 6',
        password: userPassword,
        name: 'User 6',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user7 = await prisma.user.create({
      data: {
        username: 'User 7',
        password: userPassword,
        name: 'User 7',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user8 = await prisma.user.create({
      data: {
        username: 'User 8',
        password: userPassword,
        name: 'User 8',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user9 = await prisma.user.create({
      data: {
        username: 'User 9',
        password: userPassword,
        name: 'User 9',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });
    
    const user10 = await prisma.user.create({
      data: {
        username: 'User 10',
        password: userPassword,
        name: 'User 10',
        role: Role.STUDENT,
        studentId: '11S23000',
        points: 0,
        totalCourses: 0,
        badges: 0,
        image: '',
      },
    });

    const rds = await prisma.user.create({
      data: {
        username: 'ranty',
        password: hashedPassword,
        name: 'Ranty',
        role: Role.INSTRUCTOR,
        instructorId: 'RDS',
        instructorCourses: 0,
        image: '',
      },
    }); 

    // Create Courses
    const course1 = await prisma.course.create({
      data: {
        code: 'IMK',
        name: 'Interaksi Manusia Komputer',
        description: 'Human Computer Interaction',
      },
    });

    const course2 = await prisma.course.create({
      data: {
        code: 'UI/UX',
        name: 'UI/UX',
        description: 'Learn the fundamentals of UI/UX Design',
      },
    });

    const course3 = await prisma.course.create({
      data: {
        code: 'RPL',
        name: 'Rekayasa Perangkat Lunak',
        description: 'Learn basic of software engineering',
      },
    });

    // Create Chapters for Course IMK
    const chapter1 = await prisma.chapter.create({
      data: {
        name: 'Introduction to Human-computer Interaction',
        description: 'Konsep dasar IMK, ruang lingkup, sejarah perkembangan, dan peran human centered',
        level: 1,
        courseId: course1.id,
      },
    });

    const chapter2 = await prisma.chapter.create({
      data: {
        name: 'Human Factors and Ergonomic Principles in Design Interaction',
        description: 'Human factors: persepsi, kognisi, motorik, serta prinsip ergonomi dalam desain interaksi',
        level: 2,
        courseId: course1.id,
      },
    });

    const chapter3 = await prisma.chapter.create({
      data: {
        name: 'Usability',
        description: 'Prinsip usability (efektivitas, efisiensi, kepuasan) dan 10 Usability Heuristics',
        level: 3,
        courseId: course1.id,
        isCheckpoint: 1
      },
    });

    const chapter4 = await prisma.chapter.create({
      data: {
        name: 'Heuristic Evaluation: Nielsen’s 10 Principles',
        description: 'Heuristic Evaluation: Nielsen’s 10 Principles',
        level: 4,
        courseId: course1.id,
      },
    });

    const chapter5 = await prisma.chapter.create({
      data: {
        name: 'Visual Elements, Information Hierarchy, Consistency, and Interface Readability',
        description: 'Elemen visual, hierarki informasi, konsistensi, dan keterbacaan antarmuka',
        level: 5,
        courseId: course1.id,
      },
    });

    const chapter6 = await prisma.chapter.create({
      data: {
        name: 'User Centered Design',
        description: 'Tahapan user centered design, identifikasi kebutuhan pengguna, pembuatan persona, dan user journey map',
        level: 6,
        courseId: course1.id,
        isCheckpoint: 2
      },
    });

    const chapter7 = await prisma.chapter.create({
      data: {
        name: 'Implementation of User Centered Design',
        description: 'Materi tentang penerapan prinsip User Centered Design',
        level: 7,
        courseId: course1.id,
      },
    });

    const chapter8 = await prisma.chapter.create({
      data: {
        name: 'UTS',
        description: 'Ujian Tengah Semester',
        level: 8,
        courseId: course1.id,
        isCheckpoint: 3
      },
    });

    const chapter9 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 9',
        description: 'Deskripsi Materi Week 9',
        level: 9,
        courseId: course1.id,
      },
    });

    const chapter10 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 10',
        description: 'Deskripsi Materi Week 10',
        level: 10,
        courseId: course1.id,
      },
    });

    const chapter11 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 11',
        description: 'Deskripsi Materi Week 11',
        level: 11,
        courseId: course1.id,
      },
    });

    const chapter12 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 12',
        description: 'Deskripsi Materi Week 12',
        level: 12,
        courseId: course1.id,
      },
    });

    const chapter13 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 13',
        description: 'Deskripsi Materi Week 13',
        level: 13,
        courseId: course1.id,
      },
    });

    const chapter14 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 14',
        description: 'Deskripsi Materi Week 14',
        level: 14,
        courseId: course1.id,
      },
    });

    const chapter15 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 15',
        description: 'Deskripsi Materi Week 15',
        level: 15,
        courseId: course1.id,
      },
    });

    const chapter16 = await prisma.chapter.create({
      data: {
        name: 'Judul Materi Week 16',
        description: 'Deskripsi Materi Week 16',
        level: 16,
        courseId: course1.id,
      },
    });

    // Content for Chapter 1
    const material1 = await prisma.material.create({
      data: {
        chapterId: chapter1.id,
        name: 'Pengantar',
        content: `
          <p>HCI adalah bidang studi yang mulai 
          berkembang pada tahun 1980-an, tetapi 
          konsep interaksi manusia dan mesin 
          sudah ada sebelumnya dengan berbagai 
          istilah seperti Man-Machine Interaction 
          (MMI) pada 1970-an, Computer and Human 
          Interaction (CHI), dan Human-Machine 
          Interaction (HMI). HCI mempelajari 
          cara manusia dan komputer bekerja 
          bersama untuk menyelesaikan tugas 
          tertentu. Fokus utama HCI adalah 
          perancangan, evaluasi, dan implementasi 
          sistem interaktif yang digunakan manusia. 
          HCI juga berhubungan dengan usability 
          (daya guna), yang berarti sistem harus 
          mudah digunakan, dipelajari, dan memberikan 
          keamanan bagi pengguna.</p>
          <p>HCI terdiri dari tiga elemen utama, 
          yaitu <strong>manusia, komputer, dan interaksi</strong></p>
          <ul>
            <li><strong>Manusia</strong> sebagai pengguna memiliki 
            kebutuhan dan keterbatasan yang harus 
            dipertimbangkan dalam desain sistem. </li>
            <li><strong>Komputer </strong> mencakup 
            perangkat keras dan lunak yang digunakan 
            untuk berinteraksi dengan manusia.  </li>
            <li><strong>Interaksi </strong>terjadi 
            melalui antarmuka yang harus dirancang 
            agar nyaman dan efisien. </li>
          </ul>
          <p>
            Fokus utama HCI adalah perancangan dan 
            evaluasi user interface (UI), yaitu bagian 
            dari sistem komputer yang memungkinkan manusia 
            berinteraksi dengan komputer. 
          </p>
          <p><img src="asset:lib/assets/alurHCI.png"></p>
          <p>
            UI harus dirancang dengan mempertimbangkan <strong>human factors</strong>, seperti kognisi dan ergonomi, agar pengguna dapat berinteraksi dengan nyaman dan efektif.
          </p>
          <p>
            Dalam desain sistem interaktif, sering 
            kali desainer atau programmer tidak memahami 
            dengan tepat kebutuhan dan lingkungan kerja 
            pengguna. Masalah lain yang sering terjadi 
            adalah sistem komputer yang mengharuskan 
            pengguna mengingat terlalu banyak informasi, 
            kurang toleran terhadap kesalahan pengguna, 
            serta tidak mempertimbangkan variasi 
            pengguna yang berbeda-beda. Kesalahan 
            utama dalam desain HCI adalah mengasumsikan 
            bahwa <strong>semua pengguna itu sama</strong> 
            dan bahwa <strong>pengguna memiliki cara berpikir 
            yang sama dengan desainer</strong>. Untuk menciptakan 
            sistem yang baik, penting untuk mempertanyakan 
            desain yang buruk dan memastikan bahwa 
            sistem memungkinkan pengguna menyelesaikan 
            tugas dengan aman, efektif, efisien, dan 
            menyenangkan.
          </p>
          <p>
            Tujuan utama HCI adalah meningkatkan <strong>kualitas hidup pengguna</strong> dengan membuat sistem interaktif yang baik dan mudah digunakan. Sebuah sistem yang baik memiliki beberapa karakteristik <strong>user-friendly</strong>, seperti tampilan yang menarik, kemudahan penggunaan, cepat dipelajari, memberikan pengalaman positif, dan direkomendasikan oleh pengguna lain. Tujuan dalam rekayasa sistem meliputi beberapa aspek penting:
          </p>
          <ol>
            <li><strong>Fungsionalitas yang sesuai</strong>, yaitu memastikan sistem memiliki fitur yang benar-benar dibutuhkan pengguna.</li>
            <li><strong>Keandalan, ketersediaan, keamanan, dan integritas data</strong>, sehingga sistem dapat digunakan kapan saja tanpa risiko kehilangan atau pencurian data.</li>
            <li><strong>Standardisasi, integrasi, konsistensi, dan portabilitas</strong>, yang memastikan antarmuka mudah dipahami dan data dapat digunakan di berbagai perangkat.</li>
            <li><strong>Penjadwalan dan anggaran</strong>, agar proyek selesai tepat waktu dan sesuai dengan biaya yang telah direncanakan.</li>
          </ol>
          <p>
            HCI adalah bidang multidisipliner yang dipengaruhi oleh berbagai bidang ilmu, termasuk:
          </p>
          <ul>
            <li><strong>Psikologi dan ilmu kognitif </strong> untuk memahami persepsi dan pemrosesan informasi oleh manusia. </li>
            <li><strong>Ergonomi </strong>untuk mempertimbangkan aspek fisik pengguna.</li>
            <li><strong>Sosiologi </strong>untuk memahami interaksi sosial dalam penggunaan teknologi.</li>
            <li><strong>Ilmu komputer dan teknik </strong>untuk mengembangkan sistem teknologi.</li>
            <li><strong>Bisnis dan pemasaran </strong>untuk memahami kebutuhan pasar.</li>
            <li><strong>Desain grafis </strong>untuk menciptakan antarmuka yang menarik dan fungsional.</li>
          </ul>
          <p>
            HCI telah berkembang sejak 1960-an, dimulai dengan komputer mainframe dan interaksi berbasis teks. Pada 1970-an, muncul konsep Graphical User Interface (GUI) yang lebih visual dan intuitif. Pada 1990-an, perhatian lebih difokuskan pada usability dan pendekatan desain yang berpusat pada pengguna (user-centered design). Hingga kini, HCI terus berkembang dengan kemajuan teknologi seperti mobile computing, AI, dan interaksi berbasis sensor. Human-centered design adalah pendekatan dalam HCI yang menempatkan manusia sebagai fokus utama dalam pengembangan sistem. Prinsip utama dalam pendekatan ini meliputi memahami kebutuhan pengguna, melibatkan pengguna dalam proses desain, dan mengevaluasi sistem berdasarkan pengalaman pengguna.
          </p>
        `,
      },
    });

    const material2 = await prisma.material.create({
      data: {
        chapterId: chapter2.id,
        name: 'Human Factors and Ergonomic Principles in Design Interaction',
        content: `
          <p><strong><i>Human Factor</i></strong> dalam desain interaksi mencakup pemahaman tentang manusia sebagai pengguna sistem interaktif, meliputi <strong>Fisiologi, Kognisi, Psikologi, Sosial, dan Budaya </strong>. Adapun Tujuan utama dari <strong><i>Human Factor</i></strong> yaitu:
    <ul> 
        <li>Usability (Mudah Dipahami)</li>
        <li>Efektivitas dalam Penggunaan</li>
        <li>Memenuhi Kebutuhan Pengguna</li>
    
    </ul>
    <p>
        Penerapan <i>Human Factor</i> dalam desain interaksi sangat penting karena dapat <strong>meningkatkan efisiensi</strong> pengguna dalam menyelesaikan tugas. Sistem yang dirancang dengan mempertimbangkan Human Factors juga dapat <strong>mengurangi kesalahan</strong>, karena pengguna akan lebih mudah memahami cara kerja sistem, sehingga mengurangi kemungkinan melakukan kesalahan operasional. Selain itu, sistem yang ramah pengguna dapat <strong>meningkatkan kepuasan pengguna</strong>, yang pada akhirnya dapat meningkatkan loyalitas terhadap produk atau layanan. Aspek lainnya adalah <strong>aksesibilitas</strong>, di mana sistem harus dapat digunakan oleh semua orang, termasuk mereka yang memiliki keterbatasan fisik atau kognitif.
    </p>
    
    <h2>Konsep Dasar Human Factors dalam Desain Interaksi</h2>
    <h3>A. Kognisi Manusia</h3>
    <p>Faktor kognitif dalam desain interaksi mencakup <strong>perhatian</strong>, <strong>memori</strong>, dan <strong>pengambilan keputusan</strong>. Desain antarmuka yang baik harus <strong>membantu pengguna memusatkan perhatian pada elemen-elemen penting</strong>, misalnya dengan menggunakan warna kontras untuk tombol utama. Selain itu, sistem sebaiknya <strong>tidak terlalu membebani memori jangka pendek pengguna</strong>. Misalnya, ikon dan label yang mudah dikenali dapat membantu pengguna memahami fungsi suatu elemen tanpa harus mengingat terlalu banyak informasi. Dalam aspek pengambilan keputusan, <strong>sistem harus menyajikan opsi yang jelas dan tidak membingungkan</strong>, sehingga pengguna dapat dengan cepat memilih tindakan yang sesuai.</p>
    
    <h3>B. Fisiologi Pengguna</h3>
    <p>Faktor fisiologi berkaitan dengan <strong>ergonomi</strong> dan <strong>kemampuan motorik</strong>. Pengguna dalam berinteraksi dengan sistem. Ergonomi mencakup aspek seperti ukuran tombol, posisi layar, dan desain perangkat keras agar sesuai dengan karakteristik pengguna. Elemen interaktif seperti tombol dan menu navigasi harus cukup besar dan mudah diakses untuk mengakomodasi pengguna dengan berbagai kemampuan motorik. Jika desain tidak mempertimbangkan faktor ini, pengguna dapat mengalami kesulitan dalam mengoperasikan sistem, yang pada akhirnya mengurangi efektivitas interaksi.</p>
    
    <h3>C. Aspek Sosial dan Budaya</h3>
    <p>Interaksi manusia dengan teknologi juga dipengaruhi oleh faktor sosial dan budaya. Misalnya, <strong>konvensi budaya</strong> dapat mempengaruhi pemahaman terhadap warna dan simbol. Warna merah di beberapa budaya dapat berarti bahaya, sementara di budaya lain dapat melambangkan keberuntungan. Oleh karena itu, desainer harus mempertimbangkan konteks budaya dalam memilih elemen desain. Selain itu, sistem interaktif harus mendukung <strong>kolaborasi antar pengguna</strong>, misalnya dengan menyediakan fitur berbagi dokumen atau komunikasi dalam aplikasi.</p>
    
    <h2>Komponen <i>Human Factors</i></h2>
    <h3>A. Persepsi</h3>
    <p>Persepsi adalah bagaimana pengguna menangkap informasi dari lingkungan melalui indra. Prinsip utama dalam desain antarmuka yang baik meliputi <strong>visibilitas, kontras,</strong> dan <strong>hierarki visual</strong>. Elemen-elemen penting harus ditampilkan dengan jelas agar pengguna dapat dengan cepat mengidentifikasi informasi yang mereka butuhkan.</p>
    
    <h3>B. Kognisi</h3>
    <p>Kognisi mencakup cara pengguna memahami dan memproses informasi. <strong>Konsistensi desain</strong> sangat penting untuk memudahkan pengguna mengenali pola antarmuka. Selain itu, <strong>beban kognitif</strong> harus diminimalkan dengan menyajikan informasi secara bertahap, sehingga pengguna tidak merasa kewalahan.</p>
    
    <h3>C. Motorik</h3>
    <p>Interaksi pengguna dengan sistem juga dipengaruhi oleh faktor motorik, seperti <strong>gerakan tangan</strong> dan <strong>gerakan mata</strong>. Desain sistem harus memastikan bahwa pengguna dapat berinteraksi dengan mudah tanpa harus melakukan gerakan yang tidak perlu. Elemen penting, seperti tombol aksi, sebaiknya ditempatkan di lokasi yang mudah dijangkau, terutama dalam desain aplikasi mobile.</p>
    
    <h2>Prinsip Desain Human-centered</h2>
    <p>Prinsip desain yang berpusat pada pengguna (Human-Centered Design) menekankan pentingnya <strong>konsistensi, pencegahan kesalahan, fleksibilitas, dan feedback yang cepat</strong>. Konsistensi dalam desain membantu pengguna merasa familiar dengan antarmuka, sementara pencegahan kesalahan dapat dilakukan dengan menampilkan dialog konfirmasi sebelum tindakan yang bersifat kritis. Selain itu, sistem harus fleksibel agar dapat disesuaikan dengan preferensi pengguna, misalnya dengan menyediakan mode terang dan mode gelap.</p>
    
    <h2>Model Mental dan Desain Interaksi</h2>
    <p>Model mental adalah cara pengguna memahami cara kerja sebuah sistem. Jika desain sistem sesuai dengan ekspektasi pengguna, maka interaksi akan lebih mudah dan intuitif. <strong>Affordances</strong> dalam desain antarmuka membantu memberikan petunjuk visual, misalnya tombol yang terlihat bisa ditekan atau ikon yang menunjukkan fungsinya dengan jelas.</p>
    
    <h2>Penerapan Human Factors dalam Proyek UX dan Kaitan dengan Usability</h2>
    <p>Dalam proyek UX, proses desain harus melibatkan riset pengguna, pembuatan prototipe, dan pengujian usability untuk memastikan bahwa sistem dapat digunakan dengan optimal. Human Factors berperan penting dalam usability, di mana faktor persepsi, kognisi, dan motorik harus diperhitungkan dalam mendesain sistem yang mudah dipahami, efisien, dan nyaman digunakan.</p>
    
    <h2>Panduan Aksesibilitas</h2>
    <p>Panduan aksesibilitas bertujuan untuk memastikan bahwa sistem dapat digunakan oleh semua orang, termasuk pengguna dengan keterbatasan fisik atau kognitif. Web Content Accessibility Guidelines (WCAG) dari W3C mengidentifikasi empat prinsip utama aksesibilitas:</p>
    <ul>
    <li><strong>Perceivable</strong> – Informasi harus dapat dirasakan oleh semua pengguna, misalnya dengan menyediakan teks alternatif untuk gambar atau memungkinkan penyesuaian ukuran font.</li>
    <li><strong>Operable</strong> – Navigasi harus dapat dilakukan dengan berbagai metode, seperti menggunakan keyboard atau perangkat bantu bagi penyandang disabilitas.</li>
    <li><strong>Understandable</strong> – Konten harus mudah dipahami, dengan penggunaan bahasa yang sederhana dan struktur yang jelas.</li>
    <li><strong>Robust</strong> – Sistem harus kompatibel dengan berbagai perangkat dan teknologi bantu seperti pembaca layar (screen reader).</li>
    <li><strong>Aksesibilitas</strong> sangat penting dalam desain sistem agar tidak ada kelompok pengguna yang terpinggirkan akibat keterbatasan teknologi yang mereka gunakan.</li>
    </ul>
    
    <h2>Prinsip Ergonomi</h2>
    <p>Ergonomi adalah ilmu yang memastikan bahwa desain sistem sesuai dengan <strong>kebutuhan fisik dan psikologis pengguna</strong>. Dalam konteks desain interaksi, ergonomi bertujuan untuk <strong>mengurangi kelelahan, meningkatkan kenyamanan, dan mengoptimalkan produktivitas</strong> pengguna dalam menggunakan sistem. Dengan menerapkan prinsip ergonomi, sistem dapat memberikan pengalaman yang lebih baik dan mengurangi potensi gangguan kesehatan akibat penggunaan jangka panjang.</p>
    
    <h3>A. Fokus Ergonomi dalam Desain Interaksi – Kenyamanan Fisik</h2>
    <p>Kenyamanan fisik dalam desain interaksi berkaitan dengan <strong>pengaturan tampilan, posisi elemen UI, dan postur pengguna saat berinteraksi dengan sistem</strong>. Salah satu faktor penting adalah menghindari desain yang menyebabkan kelelahan, seperti ukuran teks yang terlalu kecil atau tombol yang sulit dijangkau. Contoh penerapan ergonomi dalam desain adalah <strong>keyboard ergonomis</strong>, yang dirancang untuk mencegah cedera pada pergelangan tangan akibat penggunaan komputer dalam waktu lama.</p>
    
    <h2>Fokus Ergonomi dalam Desain Interaksi – Kenyamanan Psikologis</h2>
    <p>Selain aspek fisik, desain sistem juga harus mempertimbangkan <strong>kenyamanan psikologis pengguna</strong>. Sistem yang buruk dapat menyebabkan frustrasi dan stres, yang akhirnya mengurangi produktivitas dan kepuasan pengguna. Untuk menghindari hal ini, desain harus memberikan <strong>feedback visual yang jelas</strong>, misalnya tombol yang berubah warna saat ditekan, atau animasi yang menunjukkan bahwa suatu proses sedang berjalan. Sistem yang responsif dan memberikan pengalaman yang menyenangkan akan meningkatkan kepuasan pengguna secara keseluruhan.</p>
    
    <h2>Posisi Duduk yang Ergonomis</h2>
    <p>Posisi duduk yang benar sangat penting dalam penggunaan komputer untuk mencegah kelelahan dan cedera pada tubuh. Prinsip ergonomi kerja menyarankan agar:</p>
    <ul>
        <li>Layar komputer sejajar dengan mata, untuk mengurangi ketegangan pada leher.</li>
        <li>Ketinggian kursi dan meja disesuaikan agar pengguna dapat duduk dengan nyaman tanpa menekuk punggung secara berlebihan.</li>
        <li>Pengguna melakukan istirahat sejenak secara berkala untuk mengurangi kelelahan otot dan mata</li>
    </ul>
    <p>Dengan menerapkan posisi duduk yang ergonomis, pengguna dapat bekerja lebih nyaman dan mengurangi risiko masalah kesehatan jangka panjang.</p>
    
    <h2>Aspek Dasar Ergonomi</h2>
        
        <h3>A. Lingkungan Kerja</h3>
        <p>Faktor lingkungan kerja sangat mempengaruhi produktivitas dan kenyamanan pengguna. Beberapa aspek yang perlu diperhatikan dalam ergonomi lingkungan kerja meliputi:</p>
        <ul>
            <li><strong>Lokasi dan pencahayaan stasiun kerja</strong> → Ruangan harus memiliki pencahayaan yang cukup untuk mengurangi ketegangan mata.</li>
            <li><strong>Kondisi suhu dan kebisingan</strong> → Lingkungan kerja yang terlalu panas, dingin, atau bising dapat mengganggu konsentrasi dan kenyamanan pengguna.</li>
            <li><strong>Durasi kerja</strong> → Pengguna perlu diberikan jeda waktu untuk menghindari kelelahan akibat penggunaan perangkat dalam jangka waktu lama.</li>
        </ul>
        
        <h3>B. Tipe Pekerjaan dan Beban Psikologi</h3>
        <p>Ergonomi juga mempertimbangkan tipe pekerjaan dan beban psikologis yang dialami oleh pengguna. Beberapa pertimbangan penting meliputi:</p>
        <ul>
            <li><strong>Apakah pekerjaan membosankan atau menantang?</strong> → Sistem harus memberikan keseimbangan antara kemudahan penggunaan dan tantangan yang cukup untuk menjaga keterlibatan pengguna.</li>
            <li><strong>Apakah pekerjaan memberikan kepuasan?</strong> → Desain sistem yang baik dapat meningkatkan kepuasan kerja dengan menyediakan fitur yang mempermudah tugas pengguna.</li>
        </ul>
        
        <h3>C. Isu Kesehatan dalam Penggunaan Teknologi</h3>
        <p>Teknologi yang tidak dirancang dengan mempertimbangkan Human Factors dapat menyebabkan berbagai masalah kesehatan, termasuk:</p>
        <ul>
            <li><strong>Beban visual</strong> → Iritasi mata, penglihatan kabur, dan sakit kepala akibat menatap layar terlalu lama.</li>
            <li><strong>Beban otot</strong> → Ketegangan otot dan nyeri pada leher, bahu, atau pergelangan tangan akibat posisi yang tidak ergonomis.</li>
            <li><strong>Beban postur tubuh</strong> → Postur duduk yang salah dapat menyebabkan sakit punggung dan masalah tulang belakang.</li>
            <li><strong>Beban tekanan emosi</strong> → Sistem yang sulit digunakan atau membingungkan dapat menyebabkan stres dan kecemasan pada pengguna.</li>
        </ul>
        <p>Untuk mengatasi masalah ini, sistem harus dirancang dengan mempertimbangkan kenyamanan fisik dan psikologis pengguna, serta mendorong kebiasaan kerja yang sehat.</p>
        
        <h3>D. Keluhan, Penyebab, dan Saran dalam Ergonomi</h3>
        <p>Setiap desain sistem harus mempertimbangkan keluhan pengguna dan faktor penyebabnya, agar dapat memberikan solusi yang efektif. Beberapa keluhan umum meliputi:</p>
        <ul>
            <li><strong>Kesulitan dalam navigasi sistem</strong> → Penyebabnya bisa karena desain UI yang tidak konsisten atau kurangnya petunjuk visual.</li>
            <li><strong>Kelelahan mata akibat layar</strong> → Bisa disebabkan oleh pencahayaan yang kurang optimal atau ukuran teks yang terlalu kecil.</li>
            <li><strong>Ketidaknyamanan fisik</strong> → Dapat diatasi dengan menerapkan prinsip ergonomi dalam desain kursi, meja, dan posisi layar.</li>
        </ul>
        
        <h2>Pedoman Ergonomi Web (WCAG, W3C)</h2>
        <p>Pedoman ergonomi untuk desain web meliputi:</p>
        <ul>
            <li><strong>Warna dan kontras yang cukup</strong> → Untuk membantu pengguna dengan keterbatasan penglihatan.</li>
            <li><strong>Kemudahan navigasi</strong> → Hindari gerakan atau klik yang tidak perlu.</li>
            <li><strong>Kompatibilitas dengan teknologi bantu</strong> → Sistem harus dapat diakses oleh pengguna dengan berbagai kebutuhan khusus.</li>
        </ul>
        <p>Dengan mengikuti pedoman WCAG dari W3C, sistem dapat lebih inklusif dan dapat digunakan oleh lebih banyak orang.</p>
        
        <h2>Studi Kasus Ergonomi</h2>
        <p>Ergonomi dalam desain sistem telah diterapkan dalam berbagai produk, seperti:</p>
        <ul>
            <li><strong>Aplikasi transportasi online</strong> → Antarmuka yang sederhana dan menampilkan jalur yang jelas.</li>
            <li><strong>Desain ATM</strong> → Posisi tombol dan layar dirancang agar mudah dijangkau oleh pengguna dengan tinggi badan yang berbeda.</li>
        </ul>
        <p>Studi kasus ini menunjukkan bahwa penerapan Human Factors dalam desain dapat meningkatkan efektivitas dan kenyamanan pengguna dalam berinteraksi dengan sistem.</p>
        `,
      },
    });

    const materialWeek3 = await prisma.material.create({
      data: {
        chapterId: chapter3.id,
        name: 'Usability',
        content: `
          <h3 data-start="52" data-end="82" id="isPasted"><strong data-start="56" data-end="80"><span style="font-size: 24px;">Pengertian Usability</span></strong></h3>
          <p data-start="83" data-end="552">Usability adalah kemampuan suatu sistem, produk, atau layanan untuk memungkinkan pengguna menyelesaikan tugas dengan mudah, efisien, dan menyenangkan. Konsep ini sangat penting dalam desain produk dan sistem interaktif karena berhubungan langsung dengan pengalaman pengguna. Dalam konteks interaksi manusia dan komputer, usability mencakup bagaimana pengguna berinteraksi dengan sistem dan memastikan bahwa pengalaman tersebut memenuhi tujuan pengguna secara optimal.</p>
          <p data-start="554" data-end="798">Menurut Nielsen (1993), usability adalah ukuran seberapa baik suatu produk dapat digunakan oleh pengguna untuk mencapai tujuan tertentu dengan efisiensi, efektivitas, dan kepuasan. Dimensi usability menurut Shneiderman et al. (2016) mencakup:</p>
          <ul style="list-style-type: disc;">
          <li><strong data-start="801" data-end="816">Efektivitas</strong>, yaitu sejauh mana pengguna dapat mencapai tujuannya dengan sistem.</li>
          <li><strong data-start="889" data-end="902">Efisiensi</strong>, yaitu penggunaan sumber daya minimal untuk mencapai tujuan.</li>
          <li><strong data-start="968" data-end="980">Kepuasan</strong>, yaitu seberapa menyenangkan pengalaman pengguna dalam menggunakan sistem.</li>
          </ul>
          <p data-start="1059" data-end="1333">David Benyon menambahkan bahwa usability juga mengacu pada kualitas interaksi pengguna dengan sistem, termasuk waktu yang dibutuhkan untuk menyelesaikan tugas, jumlah kesalahan yang dibuat, dan waktu yang diperlukan agar pengguna menjadi kompeten dalam menggunakan sistem.</p>
          <p data-start="1335" data-end="1553">Sementara itu, Nielsen (2003) menyatakan bahwa usability adalah atribut kualitas yang menilai kemudahan penggunaan antarmuka pengguna serta mencakup metode untuk meningkatkan kemudahan penggunaan dalam proses desain.<br><br></p>
          <h3 data-start="1555" data-end="1604" id="isPasted"><strong data-start="1559" data-end="1602"><span style="font-size: 24px;">Lima Komponen Usability Menurut Nielsen</span></strong></h3>
          <p data-start="1605" data-end="1679">Nielsen mendefinisikan usability ke dalam lima komponen kualitas, yaitu:</p>
          <ol data-start="1681" data-end="2879" style="list-style-type: lower-alpha;">
          <li data-start="1681" data-end="1920"><p data-start="1684" data-end="1702"><strong data-start="1684" data-end="1700">Learnability</strong></p>
          <ul data-start="1706" data-end="1920"><li data-start="1706" data-end="1807">Kemudahan bagi pengguna baru dalam memahami dan mulai menggunakan sistem tanpa kesulitan berarti.</li><li data-start="1811" data-end="1920">Contoh: Google memiliki antarmuka sederhana sehingga pengguna dapat langsung menggunakan fitur pencarian.</li></ul></li><li data-start="1922" data-end="2125"><p data-start="1925" data-end="1941"><strong data-start="1925" data-end="1939">Efficiency</strong></p><ul data-start="1945" data-end="2125"><li data-start="1945" data-end="2036">Seberapa cepat pengguna yang sudah terbiasa dengan sistem dapat menyelesaikan tugasnya.</li><li data-start="2040" data-end="2125">Contoh: Microsoft Word menyediakan shortcut keyboard untuk mempercepat pekerjaan.</li></ul></li><li data-start="2127" data-end="2380"><p data-start="2130" data-end="2148"><strong data-start="2130" data-end="2146">Memorability</strong></p><ul data-start="2152" data-end="2380"><li data-start="2152" data-end="2261">Kemudahan pengguna dalam mengingat cara menggunakan sistem setelah tidak menggunakannya dalam waktu lama.</li><li data-start="2265" data-end="2380">Contoh: ATM memiliki tampilan standar sehingga pengguna tetap bisa menggunakannya meskipun jarang mengaksesnya.</li></ul></li><li data-start="2382" data-end="2647"><p data-start="2385" data-end="2397"><strong data-start="2385" data-end="2395">Errors</strong></p><ul data-start="2401" data-end="2647"><li data-start="2401" data-end="2497">Jumlah dan tingkat kesalahan yang dibuat oleh pengguna serta kemudahan dalam memperbaikinya.</li><li data-start="2501" data-end="2647">Contoh: Gmail memberikan peringatan saat pengguna mencoba mengirim email tanpa lampiran padahal menyebutkan kata "attachment" dalam isi email.</li></ul></li><li data-start="2649" data-end="2879"><p data-start="2652" data-end="2670"><strong data-start="2652" data-end="2668">Satisfaction</strong></p><ul data-start="2674" data-end="2879"><li data-start="2674" data-end="2751">Tingkat kenyamanan dan kepuasan pengguna saat berinteraksi dengan sistem.</li><li data-start="2755" data-end="2879">Contoh: Apple iOS dikenal dengan desainnya yang bersih, animasi yang halus, serta pengalaman pengguna yang menyenangkan.</li><li data-start="2755" data-end="2879"><br></li></ul></li></ol>
          <h3 data-start="2881" data-end="2938" id="isPasted"><strong data-start="2885" data-end="2936"><span style="font-size: 24px;">Usability dalam Konteks Atribut Perangkat Lunak</span></strong></h3>
          <p data-start="2939" data-end="3101">Meskipun usability merupakan aspek penting dalam pengembangan perangkat lunak, ia tidak berdiri sendiri dan harus dipertimbangkan bersama atribut lain, seperti:</p>
          <ol style="list-style-type: lower-alpha;">
          <li><strong data-start="3105" data-end="3122">Functionality</strong>→ Kemampuan sistem dalam menyediakan fitur sesuai kebutuhan pengguna. Contoh: Google Docs memiliki fitur kolaborasi real-time yang mudah digunakan.</li>
          <li><strong data-start="3281" data-end="3296">Performance</strong>→ Kecepatan dan responsivitas sistem dalam menangani tugas. Contoh: Mesin pencari Google memberikan hasil dalam hitungan milidetik.</li>
          <li><strong data-start="3439" data-end="3447">Cost</strong> → Jumlah sumber daya yang diperlukan untuk mengembangkan dan memelihara sistem.</li>
          <li><strong data-start="3532" data-end="3544">Security</strong>→ Perlindungan data pengguna dari ancaman seperti peretasan. Contoh: Sistem perbankan online menggunakan autentikasi dua faktor untuk keamanan tambahan.</li>
          <li><strong data-start="3708" data-end="3727">Maintainability</strong> → Kemudahan perbaikan dan pembaruan sistem.</li>
          <li><strong data-start="3776" data-end="3784">Size</strong> → Ukuran perangkat lunak dalam hal penyimpanan dan konsumsi sumber daya.</li>
          <li><strong data-start="3862" data-end="3877">Reliability</strong>→ Kemampuan sistem untuk berfungsi dengan baik tanpa sering mengalami crash. Contoh: Google Drive jarang mengalami downtime.</li>
          <li><strong data-start="4013" data-end="4026">Standards</strong> → Kepatuhan sistem terhadap standar industri, seperti WCAG untuk aksesibilitas.</li>
          <li><strong data-start="4111" data-end="4128">Marketability</strong> → Seberapa menarik suatu produk bagi pengguna dan daya saingnya di pasar.</li>
          </ol>
          <p>
          <br>
          </p>
          <h3 data-start="4206" data-end="4247" id="isPasted"><strong data-start="4210" data-end="4245"><span style="font-size: 24px;">Perbedaan Usability dan Utility</span></strong></h3>
          <p data-start="4248" data-end="4350">Selain usability, ada konsep lain yang juga penting dalam desain perangkat lunak, yaitu <strong data-start="4336" data-end="4347">utility</strong>.</p>
          <ul data-start="4352" data-end="4626" style="list-style-type: disc;">
          <li data-start="4352" data-end="4431"><strong data-start="4354" data-end="4367">Usability</strong> → Berkaitan dengan kemudahan dan kenyamanan penggunaan fitur.</li><li data-start="4432" data-end="4511"><strong data-start="4434" data-end="4445">Utility</strong> → Mengacu pada penyediaan fitur-fitur yang dibutuhkan pengguna.</li><li data-start="4512" data-end="4626"><strong data-start="4514" data-end="4528">Usefulness</strong> → Kombinasi usability dan utility, mencerminkan seberapa bermanfaat suatu produk bagi pengguna.</li></ul>
          <p>
          <br>
          </p>
          <h3 data-start="4628" data-end="4690" id="isPasted"><strong data-start="4632" data-end="4688"><span style="font-size: 24px;">Manfaat Usability dalam Pengembangan Perangkat Lunak</span></strong></h3>
          <p data-start="4691" data-end="4754">Fokus pada usability memberikan berbagai keuntungan, seperti:</p>
          <ol data-start="4756" data-end="5258" style="list-style-type: lower-alpha;">
          <li data-start="4756" data-end="4856">
          <p data-start="4759" data-end="4802"><strong data-start="4759" data-end="4800">Meningkatkan Pengalaman Pengguna (UX)</strong><br>Pengguna lebih puas dan loyal terhadap produk.</p>
          </li>
          <li data-start="4858" data-end="4974">
          <p data-start="4861" data-end="4902"><strong data-start="4861" data-end="4900">Meningkatkan Produktivitas Pengguna</strong><br>Pengguna dapat menyelesaikan tugas dengan lebih cepat dan mudah.
          </p>
          </li>
          <li data-start="4976" data-end="5111">
          <p data-start="4979" data-end="5019"><strong data-start="4979" data-end="5017">Mengurangi Biaya Dukungan Pengguna</strong><br>Sistem yang mudah digunakan mengurangi kebutuhan akan pelatihan dan dukungan teknis.</p>
          </li>
          <li data-start="5113" data-end="5258"><p data-start="5116" data-end="5152"><strong data-start="5116" data-end="5150">Meningkatkan Daya Saing Produk</strong><br>Produk lebih mudah diterima oleh pengguna dibandingkan produk dengan antarmuka yang membingungkan.</p>
          </li>
          </ol>
          <p>
          <br>
          </p>
          <p data-start="5116" data-end="5152"><strong><span style="font-size: 24px;">Prinsip dalam Meningkatkan Usability</span></strong></p>
          <p data-start="5307" data-end="5405" id="isPasted">Untuk meningkatkan usability, beberapa prinsip yang perlu diterapkan dalam desain sistem adalah:
          </p>
          <ol data-start="5407" data-end="5934" style="list-style-type: lower-alpha;">
          <li data-start="5407" data-end="5477"><strong data-start="5409" data-end="5424">Konsistensi</strong> → Elemen desain harus seragam agar mudah dipahami.</li>
          <li data-start="5478" data-end="5579"><strong data-start="5480" data-end="5505">Penyederhanaan Proses</strong> → Mengurangi jumlah langkah yang tidak perlu dalam menyelesaikan tugas.</li>
          <li data-start="5580" data-end="5690"><strong data-start="5582" data-end="5608">Umpan Balik yang Jelas</strong> → Memberikan informasi yang mudah dipahami setelah pengguna melakukan tindakan.</li>
          <li data-start="5691" data-end="5819"><strong data-start="5693" data-end="5710">Aksesibilitas</strong> → Memastikan produk dapat digunakan oleh semua pengguna, termasuk mereka yang memiliki keterbatasan fisik.</li>
          <li data-start="5820" data-end="5934"><strong data-start="5822" data-end="5845">Pengujian Usability</strong> → Melakukan evaluasi secara teratur untuk mengidentifikasi masalah dan memperbaikinya.</li>
          </ol>
          <p>
          <br>
          </p>
          <p><strong><span style="font-size: 24px;">Kesimpulan</span></strong></p>
          <p><span style="font-size: 14px;">Usability harus menjadi fokus dalam berbagai tahap pengembangan produk, terutama sejak tahap perancangan. Pengujian usability harus dilakukan sejak awal pengembangan untuk menghindari kesalahan desain yang dapat berdampak pada pengalaman pengguna. Oleh karena itu, usability bukan hanya sekadar fitur tambahan, melainkan merupakan elemen kunci dalam menciptakan produk yang sukses dan mudah digunakan oleh penggunanya.</span></p>
        `,
      },
    });

    const material4 = await prisma.material.create({
      data: {
        chapterId: chapter4.id,
        name: 'Heuristic Evaluation: Nielsen’s 10 Principles',
        content: `
          <h2>Definisi Usability Testing</h2>
    <p>Usability testing adalah proses evaluasi produk atau sistem dengan menguji langsung pada pengguna untuk mengukur kemudahan penggunaan, efisiensi, dan kepuasan pengguna dalam berinteraksi dengan antarmuka. Menurut Preece et al. (2019), usability testing membantu dalam memahami bagaimana pengguna berinteraksi dengan sistem dan mengidentifikasi kendala yang mereka hadapi selama proses penggunaan.</p>
    
    <h2>Tujuan Usability Testing</h2>
    <p>Menurut Nielsen (1993), usability testing memiliki beberapa tujuan utama:</p>
    <ul>
        <li>Mengidentifikasi masalah usability dalam antarmuka pengguna.</li>
        <li>Menilai performa pengguna dalam menyelesaikan tugas tertentu.</li>
        <li>Mengumpulkan umpan balik dari pengguna yang dapat digunakan untuk perbaikan desain.</li>
    </ul>
    
    <h2>Usability Guidelines</h2>
    <p>Usability guidelines adalah sekumpulan prinsip yang digunakan untuk memastikan bahwa desain sistem interaktif mendukung efektivitas, efisiensi, dan kepuasan pengguna. Beberapa pedoman yang sering digunakan dalam desain interaksi meliputi:</p>
    <ul>
        <li><strong>Golden Rules of Interface Design</strong> (Shneiderman et al., 2016), yang menekankan prinsip-prinsip dasar dalam desain UI.</li>
        <li><strong>Norman's 10 Design Principles</strong> (Norman, 2013), yang berfokus pada bagaimana pengguna memahami dan berinteraksi dengan antarmuka.</li>
        <li><strong>Web Content Accessibility Guidelines (WCAG)</strong> dari W3C, yang memberikan panduan tentang aksesibilitas bagi pengguna dengan kebutuhan khusus.</li>
        <li><strong>Tognazzini’s Principles of Interaction Design</strong>, yang menyoroti prinsip dalam menciptakan pengalaman pengguna yang lebih baik.</li>
    </ul>
    
    <h2>Definisi Heuristic Evaluation</h2>
    <p>Heuristic Evaluation adalah metode evaluasi usability yang dilakukan oleh sekelompok evaluator yang menilai sistem berdasarkan serangkaian prinsip atau heuristik yang telah ditetapkan. Metode ini diperkenalkan oleh Jakob Nielsen (1993) sebagai pendekatan yang cepat dan efisien dalam mengidentifikasi masalah usability tanpa perlu melakukan pengujian langsung pada pengguna. Evaluasi heuristik memiliki beberapa manfaat utama, antara lain:</p>
    <ul>
        <li>Mengidentifikasi masalah usability dengan cepat tanpa perlu melakukan pengujian pengguna secara langsung.</li>
        <li>Mengurangi biaya pengembangan dengan mengatasi masalah usability sejak awal dalam siklus desain.</li>
        <li>Membantu dalam merancang pengalaman pengguna (UX) yang lebih baik, terutama pada tahap prototipe sebelum produk dirilis.</li>
    </ul>

<p>Evaluasi heuristik memainkan peran penting dalam siklus pengembangan produk karena memungkinkan tim desain untuk mendeteksi masalah usability lebih awal. Hal ini membantu dalam memastikan bahwa perbaikan dilakukan sebelum produk diuji oleh pengguna akhir. Selain itu, evaluasi heuristik menjadi bagian dari siklus iteratif dalam desain UX dengan memberikan umpan balik yang berguna untuk meningkatkan pengalaman pengguna secara keseluruhan.</p>
    
    <h2>Sejarah Singkat Pengembangan 10 Prinsip Nielsen</h2>
    <p>Prinsip heuristik yang dikembangkan oleh Jakob Nielsen pada tahun 1990-an didasarkan pada penelitian usability dan pengalaman dalam menilai antarmuka pengguna. Awalnya, Nielsen memperkenalkan sembilan prinsip, yang kemudian diperbarui menjadi sepuluh prinsip yang lebih komprehensif (Nielsen, 1993). Prinsip ini telah menjadi standar dalam evaluasi desain UX hingga saat ini.</p>

<h2>Prinsip-Prinsip Heuristic Evaluation</h2>
    <p>Pada sesi ini, kita akan membahas lebih dalam mengenai prinsip-prinsip dalam evaluasi heuristik yang dikembangkan oleh Jakob Nielsen. Prinsip-prinsip ini bertujuan untuk membantu evaluator dalam mengidentifikasi masalah usability dalam suatu sistem.</p>
    
    <h3>A. Visibility of System Status</h3>
    <p>Sistem harus selalu memberi tahu pengguna tentang apa yang sedang terjadi melalui umpan balik yang tepat waktu.</p>
    <ul>
        <li> Memberikan notifikasi real-time tentang status sistem.</li>
        <li> Menampilkan indikator loading atau progress bar untuk menghindari kebingungan pengguna.</li>
        <li> Memberikan konfirmasi saat suatu aksi telah dilakukan.</li>
    </ul>
    
    <h3>B. Match Between System and the Real World</h3>
    <p>Antarmuka harus menggunakan bahasa, istilah, dan konsep yang sudah familiar bagi pengguna.</p>
    <ul>
        <li> Menggunakan ikon dan simbol yang sesuai dengan dunia nyata.</li>
        <li> Bahasa yang digunakan harus mudah dipahami dan sesuai dengan terminologi pengguna.</li>
        <li> Tata letak harus mencerminkan bagaimana pengguna berinteraksi di kehidupan sehari-hari.</li>
    </ul>
    
    <h3>C. User Control and Freedom</h3>
    <p>Pengguna sering kali melakukan kesalahan, sehingga sistem harus memberikan opsi untuk membatalkan atau memperbaiki tindakan yang dilakukan.</p>
    <ul>
        <li> Menyediakan tombol "Undo" untuk membatalkan kesalahan.</li>
        <li> Memungkinkan navigasi kembali dengan tombol "Back".</li>
        <li> Memberikan opsi untuk keluar dari suatu proses tanpa kehilangan data penting.</li>
    </ul>
    
    <h3>D. Consistency and Standards</h3>
    <p>Desain sistem harus konsisten di seluruh antarmuka agar pengguna tidak perlu belajar ulang bagaimana cara menggunakannya.</p>
    <ul>
        <li> Menggunakan ikon yang sama untuk fungsi yang sama di seluruh sistem.</li>
        <li> Menyesuaikan standar desain yang umum digunakan dalam industri.</li>
        <li> Menyediakan navigasi yang seragam di semua halaman.</li>
    </ul>
    
    <h3>E. Error Prevention</h3>
    <p>Sistem harus dirancang untuk mencegah kesalahan sebelum terjadi.</p>
    <ul>
        <li> Menampilkan pesan konfirmasi sebelum menghapus data penting.</li>
        <li> Memvalidasi input pengguna sebelum dikirimkan.</li>
        <li> Menyediakan rekomendasi atau saran untuk menghindari kesalahan.</li>
    </ul>
    
    <h3>F. Recognition Rather than Recall</h3>
    <p>Pengguna sebaiknya tidak dipaksa untuk mengingat informasi yang tidak perlu.</p>
    <ul>
        <li> Menampilkan daftar pilihan daripada meminta pengguna mengetik ulang informasi.</li>
        <li> Menyediakan ikon atau label yang membantu mengenali fungsi.</li>
        <li> Menampilkan riwayat aktivitas pengguna untuk mempermudah navigasi.</li>
    </ul>
    
    <h3>G. Flexibility and Efficiency of Use</h3>
    <p>Desain sistem harus fleksibel untuk berbagai tingkat keahlian pengguna.</p>
    <ul>
        <li> Menyediakan pintasan keyboard untuk pengguna tingkat lanjut.</li>
        <li> Memberikan opsi kustomisasi tampilan atau tata letak.</li>
        <li> Memungkinkan mode navigasi cepat bagi pengguna berpengalaman.</li>
    </ul>
    
    <h3>H. Aesthetic and Minimalist Design</h3>
    <p>Antarmuka harus dibuat sesederhana mungkin, hanya menampilkan elemen yang benar-benar diperlukan.</p>
    <ul>
        <li> Mengurangi elemen yang tidak perlu untuk menghindari kebingungan.</li>
        <li> Menjaga keseimbangan antara estetika dan fungsionalitas.</li>
        <li> Menggunakan warna dan tata letak yang tidak mengganggu pengguna.</li>
    </ul>
    
    <h3>I. Help Users Recognize, Diagnose, and Recover from Errors</h3>
    <p>Pesan kesalahan harus ditampilkan dengan jelas, menggunakan bahasa yang dapat dipahami oleh pengguna.</p>
    <ul>
        <li> Menyediakan deskripsi kesalahan yang informatif.</li>
        <li> Memberikan solusi atau langkah untuk memperbaiki kesalahan.</li>
        <li> Menampilkan pesan error dengan warna atau ikon yang mencolok.</li>
    </ul>
    
    <h3>J. Help and Documentation</h3>
    <p>Sistem harus menyediakan dokumentasi atau panduan yang mudah diakses untuk membantu pengguna menyelesaikan masalah yang mereka hadapi.</p>
    <ul>
        <li> Menyediakan FAQ yang berisi jawaban atas pertanyaan umum.</li>
        <li> Memiliki tutorial interaktif untuk membantu pengguna baru.</li>
        <li> Memudahkan akses ke dokumentasi melalui menu bantuan.</li>
    </ul>
    <p>Seiring perkembangan teknologi, evaluasi heuristik akan terus berkembang dan beradaptasi dengan tren baru, seperti kecerdasan buatan (AI) dan realitas virtual (VR). Evaluasi heuristik akan tetap menjadi alat penting dalam menciptakan pengalaman pengguna yang lebih baik di berbagai platform. Evaluasi heuristik memainkan peran penting dalam siklus pengembangan produk karena memungkinkan tim desain untuk mendeteksi masalah usability lebih awal. Dengan melakukan evaluasi ini, pengembang dapat memastikan bahwa sistem yang dikembangkan lebih mudah digunakan dan sesuai dengan kebutuhan pengguna sebelum produk dirilis ke publik.</p>
    <h2>Cara Melakukan Heuristic Evaluation</h2>
    <p>Evaluasi heuristik dilakukan dengan beberapa langkah sistematis:</p>
    <ol>
        <li><strong>Menentukan evaluator</strong>: Biasanya terdiri dari 3-5 orang ahli UX.</li>
        <li><strong>Meninjau sistem atau produk</strong>: Evaluator mengamati antarmuka dan interaksi pengguna.</li>
        <li><strong>Menggunakan daftar heuristik</strong>: Evaluator menilai sistem berdasarkan prinsip heuristik.</li>
        <li><strong>Mencatat permasalahan usability</strong>: Setiap evaluator mendokumentasikan masalah yang ditemukan.</li>
        <li><strong>Mengategorikan masalah berdasarkan tingkat keparahan</strong>: Menentukan prioritas perbaikan.</li>
        <li><strong>Memberikan rekomendasi perbaikan</strong>: Solusi yang dapat diterapkan untuk meningkatkan pengalaman pengguna.</li>
    </ol>
<h2>Severity Rating dalam Heuristic Evaluation</h2>
    <p>Severity rating digunakan untuk memberi nilai pada masalah usability dengan skala 0-4:</p>
    <ul>
        <li><strong>0 - Bukan masalah usability</strong>: Tidak memerlukan perbaikan.</li>
        <li><strong>1 - Masalah kosmetik</strong>: Tidak perlu diperbaiki segera.</li>
        <li><strong>2 - Masalah minor</strong>: Perlu diperbaiki tetapi tidak kritis.</li>
        <li><strong>3 - Masalah mayor</strong>: Berdampak signifikan pada usability.</li>
        <li><strong>4 - Masalah kritis</strong>: Harus segera diperbaiki sebelum produk dirilis.</li>
    </ul>
    
    <h2>Petunjuk Heuristic Evaluation yang Baik</h2>
    <p>Untuk memastikan evaluasi heuristik berjalan efektif, beberapa panduan yang harus diikuti meliputi:</p>
    <ul>
        <li>Gunakan evaluator yang memiliki pengalaman dalam UX.</li>
        <li>Gabungkan evaluasi heuristik dengan metode usability lainnya.</li>
        <li>Gunakan skala keparahan masalah untuk memprioritaskan perbaikan.</li>
        <li>Buat laporan hasil evaluasi yang jelas dan mudah dimengerti.</li>
    </ul>
<h2>10 Prinsip Nielsen</h2>
        <ol>
            <li><strong>Visibility of System Status:</strong> Sistem harus selalu memberikan umpan balik kepada pengguna tentang status terkini.</li>
            <li><strong>Match Between System and Real World:</strong> Sistem harus menggunakan bahasa dan konsep yang familiar bagi pengguna.</li>
            <li><strong>User Control and Freedom:</strong> Pengguna harus dapat membatalkan atau mengulang tindakan dengan mudah.</li>
            <li><strong>Consistency and Standards:</strong> Desain harus konsisten dan mengikuti standar yang dikenal luas.</li>
            <li><strong>Error Prevention:</strong> Sistem harus dirancang untuk mencegah kesalahan sebelum terjadi.</li>
            <li><strong>Recognition Rather than Recall:</strong> Kurangi beban kognitif dengan menampilkan opsi yang mudah dikenali.</li>
            <li><strong>Flexibility and Efficiency of Use:</strong> Sistem harus dapat digunakan oleh pemula maupun pengguna ahli dengan efisien.</li>
            <li><strong>Aesthetic and Minimalist Design:</strong> Antarmuka harus sederhana dan tidak membebani pengguna dengan informasi yang tidak perlu.</li>
            <li><strong>Help Users Recognize, Diagnose, and Recover from Errors:</strong> Sistem harus menyediakan pesan kesalahan yang jelas dan solutif.</li>
            <li><strong>Help and Documentation:</strong> Dokumentasi harus mudah diakses dan dipahami oleh pengguna.</li>
        </ol>
    
        `,
      },
    });

    const materialWeek5 = await prisma.material.create({
      data: {
        chapterId: chapter5.id,
        name: 'VISUAL ELEMENTS, INFORMATION HIERARCHY, CONSISTENCY, AND INTERFACE READABILITY',
        content: `
          <p id="isPasted"><strong><span style="font-size: 24px;">Pendahuluan</span></strong></p>
          <p>Desain yang baik mempertimbangkan bagaimana pengguna memproses informasi, bernavigasi dalam antarmuka, dan memahami konten dengan cepat dan efisien. Prinsip-prinsip ini berlaku tidak hanya untuk aplikasi desktop atau web, tetapi juga untuk desain interaksi berbasis perangkat seluler, IoT (Internet of Things), dan teknologi lainnya. Secara khusus, file ini akan membahas tentang:</p>
          <ul style="list-style-type: disc;">
          <li>Elemen visual dalam antarmuka pengguna.</li>
          <li>Hierarki informasi dalam antarmuka.</li>
          <li>Konsistensi dalam desain antarmuka.</li>
          <li>Keterbacaan antarmuka.</li>
          </ul><p><br></p>
          <p><strong><span style="font-size: 24px;">Elemen Visual dalam Antarmuka Pengguna</span></strong></p>
          <p>Elemen visual memegang peranan penting dalam menarik perhatian pengguna, menyampaikan informasi, dan menciptakan pengalaman yang menyenangkan. File ini membahas beberapa elemen visual utama, yaitu:</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Warna (Color)</strong></li>
          </ul>
          <p id="isPasted">Warna bukan hanya sekadar elemen estetika, tetapi juga alat komunikasi yang kuat dalam UI. Penggunaan warna yang tepat dapat:</p>
          <p style="margin-left: 20px;"><strong>Membedakan informasi</strong>: Warna yang berbeda dapat digunakan untuk memisahkan berbagai kategori informasi, seperti tombol utama vs. tombol sekunder.</p>
          <p style="margin-left: 20px;"><strong>Memberikan isyarat visual</strong>: Warna dapat digunakan untuk menunjukkan status elemen, misalnya warna hijau untuk "berhasil" dan merah untuk "gagal".</p>
          <p style="margin-left: 20px;"><strong>Meningkatkan daya tarik</strong>: Kombinasi warna yang harmonis dapat membuat antarmuka lebih menarik dan menyenangkan untuk digunakan.</p>
          <p>File ini juga menyinggung tentang:</p><p id="isPasted" style="margin-left: 20px;"><strong>Teori Warna</strong>: Prinsip-prinsip panduan untuk membuat kombinasi warna yang harmonis. Tujuannya adalah menjelaskan hubungan warna untuk menciptakan harmoni.</p>
          <p style="margin-left: 20px;"><strong>Color Wheel</strong>: Terdiri dari Primary Color (Merah, Biru, Kuning), Secondary Color (Hijau, Orange, Ungu), Tertiary Color (campuran warna primer dan sekunder).</p>
          <p style="margin-left: 20px;"><strong>Harmonisasi Warna</strong>: Memberikan daya tarik estetika dan user experience (UX) yang baik, serta memikirkan skema warna di awal proses desain.</p>
          <p style="margin-left: 20px;"><strong>Skema Kombinasi Warna</strong>: Monochromatic, Analogous, Complementary, Split-Complementary (Compound Harmony), Triadic, Tetradic, Square.</p>
          <p style="margin-left: 20px;"><strong>Pedoman Desain Warna</strong>: Menghindari warna saturated, menggunakan sedikit warna, dan konsisten dengan ekspektasi.</p>
          <p style="margin-left: 20px;"><strong>Tools Harmonisasi Warna</strong>: Adobe Color, Canva, Color Mind, Coolors, HTML Color Codes.</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Tipografi (Typography)</strong></li></ul>
          <p>Tipografi melibatkan pemilihan dan pengaturan jenis huruf (font) untuk menciptakan teks yang mudah dibaca dan menarik secara visual. Aspek penting dalam tipografi meliputi:</p>
          <p id="isPasted" style="margin-left: 20px;"><strong>Jenis huruf (Font)</strong>: Pemilihan font yang sesuai dengan karakter dan tujuan aplikasi.</p>
          <p style="margin-left: 20px;"><strong>Ukuran</strong>: Ukuran font yang proporsional agar mudah dibaca pada berbagai ukuran layar.</p>
          <p style="margin-left: 20px;"><strong>Gaya huruf (Font Style)</strong>: Penggunaan gaya huruf seperti bold, italic, atau underline untuk menekankan informasi penting.</p>
          <p style="margin-left: 20px;"><strong>Legibility and Readability</strong>: Legibility menciptakan readability: jika kita mudah membedakan masing-masing karakter, maka keseluruhan teks akan lebih mudah dibaca.</p>
          <p style="margin-left: 20px;"><strong>Display Type and Text Type</strong>: Display Type berfungsi sebagai penarik perhatian, sedangkan Text type berfungsi untuk dibaca dengan seksama.</p>
          <p>File ini juga membahas tentang istilah-istilah dalam tipografi, kombinasi huruf dan jaraknya, huruf kapital dan huruf kecil, jarak antar huruf, jarak antar kata, dan jarak antar baris.</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Ikonografi (Iconography)</strong></li></ul>
          <p>Ikon adalah simbol visual yang digunakan untuk mewakili objek, tindakan, atau konsep. Ikon yang baik harus:</p>
          <p id="isPasted" style="margin-left: 20px;"><strong>Intuitif</strong>: Mudah dikenali dan dipahami oleh pengguna tanpa perlu penjelasan.</p>
          <p style="margin-left: 20px;"><strong>Konsisten</strong>: Menggunakan gaya visual yang seragam di seluruh antarmuka.</p>
          <p style="margin-left: 20px;"><strong>Relevan</strong>: Sesuai dengan konteks penggunaan dan makna yang ingin disampaikan.</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Tata Letak (Layout)</strong></li></ul>
          <p>Tata letak adalah pengaturan elemen-elemen visual dalam antarmuka. Tata letak yang baik harus:</p>
          <p id="isPasted" style="margin-left: 20px;"><strong>Teratur</strong>: Menggunakan sistem grid untuk menciptakan struktur visual yang konsisten.</p>
          <p style="margin-left: 20px;"><strong>Seimbang</strong>: Menghindari penumpukan elemen yang berlebihan di satu area.</p>
          <p style="margin-left: 20px;"><strong>Hierarkis</strong>: Menempatkan elemen yang lebih penting pada posisi yang lebih menonjol.</p>
          <p style="margin-left: 20px;"><strong>Alignment</strong>: memastikan bahwa elemen dalam desain UI/UX memiliki keteraturan yang konsisten.</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Hierarki Informasi dalam Antarmuka</strong></li></ul>
          <p>Hierarki informasi adalah pengaturan informasi dalam antarmuka berdasarkan tingkat kepentingan dan hubungan antar elemen. Hierarki informasi yang baik membantu pengguna untuk:</p>
          <p id="isPasted" style="margin-left: 20px;"><strong>Memahami struktur informasi</strong>: Dengan mudah mengidentifikasi informasi utama dan informasi pendukung.</p><p style="margin-left: 20px;"><strong>Menavigasi antarmuka</strong>: Menemukan informasi yang dicari dengan cepat dan efisien.</p>
          <p style="margin-left: 20px;"><strong>Memproses informasi</strong>: Memahami informasi secara bertahap dan terstruktur.</p><p><br></p><p>File ini membahas tentang prinsip-prinsip Grouping and Hierarchy, yaitu:</p>
          <p id="isPasted" style="margin-left: 20px;"><strong>Proximity (Kedekatan)</strong></p><p style="margin-left: 20px;"><strong>Similarity (Kesamaan)</strong></p><p style="margin-left: 20px;"><strong>Continuity (Keterhubungan)</strong></p><p style="margin-left: 20px;"><strong>Common Region (Wilayah Umum)</strong></p>
          <p style="margin-left: 20px;"><strong>Hierarchy (Hierarki Visual)</strong></p><p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Whitespace (Ruang Kosong)</strong></li></ul>
          <p>Whitespace adalah area kosong dalam desain yang tidak berisi elemen visual, namun memiliki peran penting dalam meningkatkan keterbacaan, estetika, dan fokus pengguna. Whitespace dapat meningkatkan keterbacaan, membantu navigasi, dan memperkuat hierarki visual. Terdapat dua jenis whitespace, yaitu Whitespace Makro (ruang kosong antara bagian utama halaman) dan Whitespace Mikro (Ruang di antara elemen kecil seperti paragraf, ikon, atau tombol).</p>
          <p><br></p><ul style="list-style-type: disc;"><li style="font-weight: bold;"><strong>Alignment and Grids</strong></li></ul><p>Alignment memastikan bahwa elemen dalam desain UI/UX memiliki keteraturan yang konsisten, sedangkan grid adalah sistem tata letak berbasis garis bantu untuk menyusun elemen secara rapi. Alignment berkontribusi pada simplicity sebuah desain. File ini juga membahas tentang prinsip alignment dan elemen grid.</p><p><strong><br></strong></p><ul style="list-style-type: disc;"><li><strong>Konsistensi dan Keterbacaan Antarmuka</strong><br>Kedua aspek ini hanya disebutkan sebagai judul, tetapi tidak dijelaskan lebih lanjut. Secara umum, konsistensi dalam desain antarmuka berarti menggunakan pola dan elemen yang sama di seluruh aplikasi atau situs web. Keterbacaan antarmuka mengacu pada seberapa mudah pengguna dapat membaca dan memahami teks dalam antarmuka.</li></ul>
        `,
      },
    });

    const materialWeek6 = await prisma.material.create({
      data: {
        chapterId: chapter6.id,
        name: 'User-Centered Design (UCD)',
        content: `
          <p id="isPasted"><strong><span style="font-size: 24px;">Definisi User-Centered Design (UCD)</span></strong></p>
          <p>User-Centered Design (UCD) adalah pendekatan desain yang berfokus pada pengguna, di mana kebutuhan, keterbatasan, dan preferensi pengguna menjadi faktor utama dalam proses perancangan sistem atau produk digital (Preece et al., 2019; Benyon, 2019). UCD menempatkan pengguna sebagai fokus utama dalam setiap tahap pengembangan produk atau sistem. Tujuannya adalah untuk memastikan bahwa produk yang dikembangkan benar-benar sesuai dengan kebutuhan, keinginan, dan karakteristik pengguna.</p>
          <p><br></p><p><strong><span style="font-size: 24px;">Konsep Dasar UCD</span></strong></p><p id="isPasted">Konsep dasar UCD mencakup:</p>
          <ul style="list-style-type: disc;"><li>Mengutamakan kebutuhan dan pengalaman pengguna dalam desain.</li>
          <li>Melibatkan pengguna dalam setiap tahap pengembangan.</li><li>Menekankan iterasi dan evaluasi desain untuk memastikan usability yang tinggi.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Pendekatan Desain yang Berfokus pada Pengguna</span></strong></p>
          <p><span style="font-size: 14px;">Pendekatan UCD melibatkan pengguna secara aktif selama proses desain. Desainer tidak hanya mengandalkan asumsi, tetapi juga mengumpulkan masukan langsung dari pengguna melalui berbagai metode seperti wawancara, observasi, dan uji coba prototipe.</span></p>
          <p><br></p><p><span style="font-size: 24px;"><strong>Karakteristik Utama UCD</strong></span></p>
          <ul style="list-style-type: disc;"><li id="isPasted"><strong>Partisipasi Pengguna</strong>: Pengguna berperan aktif dalam setiap tahap pengembangan.</li>
          <li><strong>Iterasi Desain</strong>: Desain dikembangkan secara bertahap berdasarkan umpan balik dari pengguna.</li>
          <li><strong>Evaluasi Berkelanjutan</strong>: Desain diuji dan diperbaiki secara berulang untuk meningkatkan usability.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Manfaat UCD dalam Pengembangan Aplikasi</span></strong></p>
          <p id="isPasted">Berdasarkan teori Norman (2013) dan Nielsen (1993), UCD memberikan beberapa manfaat utama:</p>
          <ul style="list-style-type: disc;"><li><strong>Meningkatkan usability dan user experience (UX)</strong>: Produk lebih mudah digunakan dan lebih efisien.</li>
          <li><strong>Mengurangi kesalahan penggunaan</strong>: Pengguna dapat berinteraksi dengan sistem secara lebih intuitif.</li>
          <li><strong>Meningkatkan kepuasan pengguna</strong>: Produk lebih sesuai dengan kebutuhan pengguna, sehingga meningkatkan engagement.<br><br><strong><span style="font-size: 24px;">Contoh Penerapan UCD: Aplikasi GoFood dan GrabFood</span></strong><br>Aplikasi Pemesanan Makanan:</li>
          <li id="isPasted">Desain antarmuka yang sederhana dan mudah digunakan.</li></ul><p>Proses pemesanan yang cepat dengan opsi pembayaran beragam.<br><strong><span style="font-size: 24px;"><br>Tahapan UCD</span></strong></p><p id="isPasted"><strong>Identify the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Menentukan siapa pengguna utama (primary user), sekunder (secondary user), dan tersier (tertiary user).</li><li>Memahami lingkungan, perilaku, dan pengalaman pengguna.</li></ul><p><br></p><p><strong>Research the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengumpulkan data melalui wawancara, kuesioner, diskusi kelompok (focus groups), observasi langsung di lokasi, dan rekaman video.</li><li>Memahami bagaimana pengguna berinteraksi dengan sistem atau produk yang sedang dikembangkan.</li></ul><p><br></p><p><strong>Create Goals:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengidentifikasi bagaimana kegunaan (usability) dapat diukur.</li><li>Mempertimbangkan faktor efektivitas, efisiensi, keamanan, utilitas, kemudahan belajar (learnability), dan daya ingat pengguna (memorability).</li></ul><p><br></p><p><strong>Design:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Membuat mock-ups atau model/desain awal produk yang dapat diuji oleh pengguna sepanjang proses pengembangan.</li><li>Memastikan instruksi mudah dipahami dengan batasan dan petunjuk visual.</li></ul><p><br></p><p><strong>Prototype:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Model awal atau versi percobaan dari suatu produk sebelum produk akhir dikembangkan.</li><li>Mengembangkan prototype fungsional yang dapat diuji dalam lingkungan nyata.</li></ul><p><br></p><p><strong>Test:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengevaluasi desain dengan melibatkan pengguna.</li><li>Menguji produk dalam lingkungan nyata dan mendokumentasikan hasilnya.</li>
          <li>Memberikan instruksi minimal kepada pengguna untuk melihat apakah produk intuitif.</li></ul><p><br></p><p><strong>Produce:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Melanjutkan evaluasi produk berdasarkan umpan balik melalui wawancara dan survei.</li><li>Menyempurnakan produk berdasarkan hasil evaluasi.</li></ul>
        `,
      },
    });

    const materialWeek7 = await prisma.material.create({
      data: {
        chapterId: chapter7.id,
        name: 'Implementasi User-Centered Design (UCD)',
        content: `
          <p id="isPasted"><strong><span style="font-size: 24px;">Definisi User-Centered Design (UCD)</span></strong></p>
          <p>User-Centered Design (UCD) adalah pendekatan desain yang berfokus pada pengguna, di mana kebutuhan, keterbatasan, dan preferensi pengguna menjadi faktor utama dalam proses perancangan sistem atau produk digital (Preece et al., 2019; Benyon, 2019). UCD menempatkan pengguna sebagai fokus utama dalam setiap tahap pengembangan produk atau sistem. Tujuannya adalah untuk memastikan bahwa produk yang dikembangkan benar-benar sesuai dengan kebutuhan, keinginan, dan karakteristik pengguna.</p>
          <p><br></p><p><strong><span style="font-size: 24px;">Konsep Dasar UCD</span></strong></p><p id="isPasted">Konsep dasar UCD mencakup:</p>
          <ul style="list-style-type: disc;"><li>Mengutamakan kebutuhan dan pengalaman pengguna dalam desain.</li>
          <li>Melibatkan pengguna dalam setiap tahap pengembangan.</li><li>Menekankan iterasi dan evaluasi desain untuk memastikan usability yang tinggi.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Pendekatan Desain yang Berfokus pada Pengguna</span></strong></p>
          <p><span style="font-size: 14px;">Pendekatan UCD melibatkan pengguna secara aktif selama proses desain. Desainer tidak hanya mengandalkan asumsi, tetapi juga mengumpulkan masukan langsung dari pengguna melalui berbagai metode seperti wawancara, observasi, dan uji coba prototipe.</span></p>
          <p><br></p><p><span style="font-size: 24px;"><strong>Karakteristik Utama UCD</strong></span></p>
          <ul style="list-style-type: disc;"><li id="isPasted"><strong>Partisipasi Pengguna</strong>: Pengguna berperan aktif dalam setiap tahap pengembangan.</li>
          <li><strong>Iterasi Desain</strong>: Desain dikembangkan secara bertahap berdasarkan umpan balik dari pengguna.</li>
          <li><strong>Evaluasi Berkelanjutan</strong>: Desain diuji dan diperbaiki secara berulang untuk meningkatkan usability.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Manfaat UCD dalam Pengembangan Aplikasi</span></strong></p>
          <p id="isPasted">Berdasarkan teori Norman (2013) dan Nielsen (1993), UCD memberikan beberapa manfaat utama:</p>
          <ul style="list-style-type: disc;"><li><strong>Meningkatkan usability dan user experience (UX)</strong>: Produk lebih mudah digunakan dan lebih efisien.</li>
          <li><strong>Mengurangi kesalahan penggunaan</strong>: Pengguna dapat berinteraksi dengan sistem secara lebih intuitif.</li>
          <li><strong>Meningkatkan kepuasan pengguna</strong>: Produk lebih sesuai dengan kebutuhan pengguna, sehingga meningkatkan engagement.<br><br><strong><span style="font-size: 24px;">Contoh Penerapan UCD: Aplikasi GoFood dan GrabFood</span></strong><br>Aplikasi Pemesanan Makanan:</li>
          <li id="isPasted">Desain antarmuka yang sederhana dan mudah digunakan.</li></ul><p>Proses pemesanan yang cepat dengan opsi pembayaran beragam.<br><strong><span style="font-size: 24px;"><br>Tahapan UCD</span></strong></p><p id="isPasted"><strong>Identify the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Menentukan siapa pengguna utama (primary user), sekunder (secondary user), dan tersier (tertiary user).</li><li>Memahami lingkungan, perilaku, dan pengalaman pengguna.</li></ul><p><br></p><p><strong>Research the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengumpulkan data melalui wawancara, kuesioner, diskusi kelompok (focus groups), observasi langsung di lokasi, dan rekaman video.</li><li>Memahami bagaimana pengguna berinteraksi dengan sistem atau produk yang sedang dikembangkan.</li></ul><p><br></p><p><strong>Create Goals:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengidentifikasi bagaimana kegunaan (usability) dapat diukur.</li><li>Mempertimbangkan faktor efektivitas, efisiensi, keamanan, utilitas, kemudahan belajar (learnability), dan daya ingat pengguna (memorability).</li></ul><p><br></p><p><strong>Design:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Membuat mock-ups atau model/desain awal produk yang dapat diuji oleh pengguna sepanjang proses pengembangan.</li><li>Memastikan instruksi mudah dipahami dengan batasan dan petunjuk visual.</li></ul><p><br></p><p><strong>Prototype:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Model awal atau versi percobaan dari suatu produk sebelum produk akhir dikembangkan.</li><li>Mengembangkan prototype fungsional yang dapat diuji dalam lingkungan nyata.</li></ul><p><br></p><p><strong>Test:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengevaluasi desain dengan melibatkan pengguna.</li><li>Menguji produk dalam lingkungan nyata dan mendokumentasikan hasilnya.</li>
          <li>Memberikan instruksi minimal kepada pengguna untuk melihat apakah produk intuitif.</li></ul><p><br></p><p><strong>Produce:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Melanjutkan evaluasi produk berdasarkan umpan balik melalui wawancara dan survei.</li><li>Menyempurnakan produk berdasarkan hasil evaluasi.</li></ul>
        `,
      },
    });

    const materialWeek8 = await prisma.material.create({
      data: {
        chapterId: chapter8.id,
        name: 'UTS',
        content: `
          <p id="isPasted"><strong><span style="font-size: 24px;">Definisi User-Centered Design (UCD)</span></strong></p>
          <p>User-Centered Design (UCD) adalah pendekatan desain yang berfokus pada pengguna, di mana kebutuhan, keterbatasan, dan preferensi pengguna menjadi faktor utama dalam proses perancangan sistem atau produk digital (Preece et al., 2019; Benyon, 2019). UCD menempatkan pengguna sebagai fokus utama dalam setiap tahap pengembangan produk atau sistem. Tujuannya adalah untuk memastikan bahwa produk yang dikembangkan benar-benar sesuai dengan kebutuhan, keinginan, dan karakteristik pengguna.</p>
          <p><br></p><p><strong><span style="font-size: 24px;">Konsep Dasar UCD</span></strong></p><p id="isPasted">Konsep dasar UCD mencakup:</p>
          <ul style="list-style-type: disc;"><li>Mengutamakan kebutuhan dan pengalaman pengguna dalam desain.</li>
          <li>Melibatkan pengguna dalam setiap tahap pengembangan.</li><li>Menekankan iterasi dan evaluasi desain untuk memastikan usability yang tinggi.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Pendekatan Desain yang Berfokus pada Pengguna</span></strong></p>
          <p><span style="font-size: 14px;">Pendekatan UCD melibatkan pengguna secara aktif selama proses desain. Desainer tidak hanya mengandalkan asumsi, tetapi juga mengumpulkan masukan langsung dari pengguna melalui berbagai metode seperti wawancara, observasi, dan uji coba prototipe.</span></p>
          <p><br></p><p><span style="font-size: 24px;"><strong>Karakteristik Utama UCD</strong></span></p>
          <ul style="list-style-type: disc;"><li id="isPasted"><strong>Partisipasi Pengguna</strong>: Pengguna berperan aktif dalam setiap tahap pengembangan.</li>
          <li><strong>Iterasi Desain</strong>: Desain dikembangkan secara bertahap berdasarkan umpan balik dari pengguna.</li>
          <li><strong>Evaluasi Berkelanjutan</strong>: Desain diuji dan diperbaiki secara berulang untuk meningkatkan usability.</li>
          </ul><p><br></p><p><strong><span style="font-size: 24px;">Manfaat UCD dalam Pengembangan Aplikasi</span></strong></p>
          <p id="isPasted">Berdasarkan teori Norman (2013) dan Nielsen (1993), UCD memberikan beberapa manfaat utama:</p>
          <ul style="list-style-type: disc;"><li><strong>Meningkatkan usability dan user experience (UX)</strong>: Produk lebih mudah digunakan dan lebih efisien.</li>
          <li><strong>Mengurangi kesalahan penggunaan</strong>: Pengguna dapat berinteraksi dengan sistem secara lebih intuitif.</li>
          <li><strong>Meningkatkan kepuasan pengguna</strong>: Produk lebih sesuai dengan kebutuhan pengguna, sehingga meningkatkan engagement.<br><br><strong><span style="font-size: 24px;">Contoh Penerapan UCD: Aplikasi GoFood dan GrabFood</span></strong><br>Aplikasi Pemesanan Makanan:</li>
          <li id="isPasted">Desain antarmuka yang sederhana dan mudah digunakan.</li></ul><p>Proses pemesanan yang cepat dengan opsi pembayaran beragam.<br><strong><span style="font-size: 24px;"><br>Tahapan UCD</span></strong></p><p id="isPasted"><strong>Identify the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Menentukan siapa pengguna utama (primary user), sekunder (secondary user), dan tersier (tertiary user).</li><li>Memahami lingkungan, perilaku, dan pengalaman pengguna.</li></ul><p><br></p><p><strong>Research the User:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengumpulkan data melalui wawancara, kuesioner, diskusi kelompok (focus groups), observasi langsung di lokasi, dan rekaman video.</li><li>Memahami bagaimana pengguna berinteraksi dengan sistem atau produk yang sedang dikembangkan.</li></ul><p><br></p><p><strong>Create Goals:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengidentifikasi bagaimana kegunaan (usability) dapat diukur.</li><li>Mempertimbangkan faktor efektivitas, efisiensi, keamanan, utilitas, kemudahan belajar (learnability), dan daya ingat pengguna (memorability).</li></ul><p><br></p><p><strong>Design:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Membuat mock-ups atau model/desain awal produk yang dapat diuji oleh pengguna sepanjang proses pengembangan.</li><li>Memastikan instruksi mudah dipahami dengan batasan dan petunjuk visual.</li></ul><p><br></p><p><strong>Prototype:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Model awal atau versi percobaan dari suatu produk sebelum produk akhir dikembangkan.</li><li>Mengembangkan prototype fungsional yang dapat diuji dalam lingkungan nyata.</li></ul><p><br></p><p><strong>Test:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Mengevaluasi desain dengan melibatkan pengguna.</li><li>Menguji produk dalam lingkungan nyata dan mendokumentasikan hasilnya.</li>
          <li>Memberikan instruksi minimal kepada pengguna untuk melihat apakah produk intuitif.</li></ul><p><br></p><p><strong>Produce:</strong></p><ul style="list-style-type: disc;"><li id="isPasted">Melanjutkan evaluasi produk berdasarkan umpan balik melalui wawancara dan survei.</li><li>Menyempurnakan produk berdasarkan hasil evaluasi.</li></ul>
        `,
      },
    });

    // ASSESSMENT

    const assessment1 = await prisma.assessment.create({
      data: {
        chapterId: chapter1.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Platform media sosial TikTok saat ini sangat populer di kalangan pengguna. Dari perspektif HCI, faktor utama yang membuat aplikasi ini sukses adalah...",
            options: [
              "Penggunaan server yang canggih",
              "Kode pemrograman yang kompleks",
              "Pemahaman mendalam tentang perilaku dan preferensi pengguna",
              "Penggunaan algoritma AI terbaru",
              "Jumlah dana pengembangan yang besar"
            ],
            answer: "Pemahaman mendalam tentang perilaku dan preferensi pengguna",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi mobile banking memiliki tampilan yang sangat menarik dengan animasi dan grafik yang kompleks, namun beberapa pengguna lansia kesulitan melakukan transaksi dasar. Hal ini menunjukkan bahwa aplikasi tersebut telah memenuhi prinsip utama HCI.",
            options: ["True", "False"],
            answer: "False",
            type: "MC"
          },
          {
            question: "Seorang pengembang website e-commerce menggunakan warna merah untuk tombol Beli Sekarang dan warna abu-abu untuk tombol Tambah ke Keranjang. Keputusan ini termasuk dalam aspek komputer dari HCI.",
            options: ["True", "False"],
            answer: "False",
            type: "MC"
          },
          {
            question: "Sebuah smart TV terbaru menggunakan kontrol suara sebagai input utama. Hal ini merupakan implementasi dari bidang studi yang mempengaruhi HCI yaitu...",
            options: ["Ergonomi", "Psikologi Kognitif", "Linguistik", "Semiotika", "Antropologi"],
            answer: "Linguistik",
            type: "MC"
          },
          {
            question: "Di sebuah rumah sakit, sistem informasi yang baru dipasang mengalami penolakan dari para perawat karena merasa sistem terlalu rumit dibanding pencatatan manual. Dari perspektif HCI, hal ini menunjukkan kegagalan dalam...",
            options: [
              "Kapasitas server",
              "Kecepatan internet",
              "Human-centered design",
              "Design thingking",
              "Usability Testing"
            ],
            answer: "Human-centered design",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Kuliah Interaksi Manusia Komputer', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment2 = await prisma.assessment.create({
      data: {
        chapterId: chapter2.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Sebuah game mobile memiliki tutorial interaktif yang memandu pemain baru step by step. Ini adalah contoh implementasi aspek computer dalam HCI.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Marketplace online menerapkan fitur Rekomendasi Produk berdasarkan riwayat pencarian pengguna. Hal ini merupakan implementasi dari fokus HCI dalam hal...",
            options: [
              "Keamanan sistem",
              "Efisiensi database",
              "User experience",
              "Kecepatan loading",
              "Kapasitas server"
            ],
            answer: "User experience",
            type: "MC"
          },
          {
            question: "Dalam pengembangan aplikasi kesehatan, tim developer menempatkan tombol Panggil Ambulans di pojok kanan atas dengan warna merah mencolok. Keputusan ini didasari oleh bidang studi yang mempengaruhi HCI yaitu...",
            options: [
              "Sosiologi",
              "Psikologi Kognitif",
              "Matematika",
              "Komputer Graphics",
              "Database"
            ],
            answer: "Psikologi Kognitif",
            type: "MC"
          },
          {
            question: "Situs berita online yang memuat banyak konten teks dan gambar namun loading-nya cepat adalah contoh implementasi tujuan HCI dalam hal efisiensi sistem.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Dalam pengembangan ATM terbaru, layar dibuat lebih rendah untuk mengakomodasi pengguna kursi roda. Ini adalah implementasi dari bidang studi yang mempengaruhi HCI yaitu...",
            options: ["Ergonomi", "Psikologi", "Linguistik", "Matematika", "Grafik Komputer"],
            answer: "Ergonomi",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi banking menerapkan fitur autentikasi biometrik (sidik jari/wajah) sebagai alternatif dari password. Dari perspektif Human Factors, hal ini menguntungkan karena...",
            options: [
              "Meningkatkan kecepatan server",
              "Mengurangi beban kognitif pengguna",
              "Menghemat ruang penyimpanan",
              "Meningkatkan bandwidth",
              "Mengurangi biaya operasional"
            ],
            answer: "Mengurangi beban kognitif pengguna",
            type: "MC"
          },
          {
            question: "Aplikasi pembelajaran online menampilkan pesan error 404 - Page Not Found ketika terjadi kesalahan. Hal ini tidak sesuai dengan prinsip desain Human-Centered karena...",
            options: [
              "Menggunakan bahasa teknis",
              "Terlalu singkat",
              "Bahasa Asing",
              "Terlalu panjang",
              "Menggunakan angka"
            ],
            answer: "Menggunakan bahasa teknis",
            type: "MC"
          },
          {
            question: "Sebuah website e-commerce menempatkan tombol Checkout di lokasi yang berbeda-beda setiap kali halaman dimuat ulang untuk memberikan variasi tampilan.",
            options: ["True", "False"],
            answer: "False",
            type: "MC"
          },
          {
            question: "Dalam merancang aplikasi untuk lansia, pengembang menggunakan...",
            options: [
              "Font kecil untuk menghemat ruang",
              "Warna kontras tinggi dan font besar",
              "Animasi yang cepat dan dinamis",
              "Banyak menu tersembunyi",
              "Suara latar yang keras"
            ],
            answer: "Warna kontras tinggi dan font besar",
            type: "MC"
          },
          {
            question: "Seorang desainer membuat form pendaftaran yang meminta pengguna mengisi 20 field dalam satu halaman. Dari perspektif Human Factors, ini bermasalah karena...",
            options: [
              "Terlalu banyak beban server",
              "Masalah keamanan data",
              "Overload kognitif pengguna",
              "Kecepatan internet",
              "Masalah database"
            ],
            answer: "Overload kognitif pengguna",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Kuliah Human Factors and Ergonomic Principles in Design Interaction ', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment3 = await prisma.assessment.create({
      data: {
        chapterId: chapter3.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
              question: "Dalam mendesain workspace virtual, pengembang harus mempertimbangkan...",
              options: [
                "Hanya aspek visual",
                "Hanya aspek auditori",
                "anya aspek kognitif",
                "Multisensory ergonomics",
                "Hanya aspek motor"
              ],
              answer: "Multisensory ergonomics",
              type: "MC"
            },
            {
              question: "Menggunakan warna merah untuk tombol Hapus dan hijau untuk tombol Simpan adalah contoh penerapan model mental yang baik.",
              options: ["True", "False"],
              answer: "True",
              type: "MC"
            },
            {
              question: "Aplikasi produktivitas menampilkan notifikasi setiap 5 menit untuk mengingatkan deadline. Dari perspektif Human Factors, ini problematik karena...",
              options: [
                "Terlalu banyak interupsi",
                "Masalah baterai",
                "Masalah jaringan",
                "Keamanan data",
                "Masalah storage"
              ],
              answer: "Terlalu banyak interupsi",
              type: "MC"
            },
            {
              question: "Dalam mendesain aplikasi untuk anak-anak, pertimbangan Human Factors yang paling penting adalah...",
              options: [
                "Kecepatan sistem",
                "Kapasitas storage",
                "Perkembangan motorik",
                "Efisiensi database",
                "Keamanan server"
              ],
              answer: "Perkembangan motorik",
              type: "MC"
            },
            {
              question: "Aplikasi video conference menggunakan layout yang dapat disesuaikan pengguna. Ini merupakan implementasi dari...",
              options: [
                "Fleksibilitas dan efisiensi",
                "Kecepatan sistem",
                "Keamanan data",
                "Manajemen server",
                "Protokol jaringan"
              ],
              answer: "Fleksibilitas dan efisiensi",
              type: "MC"
            },
            {
              question: "Aplikasi mobile banking memiliki fitur keamanan yang sangat ketat dengan 5 langkah verifikasi setiap kali login. Hal ini menunjukkan tingkat usability yang tinggi karena mengutamakan keamanan pengguna.",
              options: ["True", "False"],
              answer: "False",
              type: "MC"
            },
            {
              question: "Sebuah aplikasi pembelajaran online menampilkan pesan error seperti berikut: \"Error code: 0x80070057\". Dari perspektif usability, pesan ini bermasalah karena...",
              options: [
                "Terlalu pendek",
                "Tidak informatif dan sulit dipahami",
                "Menggunakan huruf kecil",
                "Tidak berwarna merah",
                "Tidak ada suara"
              ],
              answer: "Tidak informatif dan sulit dipahami",
              type: "MC"
          },
          {
            question: "Aplikasi pemesanan tiket bioskop memberikan waktu 5 menit untuk menyelesaikan transaksi. Hal ini merupakan implementasi..",
            options: [
              "Efficiency of use",
              "Memorability",
              "Learnability",
              "Satisfaction",
              "Security"
            ],
            answer: "Efficiency of use",
            type: "MC"
          },
          {
            question: "Sebuah form pendaftaran yang menampilkan pesan error setelah user selesai mengisi semua field adalah contoh implementasi usability yang baik.",
            options: ["True", "False"],
            answer: "False",
            type: "MC"
          },
          {
            question: "Website e-learning memberikan badge dan poin untuk setiap tugas yang diselesaikan. Ini meningkatkan usability melalui aspek...",
            options: ["Efficiency", "Learnability", "Satisfaction", "Security", "Speed"],
            answer: "Satisfaction",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Usability', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment4 = await prisma.assessment.create({
      data: {
        chapterId: chapter4.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Seorang pengguna sedang mengisi formulir pendaftaran dalam aplikasi layanan kesehatan. Namun, tidak ada indikator yang menunjukkan apakah sistem sedang memproses data atau tidak. Pengguna merasa bingung apakah formulir telah terkirim atau belum. Prinsip heuristik mana yang tidak diterapkan?",
            options: [
              "Visibility of System Status",
              "User Control and Freedom",
              "Consistency and Standards",
              "Flexibility and Efficiency of Use",
              "Aesthetic and Minimalist Design"
            ],
            answer: "Visibility of System Status",
            type: "MC"
          },
          {
            question: "Dalam sebuah aplikasi mobile, pengguna sering kali tidak sengaja keluar dari aplikasi ketika mencoba menekan tombol “KEMBALI” di halaman pengaturan. Sistem tidak memberikan konfirmasi sebelum keluar. Prinsip mana yang seharusnya diterapkan?",
            options: [
              "Error Prevention",
              "Help and Documentation",
              "User Control and Freedom",
              "Recognition Rather than Recall",
              "Match between System and the Real World"
            ],
            answer: "User Control and Freedom",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi e-commerce memiliki menu navigasi yang berbeda di setiap halaman. Hal ini membuat pengguna kesulitan berpindah antar halaman. Prinsip heuristik mana yang dilanggar?",
            options: [
              "Recognition Rather than Recall",
              "Consistency and Standards",
              "Visibility of System Status",
              "Aesthetic and Minimalist Design",
              "Error Prevention"
            ],
            answer: "Consistency and Standards",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi bank menggunakan istilah “AUTHENTIFICATION TOKEN” untuk menginformasikan kode OTP kepada pengguna. Banyak pengguna bingung dengan istilah tersebut. Prinsip mana yang seharusnya diterapkan?",
            options: [
              "Flexibility and Efficiency of Use",
              "Help Users Recognize, Diagnose, and Recover from Errors",
              "Error Prevention",
              "Match between System and the Real World",
              "Consistency and Standards"
            ],
            answer: "Match between System and the Real World",
            type: "MC"
          },
          {
            question: "Seorang pelanggan sedang membeli produk melalui aplikasi belanja online. Setelah memasukkan alamat, sistem tiba-tiba menghapus semua data yang telah diisi. Hal ini melanggar prinsip:",
            options: [
              "Error Prevention",
              "Help and Documentation",
              "Aesthetic and Minimalist Design",
              "Visibility of System Status",
              "Consistency and Standards"
            ],
            answer: "Error Prevention",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Heuristic Evaluation: Nielsens 10 principles ', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
          
        ]),
      },
    });

    const assessment5 = await prisma.assessment.create({
      data: {
        chapterId: chapter5.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Seorang desainer grafis menggunakan aplikasi edit foto, tetapi aplikasi tersebut tidak memiliki tombol “UNDO” untuk membatalkan perubahan. Hal ini melanggar prinsip:",
            options: [
              "User Control and Freedom",
              "Visibility of System Status",
              "Aesthetic and Minimalist Design",
              "Error Prevention",
              "Recognition Rather than Recall"
            ],
            answer: "User Control and Freedom",
            type: "MC"
          },
          {
            question: "Saat login ke aplikasi perbankan, pengguna mendapatkan pesan error: “ERROR 405: ACCESS DENIED”, tanpa penjelasan lebih lanjut. Prinsip mana yang tidak diterapkan?",
            options: [
              "Error Prevention",
              "Help Users Recognize, Diagnose, and Recover from Errors",
              "Consistency and Standards",
              "Visibility of System Status",
              "Aesthetic and Minimalist Design"
            ],
            answer: "Help Users Recognize, Diagnose, and Recover from Errors",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi desain grafis memiliki banyak fitur tersembunyi yang hanya dapat diakses dengan shortcut keyboard yang tidak dijelaskan di antarmuka. Prinsip heuristik apa yang diabaikan?",
            options: [
              "Flexibility and Efficiency of Use",
              "Visibility of System Status",
              "Help and Documentation",
              "Recognition Rather than Recall",
              "Consistency and Standards"
            ],
            answer: "Flexibility and Efficiency of Use",
            type: "MC"
          },
          {
            question: "Seorang pengguna ingin mengatur ulang pengaturan aplikasi, tetapi tidak ada panduan atau dokumentasi yang menjelaskan bagaimana cara melakukannya. Prinsip mana yang dilanggar?",
            options: [
              "Help and Documentation",
              "Consistency and Standards",
              "Match between System and the Real World",
              "Recognition Rather than Recall",
              "Error Prevention"
            ],
            answer: "Help and Documentation",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi manajemen proyek memiliki terlalu banyak informasi yang ditampilkan dalam satu layar, membuat pengguna kesulitan fokus pada tugas utama. Prinsip mana yang harus diterapkan?",
            options: [
              "Aesthetic and Minimalist Design",
              "Recognition Rather than Recall",
              "Help Users Recognize, Diagnose, and Recover from Errors",
              "Visibility of System Status",
              "User Control and Freedom"
            ],
            answer: "Aesthetic and Minimalist Design",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Visual Elements, Information Hierarchy, Consistency, and Interface Readability ', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment6 = await prisma.assessment.create({
      data: {
        chapterId: chapter6.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Sebuah aplikasi layanan kesehatan menggunakan latar belakang biru tua dengan teks hitam untuk menampilkan informasi pasien. Beberapa pengguna mengeluh bahwa mereka sulit membaca teks tersebut. Prinsip desain mana yang diabaikan?",
            options: [
              "Visual Hierarchy",
              "Typography Readability",
              "Color Contrast",
              "Recognition Rather than Recall",
              "User Control and Freedom"
            ],
            answer: "Color Contrast",
            type: "MC"
          },
          {
            question: "Sebuah situs e-commerce memiliki tombol “CHECKOUT” yang di beberapa halaman ditampilkan sebagai “BAYAR SEKARANG”. Hal ini membuat pengguna bingung. Masalah ini terkait dengan prinsip:",
            options: [
              "Consistency and Standards",
              "User Control and Freedom",
              "Information Hierarchy",
              "Aesthetic and Minimalist Design",
              "Error Prevention"
            ],
            answer: "Consistency and Standards",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi berita menggunakan layout yang tidak sejajar, dengan paragraf yang memiliki panjang baris tidak konsisten dan tata letak yang tampak berantakan. Hal ini berkaitan dengan:",
            options: [
              "Information Grouping",
              "Alignment and Grids",
              "Whitespace Management",
              "Recognition Rather than Recall",
              "Error Prevention"
            ],
            answer: "Alignment and Grids",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi keuangan menggunakan font dengan ukuran sangat kecil untuk menampilkan laporan transaksi. Hal ini menyebabkan pengguna mengalami kesulitan membaca detail transaksi mereka. Prinsip desain manakah yang tidak diterapkan dengan baik?",
            options: [
              "Typography Readability",
              "Color Contrast",
              "Information Hierarchy",
              "Error Prevention",
              "Aesthetic and Minimalist Design"
            ],
            answer: "Typography Readability",
            type: "MC"
          },
          {
            question: "Sebuah situs pendidikan menampilkan judul artikel dengan ukuran lebih kecil dibandingkan isi artikel. Hal ini menyulitkan pengguna dalam menemukan informasi utama. Prinsip desain manakah yang tidak diterapkan dengan baik?",
            options: [
              "User Control and Freedom",
              "Information Grouping",
              "Visual Hierarchy",
              "Recognition Rather than Recall",
              "Consistency and Standards"
            ],
            answer: "Visual Hierarchy",
            type: "MC"
          },
          {
            question: "Dalam sebuah aplikasi mobile banking, tombol “TRANSFER” dan “HAPUS AKUN” memiliki warna yang sama. Hal ini meningkatkan risiko kesalahan pengguna. Prinsip desain manakah yang harus diterapkan?",
            options: [
              "Error Prevention",
              "Consistency and Standards",
              "Flexibility and Efficiency of Use",
              "Help and Documentation",
              "Aesthetic and Minimalist Design"
            ],
            answer: "Error Prevention",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi pesan instan menggunakan ikon berbentuk segitiga untuk fitur “BALAS PESAN”, yang tidak umum digunakan dalam aplikasi serupa. Hal ini dapat mengurangi:",
            options: [
              "Consistency and Standards",
              "Recognition Rather than Recall",
              "Error Prevention",
              "Typography Readability",
              "Information Grouping"
            ],
            answer: "Recognition Rather than Recall",
            type: "MC"
          },
          {
            question: "Dalam sebuah aplikasi manajemen proyek, semua elemen ditempatkan sangat berdekatan tanpa ruang kosong yang cukup. Hal ini membuat tampilan terlihat penuh dan sulit dipahami. Apa masalah utama dalam desain ini?",
            options: [
              "Typography Readability",
              "Color Contrast",
              "Whitespace Management",
              "Information Grouping",
              "User Control and Freedom"
            ],
            answer: "Whitespace Management",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi berbagi resep makanan menggunakan berbagai jenis font untuk setiap bagian aplikasi, membuat tampilan terlihat tidak profesional dan sulit dibaca. Prinsip mana yang harus diterapkan?",
            options: [
              "Consistency and Standards",
              "User Control and Freedom",
              "Aesthetic and Minimalist Design",
              "Typography Readability",
              "Information Grouping"
            ],
            answer: "Consistency and Standards",
            type: "MC"
          },
          {
            question: "Dalam sebuah situs berita, paragraf utama dan sidebar diletakkan dalam ukuran yang sama, sehingga pengguna sulit membedakan informasi utama dan sekunder. Prinsip desain mana yang tidak diterapkan?",
            options: [
              "Information Grouping",
              "Visual Hierarchy",
              "Consistency and Standards",
              "Recognition Rather than Recall",
              "Aesthetic and Minimalist Design"
            ],
            answer: "Visual Hierarchy",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi User Centered Design', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment7 = await prisma.assessment.create({
      data: {
        chapterId: chapter7.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          {
            question: "Seorang pengguna aplikasi peta digital merasa bingung karena tombol navigasi sering berubah posisi setiap kali memperbesar tampilan peta. Hal ini melanggar prinsip Consistency and Standards.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi perbankan online memberikan pesan error yang hanya bertuliskan “Gagal!” tanpa menjelaskan alasan atau solusi. Ini melanggar prinsip Help Users Recognize, Diagnose, and Recover from Errors.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Dalam sebuah aplikasi, tombol “Simpan” dan “Hapus” memiliki warna yang sama dan terletak berdampingan, sehingga pengguna sering salah klik. Ini merupakan contoh pelanggaran prinsip Error Prevention.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Saat pengguna mengisi formulir online, sistem secara otomatis menyimpan progres mereka sehingga mereka tidak kehilangan data jika koneksi terputus. Ini sesuai dengan prinsip Flexibility and Efficiency of Use.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Sebuah situs web e-learning mengharuskan pengguna mengingat kode mata kuliah untuk mencari kursus. Ini melanggar prinsip Recognition Rather than Recall.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi transportasi online menggunakan ikon berbentuk bintang untuk menunjukkan lokasi pengguna saat ini. Pengguna merasa bingung karena biasanya ikon lokasi digambarkan dengan bentuk pin atau titik. Hal ini melanggar prinsip Familiarity dalam Iconography.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Dalam aplikasi e-commerce, semua elemen ditempatkan sangat berdekatan tanpa ruang kosong yang cukup. Hal ini membuat pengguna kesulitan membedakan bagian produk, harga, dan tombol beli. Ini menunjukkan penggunaan Whitespace yang buruk.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Seorang desainer menggunakan warna kuning terang untuk teks utama pada latar belakang putih dalam aplikasi e-learning. Hal ini meningkatkan keterbacaan dan memudahkan pengguna membaca konten.",
            options: ["True", "False"],
            answer: "False",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi media sosial menggunakan tombol \"Suka\" dengan ikon hati di beberapa bagian aplikasi, tetapi menggunakan ikon jempol di bagian lainnya untuk fungsi yang sama. Ini melanggar prinsip Consistency and Standards.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          {
            question: "Sebuah aplikasi berita menggunakan font serif untuk teks utama dan font sans-serif untuk judul. Ini merupakan praktik yang baik dalam tipografi.",
            options: ["True", "False"],
            answer: "True",
            type: "MC"
          },
          { 
            question: 'Jelaskan semua yang sudah anda pahami tentang materi Implementation of User-centered Design', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    const assessment8 = await prisma.assessment.create({
      data: {
        chapterId: chapter8.id,
        instruction: 'Pilihlah jawaban yang menurut anda paling benar. Silahkan screenshot hasil dari kuis setelah selesai',
        questions: JSON.stringify([
          { 
            question: 'Apa yang dimaksud dengan Interaksi Manusia-Komputer (IMK)?', 
            options: [
              'Proses komunikasi antara dua komputer', 
              'Proses interaksi antara manusia dan perangkat keras komputer', 
              'Proses interaksi antara manusia dan perangkat lunak komputer',
              'Proses komunikasi antara manusia dan komputer melalui antarmuka'
            ],
            answer: 'Proses komunikasi antara manusia dan komputer melalui antarmuka',
            type: 'MC'
          },
          { 
            question: 'Apa yang menjadi tujuan utama dalam desain User Interface (UI)?', 
            options: [
              'Membuat perangkat keras komputer lebih efisien', 
              'Mempermudah pengguna dalam berinteraksi dengan sistem', 
              'Proses interaksi antara manusia dan perangkat lunak komputer',
              'Proses komunikasi antara manusia dan komputer melalui antarmuka'
            ],
            answer: 'Mempermudah pengguna dalam berinteraksi dengan sistem',
            type: 'MC'
          },
          { 
            question: 'User Experience (UX) merujuk pada:', 
            options: [
              'Bagaimana pengguna merasakan pengalaman mereka selama menggunakan aplikasi',
              'Desain tampilan antarmuka pengguna',
              'Penggunaan teknologi dalam pengembangan aplikasi',
              'Pemrograman perangkat lunak untuk pengguna'
            ],
            answer: 'Bagaimana pengguna merasakan pengalaman mereka selama menggunakan aplikasi',
            type: 'MC'
          },
          { 
            question: 'Apa yang dimaksud dengan usability dalam konteks desain UI/UX?', 
            options: [
              'Pengukuran seberapa mudah dan efisien antarmuka digunakan',
              'Kualitas grafis yang ditampilkan pada antarmuka',
              'Jumlah fitur yang ada pada aplikasi',
              'Kecepatan loading aplikasi'
            ],
            answer: 'Pengukuran seberapa mudah dan efisien antarmuka digunakan',
            type: 'MC'
          },
          { 
            question: 'Wireframe adalah:', 
            options: [
              'Proses pengkodean aplikasi', 
              'Desain awal yang menunjukkan struktur dan elemen utama dari aplikasi', 
              'Proses pengujian aplikasi', 
              'Desain grafis yang menonjolkan warna dan font'
            ],
            answer: 'Desain awal yang menunjukkan struktur dan elemen utama dari aplikasi',
            type: 'MC'
          },
          { 
            question: 'Jelaskan Apa itu Penelitian', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
          { 
            question: 'Preferensi Pengguna seperti apa yang kalian maksud?', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
          { 
            question: 'Elearning seperti apa yang akan dibangun disini?', 
            options: [
              ''
            ],
            answer: '',
            type: 'EY'
          },
        ]),
      },
    });

    // ASSIGNMENT

    const assignment1 = await prisma.assignment.create({
      data: {
        chapterId: chapter1.id,
        instruction: 'Buat laporan hasil analisis paper dengan struktur: Identitas Paper, Ringkasan Paper, Analisis Kritis, Penerapan dalam Konteks Praktis. Submit hasil analisis anda. Penamaan file: NomorKelompok_TugasW01_IMK.pdf.',
        fileUrl: 'https://apipuro.del.ac.id/v1/file/2d4b8ae53529f2cdda35e7344ec1c8a1',
      },
    });

    const assignment2 = await prisma.assignment.create({
      data: {
        chapterId: chapter2.id,
        instruction: 'Buat laporan hasil analisis paper dengan struktur: Identitas Paper, Ringkasan Paper, Analisis Kritis, Penerapan dalam Konteks Praktis. Submit hasil analisis anda. Penamaan file: NomorKelompok_TugasW02_IMK.pdf.',
        fileUrl: 'https://apipuro.del.ac.id/v1/file/ffac580ad520c8fc978956081c288f84',
      },
    });

    const assignment3 = await prisma.assignment.create({
      data: {
        chapterId: chapter3.id,
        instruction: 'Buat laporan hasil analisis paper dengan struktur: Identitas Paper, Ringkasan Paper, Analisis Kritis, Penerapan dalam Konteks Praktis. Submit hasil analisis anda. Penamaan file: NomorKelompok_TugasW03_IMK.pdf.',
        fileUrl: 'https://apipuro.del.ac.id/v1/file/ffac580ad520c8fc978956081c288f84',
      },
    });

    const assignment4 = await prisma.assignment.create({
      data: {
        chapterId: chapter4.id,
        instruction: 'Buat laporan hasil analisis paper dengan struktur: Identitas Paper, Ringkasan Paper, Analisis Kritis, Penerapan dalam Konteks Praktis. Submit hasil analisis anda. Penamaan file: NomorKelompok_TugasW04_IMK.pdf.',
        fileUrl: 'https://media.nngroup.com/media/articles/attachments/Heuristic_Summary1-compressed.pdf',
      },
    });

    const assignment5 = await prisma.assignment.create({
      data: {
        chapterId: chapter5.id,
        instruction: 'Anda diminta untuk mengevaluasi antarmuka dari aplikasi pilihan mereka dan mengidentifikasi kelemahan serta rekomendasi perbaikannya.',
        fileUrl: 'https://apipuro.del.ac.id/v1/file/0fa579a231624800ad8ab9db25f23481',
      },
    });

    const assignment6 = await prisma.assignment.create({
      data: {
        chapterId: chapter6.id,
        instruction: 'Buatlah catatan rangkuman review materi dari Week 1 sampai Week 6 untuk persiapan UTS!',
        fileUrl: '',
      },
    });

    const assignment7 = await prisma.assignment.create({
      data: {
        chapterId: chapter7.id,
        instruction: 'Silahkan mengikuti instruksi tugas berikut ini:!',
        fileUrl: 'https://apipuro.del.ac.id/v1/file/e533ca8406a061f72193a626569f505e',
      },
    });

    const assignment8 = await prisma.assignment.create({
      data: {
        chapterId: chapter8.id,
        instruction: 'Buatlah pengerjaan ulang soal UTS beserta jawaban yang benar lengkap dengan penjelasan',
        fileUrl: '',
      },
    });

    // Create UserCourse relationship
    await prisma.userCourse.create({
      data: {
        userId: student.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });
    
    await prisma.userCourse.create({
      data: {
        userId: emely.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });
    await prisma.userCourse.create({
      data: {
        userId: gerry.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: gerald.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user1.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user2.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user3.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user4.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user5.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user6.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user7.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user8.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user9.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    await prisma.userCourse.create({
      data: {
        userId: user10.id,
        courseId: course1.id,
        progress: 0,
        currentChapter: 1,
        isCompleted: false,
      },
    });

    // Create UserChapter relationship
    await prisma.userChapter.create({
      data: {
        userId: student.id,
        chapterId: chapter1.id,
        isCompleted: false,
        materialDone: false,
        assessmentDone: false,
        assignmentDone: false,
        assessmentAnswer: JSON.stringify([]),
        assessmentGrade: 0,
        submission: '',
      },
    });

    const badge1 = await prisma.badge.create({
      data: {
        name: 'Beginner Designer',
        type: BadgeType.BEGINNER,
        image: `${assetsUrl}/storage/v1/object/public/badges/imk-1.png`,
        courseId: course1.id,
        chapterId: chapter3.id,
      },
    });

    const badge2 = await prisma.badge.create({
      data: {
        name: 'Intermediate Designer',
        type: BadgeType.INTERMEDIATE,
        image: `${assetsUrl}/storage/v1/object/public/badges/imk-2.png`,
        courseId: course1.id,
        chapterId: chapter6.id,
      },
    });

    const badge3 = await prisma.badge.create({
      data: {
        name: 'Advance Designer',
        type: BadgeType.ADVANCE,
        image: `${assetsUrl}/storage/v1/object/public/badges/imk-3.png`,
        courseId: course1.id,
        chapterId: chapter8.id,
      },
    });

    const badge4 = await prisma.badge.create({
      data: {
        name: 'Beginner Login',
        type: BadgeType.BEGINNER,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/login-1.png',
        courseId: course2.id,
        chapterId: chapter1.id,
      },
    });

    const badge5 = await prisma.badge.create({
      data: {
        name: 'Intermediate Login',
        type: BadgeType.INTERMEDIATE,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/login-2.png',
        courseId: course2.id,
        chapterId: chapter2.id,
      },
    });

    const badge6 = await prisma.badge.create({
      data: {
        name: 'Advance Login',
        type: BadgeType.ADVANCE,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/login-3.png',
        courseId: course2.id,
        chapterId: chapter3.id,
      },
    });

    const badge7 = await prisma.badge.create({
      data: {
        name: 'Beginner TBFA',
        type: BadgeType.BEGINNER,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/tbfa-1.png',
        courseId: course3.id,
        chapterId: chapter1.id,
      },
    });

    const badge8 = await prisma.badge.create({
      data: {
        name: 'Intermediate TBFA',
        type: BadgeType.INTERMEDIATE,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/tbfa-2.png',
        courseId: course3.id,
        chapterId: chapter2.id,
      },
    });

    const badge9 = await prisma.badge.create({
      data: {
        name: 'Advance TBFA',
        type: BadgeType.ADVANCE,
        image: 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/tbfa-3.png',
        courseId: course3.id,
        chapterId: chapter3.id,
      },
    });

    // Create UserBadge relationship
    await prisma.userBadge.create({
      data: {
        userId: student.id,
        badgeId: badge1.id,
      },
    });

    // TRADES

    const trade1 = await prisma.trade.create({
      data: {
        image: 'lib/assets/pictures/icon.png',
        title: 'Voucher Belanja Cafetaria Del',
        description: 'Voucher Belanja senilai Rp.10.000,- untuk transaksi di Cafetaria Del. Berlaku sampai 1 semester kedepan.',
        requiredBadgeType: 'ADVANCE',
      }
    });

    const trade2 = await prisma.trade.create({
      data: {
        image: 'lib/assets/pictures/icon.png',
        title: 'Sticky Notes UTS',
        description: 'Sticky Notes berupa cemilan makanan dan minuman dengan ucapan semangat menjalani UTS',
        requiredBadgeType: 'BEGINNER',
      }
    });

    const trade3 = await prisma.trade.create({
      data: {
        image: 'lib/assets/pictures/icon.png',
        title: 'Nilai Tambah UTS +5',
        description: 'Penambahan Nilai UTS sebanyak 5. Maksimal nilai yang bisa diperoleh dengan penambahan adalah 80',
        requiredBadgeType: 'INTERMEDIATE',
      }
    });

    const trade4 = await prisma.trade.create({
      data: {
        image: 'lib/assets/pictures/icon.png',
        title: 'Peserta Evaluasi Levelearn Gamification',
        description: 'Kesempatan berpartisipasi dalam Research TA-2024/2025-13 terkait Evaluasi Gamification Aplikasi Levelearn',
        requiredBadgeType: 'BEGINNER',
      }
    });

    await prisma.userTrade.create({
      data: {
        userId: student.id,
        tradeId: trade3.id,
      },
    });

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
