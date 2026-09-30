# Rencana Guild dan Pembagian Raid dengan Supabase

Status: implementasi lokal tersedia. Setup database Supabase dan login username/password mengikuti `docs/supabase-setup.md`.
Tanggal: 30 September 2026.

## 1. Tujuan dan keputusan yang disepakati

Menambahkan fitur pengelolaan guild dan pembagian hasil raid ke RF NEXT Helper, dengan akun serta data yang tersimpan di Supabase.

- Next.js yang sekarang tetap menjadi aplikasi utama.
- Login pengurus memakai username/password dan sesi aplikasi. PostgreSQL Supabase menyimpan data; Supabase Auth dan SMTP tidak digunakan.
- Member membuka `/member` tanpa akun, mengisi nama karakter + server + guild untuk melihat bagian raid final miliknya.
- Pembagian hasil hanya berdasarkan bobot tier CP peserta raid.
- Tidak ada nilai kontribusi, poin tugas, atau komponen pembagian rata tambahan.
- Pengurus memilih anggota yang mengikuti raid. Semua peserta terpilih mendapat bobot penuh; kehadiran parsial di luar cakupan awal.
- T1 adalah tier CP tertinggi dan T5 terendah.
- T0 adalah label pengurus, bukan tier CP atau bonus pembagian.
- Pengurus yang ikut raid memperoleh bagian berdasarkan tier CP yang sama seperti anggota lain.
- Diamond dan rupiah dicatat serta dibagikan sebagai saldo terpisah.
- Aplikasi menghitung dan mencatat pembayaran. Transfer dilakukan di luar aplikasi.
- Kalkulator diamond dan material conversion tetap dapat diakses tanpa login.

Dokumen ini memperbarui batasan awal dalam `docs/readme.md` yang sebelumnya tidak membutuhkan akun, database, dan backend. Perubahan cakupan tersebut berlaku untuk fitur guild dan raid.

## 2. Cakupan versi pertama

1. Daftar, login, dan logout pengurus dengan username/password. Tidak ada verifikasi email atau lupa/reset password.
2. Membuat guild dengan nama dan server.
3. Mengundang pengurus berdasarkan username untuk mengakses guild.
4. Mengelola daftar karakter: nama, CP, dan tier otomatis.
5. Mengatur batas CP serta bobot T1–T5.
6. Membuat raid, memilih peserta, dan mengunci data peserta.
7. Mencatat hasil, potongan, serta hasil bersih.
8. Menampilkan simulasi, memfinalisasi pembagian, dan mencatat pembayaran.
9. Melihat riwayat dan mengekspor rincian pembagian sebagai CSV.

Di luar cakupan: pengambilan CP otomatis dari game, transfer otomatis, penilaian kontribusi, honor khusus T0, kehadiran parsial, konversi kurs otomatis, dan integrasi Discord.

## 3. Akun, guild, dan hak akses

### Alur pengguna

Pengurus: daftar/login username dan password → buat guild atau terima undangan pengurus → dashboard guild.

Member: `/member` → nama karakter, server, guild → roster dan tabel pembagian seluruh guild tanpa akun, dengan highlight nama yang dicari.

Akun hanya diperlukan pemilik dan pengurus. Karakter adalah peserta raid; member tidak perlu mendaftar.

Satu akun dapat memiliki akses ke beberapa guild. Dashboard selalu menampilkan nama guild dan server yang sedang aktif. Akses guild hanya diberikan melalui pembuatan guild atau penerimaan undangan yang valid.

| Peran akses | Hak |
| --- | --- |
| Owner | Mengelola identitas guild, undangan, peran, aturan, anggota, raid, dan pembayaran |
| Pengurus | Mengelola karakter, peserta, hasil raid, finalisasi, dan pembayaran |
| Member tanpa akun | Melihat roster dan pembagian seluruh guild pada raid final menggunakan tiga nama; tidak mempunyai akses dashboard |

Keputusan awal: hanya owner yang dapat mengubah aturan pembagian dan peran akses. Owner tidak dapat dihapus atau keluar sebelum kepemilikan dipindahkan secara aman.

Label T0 pada karakter hanya bersifat informatif. Label tersebut tidak memberi akses pengurus ke akun dan tidak memengaruhi nominal pembagian.

Undangan hanya untuk pengurus, terikat pada username, berlaku 7 hari, dapat dicabut, dan sekali pakai. Member tidak menggunakan undangan. Pencarian nama pada halaman member tidak memberikan hak akses akun.

## 4. Aturan tier CP

Batas CP ditentukan masing-masing guild. Jangan mengarang batas CP resmi game.

Preset bobot awal yang dapat diubah owner:

| Tier | Bobot tampilan | Bobot bilangan bulat |
| --- | ---: | ---: |
| T1 | 1,5 | 150 |
| T2 | 1,3 | 130 |
| T3 | 1,2 | 120 |
| T4 | 1,1 | 110 |
| T5 | 1,0 | 100 |

- Simpan bobot sebagai bilangan bulat; semua bobot harus positif.
- Setiap tier memiliki CP minimum. Minimum T5 adalah 0, lalu minimum harus naik secara ketat sampai T1.
- Tier dihitung dari batas minimum tertinggi yang dipenuhi CP karakter.
- Bobot T1 ≥ T2 ≥ T3 ≥ T4 ≥ T5. Bobot boleh sama bila guild menginginkannya.
- CP harus bilangan bulat nonnegatif. CP yang belum diisi dibedakan dari CP bernilai 0.
- Karakter tanpa CP tidak dapat dikunci sebagai peserta.
- Versi pertama tidak menyediakan override tier manual; pengurus mengoreksi CP atau owner mengubah aturan.
- CP mentah tidak dikalikan lagi setelah tier ditentukan.
- Anggota dalam tier yang sama mendapat hak yang sama, dengan kemungkinan selisih satu unit karena pembulatan.

Owner wajib menyelesaikan pengaturan batas CP sebelum raid pertama dapat dikunci.

## 5. Perhitungan hasil

### Hasil bersih

Untuk setiap mata uang:

`hasil bersih = pemasukan − potongan`

Pemasukan dan potongan memiliki label, nominal, dan mata uang. Potongan dapat berupa biaya transaksi atau kas guild. Nilainya harus jelas dalam rincian; tidak ada potongan otomatis tersembunyi.

Pajak market hanya diterapkan bila sesuai transaksi yang dicatat. Hindari memotong pajak kembali dari nominal yang sudah bersih. Kalkulator pajak yang ada dapat membantu pengguna menentukan nominal, tetapi tidak otomatis mengenakan pajak pada semua pemasukan raid.

Jika diamond dijual menjadi rupiah, catat diamond yang keluar dan rupiah hasil penjualan yang masuk sebagai transaksi terkait. Diamond tersebut tidak lagi menjadi saldo untuk dibagikan. Tidak ada kurs bawaan.

### Bagian peserta

`bagian ideal = hasil bersih × bobot tier peserta ÷ total bobot peserta`

Hitung diamond dan rupiah secara terpisah dengan peserta serta bobot yang sama.

Contoh 12.000 diamond bersih:

| Peserta | Tier | Bobot | Bagian |
| --- | --- | ---: | ---: |
| A | T1 | 150 | 4.500 |
| B | T1 | 150 | 4.500 |
| C | T5 | 100 | 3.000 |
| Total | | 400 | 12.000 |

### Pembulatan dan validasi

- Diamond dan rupiah menggunakan unit utuh, tanpa floating point untuk nominal final.
- Bulatkan semua bagian ke bawah, lalu bagikan sisa satu per satu kepada peserta dengan sisa pecahan terbesar.
- Jika sisa pecahan sama, gunakan urutan undian peserta yang dibuat server sekali saat peserta dikunci, lalu disimpan. Urutan ini tetap untuk penghitungan ulang raid yang sama.
- Tampilkan penyesuaian pembulatan dalam rincian hasil.
- Total bagian harus sama persis dengan hasil bersih masing-masing mata uang.
- Tolak nominal negatif, saldo bersih negatif, peserta duplikat, CP tidak valid, bobot nol, dan finalisasi tanpa peserta.
- Saldo nol menghasilkan bagian nol; total bobot tetap harus valid.
- Tetapkan batas input CP dan nominal yang eksplisit saat implementasi. Serialisasi nilai database yang besar secara aman; jangan bergantung pada presisi `number` JavaScript di luar batas integer aman.

## 6. Siklus raid dan konsistensi riwayat

### Draft

Pengurus mengisi nama raid, tanggal, peserta, dan transaksi. Simulasi belum menjadi hak pembayaran final.

### Peserta dikunci

Simpan salinan aturan beserta nama, CP, tier, bobot, dan urutan pembulatan peserta. Perubahan roster atau aturan guild setelah ini tidak mengubah raid tersebut.

Pengurus dapat membuka kembali peserta sebelum finalisasi, dengan alasan tercatat. Penguncian ulang membuat snapshot baru dan menghitung ulang simulasi. Pemasukan serta potongan tetap dapat dilengkapi sebelum finalisasi.

### Final

Server memverifikasi akses, status, peserta, saldo, dan rumus, kemudian menyimpan seluruh hasil dalam satu transaksi database. Nominal dari browser tidak dipercaya sebagai hasil final.

Finalisasi harus aman terhadap klik ganda dan permintaan bersamaan. Kunci baris raid selama proses, gunakan versi data untuk mendeteksi draft usang, dan cegah hasil ganda dengan constraint unik.

### Pembayaran

Catat status dibayar, waktu, pencatat, dan catatan/referensi pembayaran untuk tiap peserta dan mata uang. Versi pertama mendukung pembayaran penuh per mata uang; cicilan di luar cakupan.

Status dibayar bukan bukti transfer otomatis. Pembatalan tanda dibayar wajib memakai alasan dan masuk riwayat perubahan.

### Koreksi

Hasil final tidak diedit langsung. Koreksi membuat revisi tertaut dengan alasan; versi sebelumnya tetap tersimpan.

Revisi pengganti hanya dapat difinalisasi bila belum ada pembayaran tercatat. Setelah ada pembayaran, blokir revisi nominal pada versi pertama; mekanisme penyesuaian selisih menjadi pekerjaan lanjutan. Jangan menghapus atau mereset pembayaran untuk menyamarkan koreksi nominal.

## 7. Rancangan data Supabase

Nama tabel berikut merupakan rancangan awal migration.

| Tabel | Data utama |
| --- | --- |
| `private.staff_accounts` | Username dan password hash scrypt |
| `private.staff_sessions` | Hash token sesi, akun, kedaluwarsa |
| `private.auth_attempts` | Pembatasan percobaan login/daftar |
| `profiles` | ID akun aplikasi, nama tampilan |
| `guilds` | Nama, server, owner, waktu pembuatan |
| `guild_memberships` | Guild, akun, peran; unik untuk pasangan guild dan akun |
| `guild_invites` | Guild, username tujuan, peran, hash token, kedaluwarsa, status penerimaan |
| `guild_characters` | Guild, nama karakter, CP, label pengurus, akun terkait opsional, status aktif |
| `guild_rule_versions` | Guild, versi aturan, pembuat, waktu berlaku |
| `guild_tier_rules` | Versi aturan, tier, minimum CP, bobot integer |
| `raids` | Guild, nama, tanggal, status, versi perubahan, versi aturan, kaitan revisi |
| `raid_participants` | Raid, karakter, snapshot nama/CP/tier/bobot, urutan pembulatan |
| `raid_transactions` | Raid, mata uang, jenis pemasukan/potongan, nominal, label, kaitan konversi opsional |
| `raid_allocations` | Raid, peserta, mata uang, bagian final dan penyesuaian pembulatan |
| `raid_payments` | Alokasi, status pembayaran penuh, waktu, pencatat, referensi |
| `audit_logs` | Guild, pelaku, tindakan, entitas, alasan, perubahan, waktu |

Ketentuan database:

- Gunakan foreign key dan constraint untuk memastikan karakter, raid, peserta, dan aturan selalu berasal dari guild yang sama.
- Satu karakter hanya dapat muncul sekali dalam satu raid.
- Satu hasil alokasi per peserta dan mata uang pada setiap revisi raid.
- Arsipkan karakter yang memiliki riwayat; jangan menghapus relasi historisnya.
- Simpan nominal sebagai integer database dengan batas validasi yang konsisten di server dan UI.
- Simpan waktu dalam UTC; tampilkan menurut zona waktu pengguna.
- Perubahan roster tidak boleh mengubah snapshot raid lama.
- Catatan audit ditulis melalui operasi server/database tepercaya dan tidak dapat diedit pengguna biasa.

## 8. Keamanan dan integrasi

- Gunakan autentikasi aplikasi dengan cookie HttpOnly, token acak dan hash token di database.
- Pengurus cukup username/password. Tidak ada email, SMTP, callback Auth, login sosial, atau lupa/reset password.
- Aktifkan RLS pada seluruh tabel aplikasi yang terekspos.
- Setiap operasi memverifikasi keanggotaan guild dan peran pengguna. ID guild dari URL atau browser bukan bukti akses.
- Member mengakses RPC pencarian publik terbatas. Nama bukan bukti identitas; roster guild dan pembagian semua peserta raid final ditampilkan, dengan penanda karakter yang dicari. Draft, akun, audit, dan pengaturan tetap privat.
- Cegah pengguna menaikkan perannya sendiri, menambah keanggotaan tanpa undangan, atau mengubah hasil final secara langsung.
- Pembuatan guild beserta membership owner dilakukan secara atomik.
- Operasi finalisasi, penerimaan undangan, dan pergantian owner menggunakan transaksi database yang memvalidasi identitas serta peran.
- Jika menggunakan fungsi `SECURITY DEFINER`, batasi izin eksekusi, tetapkan `search_path`, dan periksa akses di dalam fungsi.
- Kunci service-role hanya berada di server. Gateway database memeriksa sesi aplikasi dan peran guild; browser tidak mendapat akses tulis atau baca tabel privat.
- Browser memanggil API Next.js. Akun Supabase Auth lama tidak memberikan akses; hanya sesi aplikasi yang valid dapat memakai gateway pengurus.
- Tambahkan `.env.example` berisi nama variabel tanpa rahasia. Jangan commit credential.
- Periksa Origin pada operasi tulis, hash password dengan scrypt dan salt acak, serta batasi percobaan login/daftar.

Sebelum menulis kode Next.js, baca panduan yang relevan dalam `node_modules/next/dist/docs/` sesuai `AGENTS.md`. Cocokkan integrasi Supabase dengan dokumentasi resmi saat implementasi.

## 9. Halaman aplikasi

| Rute usulan | Fungsi |
| --- | --- |
| `/login`, `/register` | Masuk dan mendaftar |
| `/member` | Pencarian bagian karakter tanpa login |
| `/guilds` | Memilih atau membuat guild |
| `/invites/[token]` | Menerima undangan setelah login |
| `/guilds/[guildId]` | Ringkasan guild dan raid terbaru |
| `/guilds/[guildId]/members` | Karakter dan pengelolaan akses akun |
| `/guilds/[guildId]/settings` | Identitas guild dan aturan tier |
| `/guilds/[guildId]/raids/new` | Membuat raid |
| `/guilds/[guildId]/raids/[raidId]` | Peserta, transaksi, simulasi, hasil, pembayaran |

UI mengikuti tema dan sistem bahasa Indonesia/Inggris yang sudah ada. Semua form harus nyaman dipakai di ponsel. Tampilkan nama guild, status raid, saldo bersih, dan penjelasan rumus dengan jelas.

## 10. Tahapan implementasi

### Tahap 1 — Fondasi Supabase dan login

- Siapkan project Supabase, environment, migration, client browser/server, dan integrasi sesi.
- Buat halaman autentikasi serta penanganan sesi kedaluwarsa.
- Pertahankan akses publik untuk tool yang sudah ada.

### Tahap 2 — Guild, akses, dan karakter

- Implementasikan pembuatan guild, undangan, peran, dan pergantian guild.
- Buat CRUD karakter serta penghubungan akun opsional.
- Terapkan constraint dan RLS sejak tabel pertama.

### Tahap 3 — Aturan dan mesin pembagian

- Buat pengaturan batas CP dan bobot tier.
- Implementasikan penentuan tier dan perhitungan integer sebagai logika terpisah dari UI.
- Implementasikan pembulatan deterministik dengan total yang tetap cocok.

### Tahap 4 — Raid dan finalisasi

- Implementasikan draft, penguncian peserta, snapshot aturan, dan transaksi hasil.
- Buat simulasi serta finalisasi atomik dengan pemeriksaan versi data.
- Simpan hasil final dan audit perubahan.

### Tahap 5 — Pembayaran, riwayat, dan penyelesaian

- Tambahkan status pembayaran, revisi sebelum pembayaran, arsip karakter, dan ekspor CSV.
- Lengkapi terjemahan, tampilan mobile, kondisi kosong, validasi, serta pesan kesalahan.
- Jalankan pengujian, lint, dan build sesuai perubahan.

## 11. Pengujian dan kriteria selesai

### Logika pembagian

- CP tepat pada batas tier dan di antara batas menghasilkan tier yang benar.
- Contoh 12.000 diamond menghasilkan 4.500 / 4.500 / 3.000.
- Pembagian saldo kecil, satu peserta, saldo nol, dan pecahan memiliki total yang tepat.
- Urutan pembulatan tetap untuk penghitungan ulang snapshot yang sama.
- Diamond dan rupiah tidak tercampur; konversi tidak menghitung aset dua kali.
- Input tidak valid dan nilai melebihi batas ditolak.

### Akses dan integritas

- Akun guild A tidak dapat membaca atau menulis data guild B melalui UI maupun API/database.
- Member tidak dapat mengubah CP, aturan, peserta, alokasi, atau pembayaran.
- Pengurus tidak dapat mengubah peran atau aturan yang dibatasi untuk owner.
- Undangan kedaluwarsa, dicabut, dipakai ulang, atau diterima username lain ditolak.
- Relasi lintas guild ditolak database.
- Finalisasi bersamaan tidak membuat hasil ganda dan input usang ditolak.
- Perubahan CP dan aturan tidak mengubah raid yang sudah dikunci/final.
- Revisi menyimpan versi lama; revisi nominal setelah pembayaran ditolak.

### Alur lengkap

- Owner dapat mendaftar, membuat guild, memasukkan karakter, mengatur tier, membuat raid, memfinalisasi, dan menandai pembayaran.
- Member tanpa akun dapat melihat roster dan pembagian seluruh guild dengan highlight karakter yang dicari. Pengurus yang diundang dengan username dapat mengelola guild.
- Data tetap tersedia setelah refresh, login ulang, dan pindah perangkat.
- Semua hasil menampilkan rincian bobot, potongan, pembulatan, dan nominal akhir.
- Kalkulator lama tetap berfungsi tanpa login.

## 12. Kebutuhan saat mulai implementasi

- Project Supabase beserta URL dan service-role key server untuk lingkungan pengembangan.
- Key server Supabase dan cookie sesi aplikasi; tidak ada setup email atau Supabase Auth.
- Batas CP aktual ditentukan owner melalui UI; tidak perlu ditanam dalam kode.
- Migration disimpan di repository agar struktur database dapat dibuat ulang.
- Kode aplikasi, migration, template env, dan pengujian lokal tersedia. Project Supabase eksternal belum dibuat atau diubah.

## Referensi

- [Supabase dengan Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Node.js crypto](https://nodejs.org/download/release/v26.7.0/docs/api/crypto.html)
- [User management dengan Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)

## Pembaruan implementasi

Migration 002 menambahkan pencarian member tanpa akun. Migration 003 mengganti login Supabase Auth menjadi username/password aplikasi dan mempertahankan data lama. Jalankan migration berurutan sesuai `docs/supabase-setup.md`.
