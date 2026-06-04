# 🚀 Distributed Group Chat System

> Sistem Chat Terdistribusi Real-Time menggunakan **Socket.io** dan **Redis Pub/Sub**  
> Tugas Mata Kuliah: **Sistem Terdistribusi**

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?logo=socket.io&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## 📋 Deskripsi

Aplikasi chat **real-time** berbasis **distributed system** dimana setiap departemen/kelas memiliki chat room tersendiri. Sistem menggunakan **multiple server** yang disinkronisasi melalui **Redis Pub/Sub** sehingga pesan terkirim ke semua server secara **real-time**.

### Konsep Distributed System yang Diterapkan

| Konsep | Implementasi |
|--------|-------------|
| **Message Broker** | Redis Pub/Sub sebagai penghubung antar server |
| **Horizontal Scaling** | 2+ server berjalan paralel di port berbeda |
| **Real-time Sync** | Pesan di-publish ke Redis, semua server subscribe |
| **Shared State** | Data online users & history disimpan di Redis (shared) |
| **Fault Tolerance** | Jika 1 server mati, server lain tetap berjalan |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────┐     ┌─────────────┐
│   Client A  │     │   Client B  │
│  (Browser)  │     │  (Browser)  │
└──────┬──────┘     └──────┬──────┘
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────┐
│  Server 1    │    │  Server 2    │
│  (Port 3000) │    │  (Port 3001) │
│  Socket.io   │    │  Socket.io   │
└──────┬───────┘    └──────┬───────┘
       │                    │
       │   ┌────────────┐   │
       └──►│   REDIS    │◄──┘
           │  Pub/Sub   │
           │  + Store   │
           └────────────┘
```

**Alur Pesan:**
1. Client A mengirim pesan via WebSocket ke Server 1
2. Server 1 **PUBLISH** pesan ke Redis channel
3. Redis meneruskan pesan ke **SEMUA subscriber** (Server 1 & Server 2)
4. Server 1 & Server 2 **broadcast** pesan ke client masing-masing
5. Client B di Server 2 menerima pesan secara **real-time**

---

## ✨ Fitur

- ✅ **Login sederhana** (nama + pilih departemen, tanpa password)
- ✅ **4 Room/Departemen**: Teknik Informatika, Sistem Informasi, Manajemen, Umum
- ✅ **Chat real-time** dalam room
- ✅ **Daftar user online** di sidebar
- ✅ **Notifikasi** "X bergabung / keluar dari room"
- ✅ **History chat** (50 pesan terakhir disimpan di Redis)
- ✅ **Timestamp** setiap pesan
- ✅ **Tampilan berbeda** pesan sendiri (kanan, biru) vs orang lain (kiri, abu)
- ✅ **Typing indicator** saat user sedang mengetik
- ✅ **Responsive design** (desktop & mobile)
- ✅ **Server ID tag** di setiap pesan (untuk demo distributed)

---

## 📁 Struktur Folder

```
distributed-chat/
├── server/
│   ├── server.js          ← Main chat server (Express + Socket.io + Redis)
│   ├── package.json       ← Dependencies
│   ├── Dockerfile         ← Docker image untuk server
│   ├── .env               ← Environment variables (lokal)
│   └── .env.example       ← Template environment variables
├── client/
│   ├── index.html         ← Halaman login
│   ├── chat.html          ← Halaman chat room
│   ├── style.css          ← Styling (glassmorphism + dark theme)
│   └── app.js             ← Frontend JavaScript (Socket.io client)
├── docker-compose.yml     ← Jalankan semua service sekaligus
└── README.md              ← Dokumentasi (file ini)
```

---

## 🛠️ Teknologi

| Layer | Teknologi | Fungsi |
|-------|-----------|--------|
| Backend | Node.js + Express | HTTP server & static file serving |
| Real-time | Socket.io | WebSocket communication |
| Message Broker | Redis Pub/Sub | Sinkronisasi antar server |
| Database | Redis (Lists & Sets) | Simpan history chat & online users |
| Frontend | HTML + CSS + Vanilla JS | User interface |
| Container | Docker + Docker Compose | Deploy multi-service |

---

## 🚀 Cara Menjalankan

### Prasyarat

- **Node.js** v18 atau lebih baru → [Download](https://nodejs.org/)
- **Redis** server → [Download](https://redis.io/download) atau gunakan Docker
- **Docker** (opsional) → [Download](https://docker.com/)

---

### Opsi 1: Jalankan Manual (Tanpa Docker)

#### Langkah 1: Install Redis

**Windows** (menggunakan WSL atau Memurai):
```bash
# Menggunakan Docker untuk Redis saja:
docker run -d --name redis -p 6379:6379 redis:alpine

# Atau install Memurai (Redis for Windows):
# Download dari https://www.memurai.com/
```

**Linux/Mac**:
```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Mac (Homebrew)
brew install redis
brew services start redis
```

#### Langkah 2: Install Dependencies

```bash
cd distributed-chat/server
npm install
```

#### Langkah 3: Jalankan Server 1 (Terminal 1)

```bash
cd distributed-chat/server
PORT=3000 SERVER_ID=server-1 node server.js
```

**Di Windows (CMD):**
```cmd
cd distributed-chat\server
set PORT=3000 && set SERVER_ID=server-1 && node server.js
```

**Di Windows (PowerShell):**
```powershell
cd distributed-chat\server
$env:PORT=3000; $env:SERVER_ID="server-1"; node server.js
```

#### Langkah 4: Jalankan Server 2 (Terminal 2)

```bash
cd distributed-chat/server
PORT=3001 SERVER_ID=server-2 node server.js
```

**Di Windows (PowerShell):**
```powershell
cd distributed-chat\server
$env:PORT=3001; $env:SERVER_ID="server-2"; node server.js
```

#### Langkah 5: Buka Browser

- **Server 1**: http://localhost:3000
- **Server 2**: http://localhost:3001

Buka 2 tab browser berbeda, satu ke port 3000 dan satu ke port 3001 untuk melihat konsep distributed system bekerja!

---

### Opsi 2: Jalankan dengan Docker Compose

```bash
cd distributed-chat
docker-compose up --build
```

Ini akan menjalankan:
- ✅ Redis (port 6379)
- ✅ Chat Server 1 (port 3000)
- ✅ Chat Server 2 (port 3001)

Untuk menghentikan:
```bash
docker-compose down
```

---

## 🧪 Cara Testing

### Test Distributed System

1. Buka **Tab 1**: http://localhost:3000
   - Login dengan nama "Alice", pilih room "Teknik Informatika"

2. Buka **Tab 2**: http://localhost:3001
   - Login dengan nama "Bob", pilih room "Teknik Informatika"

3. Kirim pesan dari Alice → Bob akan menerima secara real-time (meskipun di server berbeda!)

4. Perhatikan **Server ID** di setiap pesan:
   - Pesan Alice menampilkan `server-1`
   - Pesan Bob menampilkan `server-2`
   - Ini membuktikan pesan melewati Redis Pub/Sub antar server!

### Test Fitur Lainnya

- ✅ Cek notifikasi "X bergabung ke room"
- ✅ Cek daftar online users di sidebar
- ✅ Tutup satu tab, cek notifikasi "X keluar dari room"
- ✅ Refresh halaman, cek history chat masih ada
- ✅ Coba pindah room, pesan terisolasi per room

---

## ☁️ Deploy ke Railway.app

### Langkah 1: Siapkan Repository

```bash
git init
git add .
git commit -m "Initial commit - Distributed Chat System"
git remote add origin https://github.com/USERNAME/distributed-chat.git
git push -u origin main
```

### Langkah 2: Deploy Redis di Railway

1. Buka [railway.app](https://railway.app/) dan login
2. Klik **"New Project"**
3. Pilih **"Provision Redis"** atau cari **Redis** di marketplace
4. Railway akan otomatis membuat Redis instance
5. Catat **Redis URL** di tab Variables/Connect:
   ```
   redis://default:PASSWORD@HOST:PORT
   ```

### Langkah 3: Deploy Chat Server

1. Di project yang sama, klik **"New Service"**
2. Pilih **"GitHub Repo"** → pilih repository Anda
3. Set **Root Directory** ke `server`
4. Tambahkan **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `PORT` | (biarkan kosong, Railway auto-assign) |
   | `REDIS_URL` | `redis://default:PASSWORD@HOST:PORT` (dari langkah 2) |
   | `SERVER_ID` | `railway-server-1` |

5. Klik **"Deploy"**

### Langkah 4: Akses Aplikasi

1. Setelah deploy selesai, Railway akan memberikan URL publik
2. Buka URL tersebut di browser
3. Chat system sudah berjalan online! 🎉

### Catatan Railway

- `PORT` akan otomatis di-set oleh Railway melalui `process.env.PORT`
- Pastikan Redis URL menggunakan internal network jika tersedia (lebih cepat)
- Untuk demo presentasi, 1 server di Railway sudah cukup (Redis tetap diperlukan)

---

## 📊 Diagram Alur (Untuk Presentasi)

### Alur Pengiriman Pesan

```
User A ketik pesan
       │
       ▼
Browser kirim via WebSocket
       │
       ▼
Server 1 terima pesan
       │
       ├──► Simpan ke Redis (History)
       │
       └──► PUBLISH ke Redis Channel "chat:message:room"
                    │
                    ▼
              Redis Pub/Sub
              ┌─────┴─────┐
              ▼           ▼
          Server 1    Server 2
          (subscribe) (subscribe)
              │           │
              ▼           ▼
          Broadcast    Broadcast
          ke semua     ke semua
          client di    client di
          server ini   server ini
              │           │
              ▼           ▼
          Client A    Client B
          menerima    menerima
          pesan       pesan
```

### Redis Data Structure

| Key Pattern | Tipe | Keterangan |
|-------------|------|------------|
| `online:{room}` | Set | Daftar username yang online |
| `history:{room}` | List | 50 pesan terakhir |
| `chat:message:{room}` | Channel | Pub/Sub untuk pesan |
| `chat:join:{room}` | Channel | Pub/Sub untuk join |
| `chat:leave:{room}` | Channel | Pub/Sub untuk leave |
| `chat:users:{room}` | Channel | Pub/Sub untuk update users |

---

## 🔑 Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server HTTP |
| `REDIS_URL` | `redis://localhost:6379` | URL koneksi Redis |
| `SERVER_ID` | `server-{PORT}` | Identifier unik server |

---

## 👨‍💻 Author

Dibuat untuk Tugas Mata Kuliah **Sistem Terdistribusi** - 2025

---

## 📝 Lisensi

Project ini dibuat untuk keperluan akademik.
#   d i s t r i b u t e d - c h a t  
 