# Setup database dan login pengurus

Supabase dipakai sebagai **database saja**. Login pengurus memakai username/password milik aplikasi. Tidak perlu mengaktifkan Supabase Auth, email, SMTP, callback, atau fitur lupa password.

## 1. Environment lokal

Isi `.env.local` di root repository. Template tersedia di `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Ambil URL dan key server dari Supabase project Settings/API. Key `service_role` atau secret key server digunakan **hanya oleh server Next.js**. Jangan beri awalan `NEXT_PUBLIC_` pada key tersebut. Publishable/anon key tidak diperlukan oleh aplikasi ini.

`NEXT_PUBLIC_SUPABASE_URL` harus berisi Project URL API dengan protokol `https://`, bukan connection string `postgresql://`. Aplikasi mengakses database melalui API Supabase. Mengisi connection string PostgreSQL di variabel ini membuat client gagal dibuat meskipun key sudah terisi.

`.env.local` diabaikan Git. Atur kedua variabel juga pada hosting produksi, lalu rebuild. Restart server dev setelah mengubah env.

## 2. Migration database

Pada project baru, jalankan file berikut **berurutan**, masing-masing sekali, melalui Supabase SQL Editor atau CLI migration:

1. `supabase/migrations/202609300001_guild_raids.sql`
2. `supabase/migrations/202609300002_public_member_lookup.sql`
3. `supabase/migrations/202609300003_username_auth.sql`
4. `supabase/migrations/202609300004_guild_reward_transparency.sql`
5. `supabase/migrations/202610010005_member_directory.sql`
6. `supabase/migrations/202610010006_raid_member_visibility.sql`

Jika migration sebelumnya sudah dijalankan, cukup jalankan yang belum diterapkan. Migration pertama/dua merupakan fondasi historis. Migration ketiga memindahkan akun, sesi, serta akses database ke autentikasi aplikasi tanpa Supabase Auth.

Jangan menjalankan `supabase/tests/bootstrap-local.sql` pada Supabase hosted. File tersebut khusus PostgreSQL kosong untuk pengujian.

### Database yang sudah mempunyai akun dari implementasi lama

Migration mempertahankan ID dan relasi data lama. Akun Supabase lama mendapat username `legacy_...` dengan password nonaktif; akun baru tidak otomatis mengambil alih guild lama. Undangan email lama yang belum diterima dicabut.

Bila sudah ada guild sungguhan dari versi login email, administrator database perlu memindahkan kepemilikan ke akun username yang benar atau mengisi username/password hash baru untuk identitas lama setelah memverifikasi pemiliknya. Jangan mengisi password polos. Ini migrasi administratif satu kali, bukan fitur lupa password.

## 3. Jalankan aplikasi

```sh
npm install
npm run dev
```

### Member — tanpa login

1. Buka `/member` atau kartu Pembagian Raid di beranda.
2. Isi nama karakter, lalu cari dan pilih server serta guild dari daftar yang terdaftar. Pilihan guild mengikuti server; mengganti server mengosongkan pilihan guild.
3. Lihat tabel bagian diamond/rupiah dan status dibayar.

Pencarian mengabaikan huruf besar/kecil serta spasi di awal/akhir. Ketiga nama harus cocok. Hasil menampilkan seluruh roster guild (termasuk anggota arsip) serta pembagian semua peserta raid final. Nama yang dicari diberi highlight dan label, termasuk jika nama snapshot raid berbeda dari nama terbaru. CP roster adalah CP terbaru; CP/tier/bobot pembagian mengikuti snapshot saat raid dikunci. Draft, versi yang sudah digantikan, akun, audit, serta referensi transfer tetap privat.

Nama merupakan kunci pencarian publik, bukan bukti identitas. Orang yang mengetahui ketiga nama dapat melihat roster dan pembagian seluruh guild. Jika lebih dari satu guild/karakter cocok pada server sama, aplikasi meminta pengurus membedakan nama guild dan tidak memilih hasil secara acak. Riwayat dibagi 10 raid utuh per halaman, termasuk raid yang tidak diikuti karakter pencarian.

### Pengurus — username dan password

1. Buka `/register`.
2. Isi username 3–32 karakter (huruf, angka, underscore) dan password 8–128 karakter.
3. Setelah daftar langsung masuk ke `/guilds`.
4. Buat guild atau terima undangan pengurus yang ditujukan ke username tersebut.
5. Owner mengatur batas CP T1–T5. Bobot awal: 150, 130, 120, 110, 100.
6. Tambahkan karakter, buat raid, pilih/simpan peserta, lalu kunci CP dan tier.
7. Masukkan hasil serta potongan, periksa simulasi, lalu finalisasi.
8. Setelah transfer manual, catat pembayaran per peserta dan mata uang.

Username tidak peka huruf besar/kecil. Password tetap peka huruf besar/kecil dan spasi. Tidak ada email verifikasi atau halaman lupa/reset password.

### Undangan dan akses pengurus

Owner memasukkan username pengurus lalu membuat tautan undangan. Salin dan kirim secara manual. Tautan berlaku 7 hari, sekali pakai, hanya bisa diterima oleh username yang dituju. Undangan bisa dibuat sebelum akun tujuan mendaftar; daftar dari halaman undangan mempertahankan tujuan tersebut.

Member tidak diundang dan tidak perlu akun. Owner dapat mencabut akses pengurus atau memindahkan kepemilikan ke pengurus yang sudah ada. Label karakter T0 tidak memberi izin akun atau bonus pembagian.

## 4. Penyimpanan dan batas akses

- Password menggunakan scrypt dengan salt acak; password polos tidak disimpan.
- Sesi menggunakan token acak 32 byte dalam cookie HttpOnly, SameSite=Lax, Secure pada produksi, berlaku 7 hari. Database menyimpan hash token saja.
- Logout mencabut sesi database. Sesi kedaluwarsa ditolak pada pembacaan dan penulisan, bukan hanya di tampilan.
- Percobaan login/daftar dibatasi di database selama 15 menit per username dan bucket jaringan. Pada Vercel, alamat jaringan diambil dari header yang ditetapkan Vercel. Deployment lain memakai bucket bersama konservatif; sesuaikan integrasi reverse proxy tepercaya bila skalanya meningkat.
- Semua operasi pengurus melewati server Next.js. Origin permintaan penulisan diperiksa untuk mencegah CSRF.
- RPC pengurus hanya dapat dipanggil dengan key server. Gateway memverifikasi sesi serta akses guild sebelum membaca atau mengubah data.
- Akun/role Supabase Auth lama tidak dapat membaca tabel privat atau memanggil operasi pengurus.
- Endpoint member hanya mengembalikan hasil pencarian terbatas; tidak memberikan sesi atau hak akses pengurus.

## 5. Aturan pembagian

- Pembagian murni bobot tier CP, tanpa poin kontribusi dan tanpa bonus T0.
- Batas CP ditentukan owner; T1 tertinggi, T5 mulai dari 0.
- Maksimum 500 peserta per raid. CP, nilai transaksi, dan saldo bersih per mata uang maksimum 1.000.000.000.000.
- Diamond dan rupiah dihitung terpisah. Konversi diamond membuat dua transaksi terkait agar hasil tidak dihitung dua kali.
- Database menghitung finalisasi secara atomik; sisa pembulatan diberikan berdasarkan pecahan terbesar dan urutan undian yang disimpan.
- CP, tier, nama, dan aturan saat penguncian tetap tersimpan. Perubahan roster tidak mengubah hasil lama.
- Nomor versi mencegah pengurus menimpa data usang. Finalisasi bersamaan tidak membuat hasil ganda.
- Revisi sebelum pembayaran membuat versi baru; versi lama tetap tersimpan. Revisi tertunda memblokir pembayaran sampai selesai/dibatalkan.
- Riwayat pembayaran memblokir revisi nominal meskipun status dibayar kemudian dikoreksi. Pembatalan tanda dibayar membutuhkan alasan dan tercatat di audit.
- Transfer tetap dilakukan manual. Versi awal hanya mencatat pembayaran penuh, tanpa cicilan.

## 6. Pengujian

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

Webpack digunakan karena Turbopack gagal membuat proses/port pada lingkungan sandbox pengujian. Build menggunakan Google Fonts yang sudah ada di project.

Pada **PostgreSQL kosong yang boleh dibuang**, gunakan urutan berikut. Pengujian versi lama dilakukan sebelum migration login baru agar kompatibilitas upgrade juga diperiksa:

```sh
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap-local.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202609300001_guild_raids.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202609300002_public_member_lookup.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/guild-raids.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/public-member-lookup.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202609300003_username_auth.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202609300004_guild_reward_transparency.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610010005_member_directory.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/member-directory.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610010006_raid_member_visibility.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/username-auth.sql
psql "$RF_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/guild-reward-transparency.sql
RF_TEST_DATABASE_URL="$RF_TEST_DATABASE_URL" node supabase/tests/concurrency.mjs
```

Bootstrap hanya meniru schema historis Supabase untuk menguji migration. Runtime terbaru memakai `private.staff_accounts` dan `private.staff_sessions`, tanpa layanan Auth.

## Referensi

- [Node.js crypto: scrypt, randomBytes, timingSafeEqual](https://nodejs.org/download/release/v26.7.0/docs/api/crypto.html)

## Verifikasi implementasi

- 11 unit test untuk pembagian, normalisasi username, hashing password, dan token sesi lulus.
- Uji PostgreSQL lokal untuk akses member, akun/sesi, undangan username, isolasi guild, pembayaran, serta finalisasi bersamaan lulus.
- Uji browser memakai autentikasi aplikasi sebenarnya dan PostgreSQL lokal melalui adapter transport: register langsung masuk, login salah/benar, logout mencabut sesi, CSRF ditolak, alur raid lengkap, pencarian member anonim, undangan lintas register, pindah owner, dan cabut akses lulus.
- Lint, TypeScript, dan build Webpack lulus. Koneksi ke project Supabase hosted belum dijalankan; isi env dan terapkan migration sebelum digunakan.

## Troubleshooting pencarian member

Jika hasil pencarian menyebut format database belum diperbarui, terapkan migration 004. Format lama berisi `rows`, sedangkan tampilan seluruh guild membutuhkan `members` dan `raids`. Migration 005 menyediakan daftar nama server/guild untuk pilihan pencarian. Terapkan kedua migration yang belum dijalankan; refresh halaman setelah selesai. Nama server dan guild menjadi data publik, sedangkan akun pengurus tetap privat.

## Pagination dan visibilitas kegiatan

Daftar anggota publik dan daftar kelola anggota menampilkan 10 baris per halaman (pagination di browser; roster tetap dimuat sekali). Riwayat kegiatan pengurus juga menampilkan 10 kegiatan per halaman. Pada riwayat raid, pengurus dapat mencentang **Tampilkan di member**; perubahan disimpan langsung dan dicatat dalam audit. Raid lama dan raid baru secara default tetap dicentang. Hanya raid final yang dicentang dikirim oleh pencarian publik; filter ini diterapkan sebelum pagination 10 raid di database. Pengaturan ini berlaku untuk semua pencarian member dalam guild.
