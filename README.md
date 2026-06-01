# Kanji Drill Hub

Kanji Drill Hub adalah aplikasi belajar bahasa Jepang offline-first untuk pembelajar Indonesia. Aplikasi ini berisi bank kanji, deck kotoba Minna no Nihongo Bab 26-29, kuis cepat, review jawaban salah, dan mode ujian tanpa backend.

## Fitur

- Dashboard ringkas dengan total kanji, kotoba, deck, akurasi, dan jumlah kata sulit.
- Kanji Bank dengan pencarian, filter rentang, dan status `baru`, `belajar`, `dikuasai`.
- Deck Kotoba untuk Bab 26, 27, 28, 29, dan Bab 29 Reference.
- Import manual kotoba dengan format `kata Jepang | bacaan | arti Indonesia | jenis kata`.
- Kuis Cepat dengan umpan balik langsung.
- Review Salah untuk melatih dan mereset kata sulit.
- Exam Mode tanpa umpan balik sampai hasil akhir.
- Progres tersimpan otomatis di `localStorage`.

## Cara Menjalankan

```bash
npm install
npm run dev
```

Buka alamat lokal yang ditampilkan oleh Vite, biasanya `http://localhost:5173`.

## Build Produksi

```bash
npm run build
```

Hasil build berada di folder `dist`.
