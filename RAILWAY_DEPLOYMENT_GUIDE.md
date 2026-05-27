# 📋 PANDUAN LENGKAP: Deploy Distributed Chat ke Railway.app

Panduan ini akan membimbing kamu langkah-demi-langkah dari mengunggah kode ke GitHub hingga aplikasi chat terdistribusi kamu aktif online di **Railway.app**.

---

## 🔑 PRASYARAT
Sebelum mulai, pastikan kamu sudah memiliki:
1. Akun **GitHub** ([Daftar disini](https://github.com/))
2. Akun **Railway.app** ([Daftar disini](https://railway.app/) menggunakan akun GitHub agar mudah terintegrasi)
3. Aplikasi **Git** terinstall di laptop kamu.

---

## 📂 LANGKAH 1: Unggah Kode ke GitHub

Buka terminal **PowerShell** di laptop kamu, lalu ikuti perintah berikut untuk menginisialisasi Git dan mengunggah kode:

### 1. Masuk ke folder project
```powershell
cd c:\Qohary\JOKI\Distrubuted\distributed-chat
```

### 2. Inisialisasi Git & Commit File
```powershell
# Inisialisasi repositori Git lokal
git init

# Tambahkan semua file ke staging area (file node_modules otomatis terabaikan karena .gitignore)
git add .

# Buat commit pertama
git commit -m "Initial commit - Distributed Chat System"
```

### 3. Buat Repositori Baru di GitHub
1. Buka [GitHub New Repository](https://github.com/new).
2. Isi **Repository name**: `distributed-chat`.
3. Pilih **Private** atau **Public** (bebas).
4. **JANGAN** centang *Add a README*, *Add .gitignore*, atau *Choose a license* (karena kita sudah membuatnya).
5. Klik **Create repository**.

### 4. Push Kode ke GitHub
Salin perintah dari halaman GitHub tadi (pada bagian *...or push an existing repository from the command line*) dan jalankan di terminal kamu:

```powershell
# Sesuaikan USERNAME dengan username GitHub kamu
git branch -M main
git remote add origin https://github.com/USERNAME/distributed-chat.git
git push -u origin main
```

---

## 🚂 LANGKAH 2: Deploy Server di Railway.app

Railway sangat cerdas. Karena di dalam project kita sudah ada file `Dockerfile` di folder root, Railway akan **mendeteksi dan mendeploy aplikasi menggunakan Docker secara otomatis**!

### 1. Buat Project Baru di Railway
1. Masuk ke dashboard [Railway.app](https://railway.app/).
2. Klik tombol **+ New Project** di kanan atas.
3. Pilih opsi **Deploy from GitHub repo**.
4. Pilih repositori `distributed-chat` yang baru saja kamu unggah.
5. Klik **Deploy Now**.
   
> [!NOTE]
> Pada tahap awal ini, proses deploy mungkin akan gagal atau server tidak bisa diakses. **Ini normal** karena server belum terhubung ke Redis. Jangan khawatir, kita akan menyelesaikannya di langkah berikutnya.

---

## 💾 LANGKAH 3: Tambahkan Database Redis

Kita akan membuat Redis database di dashboard Railway yang sama agar terhubung secara privat dan super cepat.

1. Di dalam dashboard project Railway kamu, klik tombol **+ New** (atau klik kanan di area kosong canvas).
2. Pilih **Database** $\rightarrow$ klik **Redis**.
3. Railway akan membuat satu kotak service baru berwarna merah bernama **Redis**. Tunggu sekitar 5-10 detik sampai statusnya menjadi *Active*.

---

## 🔗 LANGKAH 4: Hubungkan Server Node.js ke Redis

Sekarang kita akan menyambungkan server Node.js kita ke Redis menggunakan sistem *Magic Variables* milik Railway.

1. Klik kotak service **distributed-chat** (server Node.js kamu) di dashboard Railway.
2. Masuk ke tab **Variables** di bagian kanan atas layar.
3. Klik tombol **+ Add Variable** lalu masukkan variabel berikut satu-satu:

   | Key | Value | Keterangan |
   |-----|-------|------------|
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` | *Railway otomatis mengambil koneksi internal Redis* |
   | `SERVER_ID` | `railway-server-1` | *Nama identitas server kamu* |

4. Klik tombol **Save / Add**.
5. Railway akan mendeteksi perubahan ini dan langsung melakukan **Re-deploy** server secara otomatis agar variabel baru tersebut aktif.

---

## 🌐 LANGKAH 5: Buat Domain Publik (Link Website)

Agar web chat kamu bisa dibuka di browser handphone atau laptop lain, kita perlu membuat alamat domain publik gratis dari Railway.

1. Tetap di menu service **distributed-chat** (server Node.js).
2. Buka tab **Settings** di bagian kanan atas.
3. Gulir ke bawah hingga menemukan kolom **Networking**.
4. Klik tombol **Generate Domain**.
5. Railway akan membuatkan kamu alamat web acak yang aman (HTTPS) berakhiran `.up.railway.app` (contoh: `https://distributed-chat-production.up.railway.app`).
6. *Opsional:* Kamu bisa mengedit nama domain tersebut agar lebih rapi (misal: `https://chat-sisdis-kamu.up.railway.app`).

---

## 🧪 LANGKAH 6: Pengujian Online & Demo Kuliah

Sekarang aplikasi distributed chat kamu sudah online penuh! Berikut cara mendemonstrasikannya ke dosen:

1. Salin link `.up.railway.app` yang didapatkan di Langkah 5.
2. Bagikan link tersebut ke teman kelas atau buka di **2 perangkat berbeda** (misal Laptop kamu dan Handphone kamu, atau buka di tab biasa dan tab *Incognito*).
3. Masuk dengan nama berbeda (misal **Alice** di Laptop, **Bob** di HP) dan pilih departemen yang sama (misal **Teknik Informatika**).
4. Kirim pesan chat! Pesan akan terkirim secara instan (real-time).
5. **Poin Nilai Tambah (Distributed Proof)**: 
   * Buka menu *Inspect Element* (F12) di browser $\rightarrow$ masuk ke tab **Console**.
   * Kamu akan melihat log koneksi WebSocket yang terhubung langsung ke jaringan awan Railway secara *real-time*.
   * Semua riwayat chat (50 pesan terakhir) tersimpan dengan aman di database Redis internal Railway kamu!
