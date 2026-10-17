# REDA – Prototipe Alat Kader

Prototipe alur kerja kader gampong untuk esai PSYCHOVIBES 3.0.
Satu halaman web statis (HTML, CSS, JavaScript). Tanpa server, tanpa akun, tanpa pelacakan.

## Cara mencoba
Buka `index.html` di peramban (ponsel atau komputer). Data contoh sudah terisi.
Alur uji: menu 1 (catat pemicu) -> menu 2 (konfirmasi pagi + skor 0-10) -> menu 3 (pantauan, kunjungan, rujukan).

## Cara mendapat tautan (pilih satu)
- Netlify Drop: buka app.netlify.com/drop, seret folder ini. Tautan jadi dalam hitungan detik.
- GitHub Pages: unggah isi folder ke repositori, aktifkan Pages.
- Vercel: `vercel --prod` dari dalam folder ini.
Pakai akun dengan nama netral bila juri tidak boleh melihat identitas penulis.

## Yang dilakukan dan tidak dilakukan
- Status TENANG/BERSIAP/PERGI disalin kader dari BMKG, BPBD, atau PVMBG. Aplikasi tidak menghitung status bahaya.
- Pesan TENANG tidak diberikan ke keluarga yang skornya sudah turun.
- Skor 0-10 hanya untuk membaca tren. Bukan diagnosis. Rujukan tetap lewat skrining SRQ-20 di puskesmas.
- Ambang awal (3 pemicu, 48 jam, skor akhir minimal 5) adalah asumsi rancangan, dapat diubah di menu Atur.
- Data hanya di peramban (localStorage), memakai kode keluarga, dan menambah keluarga mewajibkan centang persetujuan.

## Batasan
Belum diuji pada pengguna. Hasil uji kegunaan (SUS) dan uji keterpahaman pesan harus diisi dari uji nyata.
Data di versi awal adalah data contoh rekaan untuk demonstrasi.
