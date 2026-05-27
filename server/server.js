// ============================================================
//  DISTRIBUTED GROUP CHAT SERVER
//  Sistem Chat Terdistribusi menggunakan Socket.io + Redis Pub/Sub
//  
//  Arsitektur:
//  Client <-> Server 1 (Socket.io) <-> Redis Pub/Sub <-> Server 2 (Socket.io) <-> Client
//
//  Setiap server bisa berjalan di port berbeda.
//  Redis berfungsi sebagai message broker untuk sinkronisasi
//  pesan antar server secara real-time.
// ============================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const cors = require('cors');
const path = require('path');

// ============================================================
//  KONFIGURASI
// ============================================================
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SERVER_ID = process.env.SERVER_ID || `server-${PORT}`;
const MAX_HISTORY = 50; // Simpan 50 pesan terakhir per room

// Daftar room/departemen yang tersedia
const AVAILABLE_ROOMS = [
  'Teknik Informatika',
  'Sistem Informasi',
  'Manajemen',
  'Umum'
];

// ============================================================
//  INISIALISASI SERVER
// ============================================================
const app = express();
const server = http.createServer(app);

// Penting untuk Railway/cloud proxy: agar IP address terdeteksi dengan benar
app.set('trust proxy', 1);

// Socket.io dengan konfigurasi khusus untuk Railway cloud proxy
// - transports: dukung polling DAN websocket (Railway butuh polling sebagai fallback)
// - pingTimeout/pingInterval: lebih longgar agar koneksi tidak putus di cloud
// - allowEIO3: true agar kompatibel dengan berbagai client
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json());

// Serve static files dari folder client
app.use(express.static(path.join(__dirname, '..', 'client')));

// ============================================================
//  KONEKSI REDIS
//  
//  Kita membutuhkan 3 koneksi Redis:
//  1. redisPub   -> untuk PUBLISH pesan ke channel
//  2. redisSub   -> untuk SUBSCRIBE dan menerima pesan dari channel
//  3. redisStore -> untuk operasi data (SET, GET, LPUSH, dll)
//
//  Catatan: Redis subscriber tidak bisa digunakan untuk
//  operasi data biasa, makanya butuh koneksi terpisah.
// ============================================================
// Konfigurasi ioredis yang aman untuk cloud deployment:
// - maxRetriesPerRequest: null  -> jangan crash saat retry, biarkan reconnect terus
// - enableReadyCheck: false     -> jangan tunggu READY signal, langsung connect
// - retryStrategy: exponential backoff agar tidak spam retry terlalu cepat
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Tunggu paling lama 5 detik antar retry
    const delay = Math.min(times * 200, 5000);
    console.log(`[${SERVER_ID}] 🔄 Redis retry #${times} dalam ${delay}ms`);
    return delay;
  }
};

const redisPub = new Redis(REDIS_URL, redisOptions);
const redisSub = new Redis(REDIS_URL, redisOptions);
const redisStore = new Redis(REDIS_URL, redisOptions);

// Log koneksi Redis
redisPub.on('connect', () => {
  console.log(`[${SERVER_ID}] ✅ Redis Publisher terhubung`);
});

redisSub.on('connect', () => {
  console.log(`[${SERVER_ID}] ✅ Redis Subscriber terhubung`);
});

redisStore.on('connect', () => {
  console.log(`[${SERVER_ID}] ✅ Redis Store terhubung`);
});

redisPub.on('error', (err) => {
  console.error(`[${SERVER_ID}] ❌ Redis Publisher error:`, err.message);
});

redisSub.on('error', (err) => {
  console.error(`[${SERVER_ID}] ❌ Redis Subscriber error:`, err.message);
});

redisStore.on('error', (err) => {
  console.error(`[${SERVER_ID}] ❌ Redis Store error:`, err.message);
});

// ============================================================
//  REDIS PUB/SUB CHANNELS
//
//  Channel yang digunakan:
//  - chat:message:{room}   -> pesan chat dalam room
//  - chat:join:{room}      -> notifikasi user bergabung
//  - chat:leave:{room}     -> notifikasi user keluar
//  - chat:users:{room}     -> update daftar user online
// ============================================================

// Subscribe ke semua channel untuk setiap room
AVAILABLE_ROOMS.forEach(room => {
  const roomKey = room.replace(/\s+/g, '_').toLowerCase();
  redisSub.subscribe(
    `chat:message:${roomKey}`,
    `chat:join:${roomKey}`,
    `chat:leave:${roomKey}`,
    `chat:users:${roomKey}`
  );
});

console.log(`[${SERVER_ID}] 📡 Subscribed ke semua room channels`);

// ============================================================
//  HANDLER REDIS SUBSCRIBER
//
//  Ketika ada pesan masuk dari Redis channel (yang dipublish
//  oleh server manapun), broadcast ke semua client yang
//  terhubung ke server ini.
//
//  Ini adalah INTI dari distributed system:
//  Server A publish -> Redis -> Server B subscribe -> broadcast ke client B
// ============================================================
redisSub.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);

    // Cari tipe channel (message/join/leave/users)
    const parts = channel.split(':');
    const type = parts[1]; // message, join, leave, users
    const roomKey = parts.slice(2).join(':');

    // Log untuk debugging
    console.log(`[${SERVER_ID}] 📨 Redis message di channel ${channel}`);

    // Emit ke semua client di room ini pada server ini
    switch (type) {
      case 'message':
        io.to(roomKey).emit('new-message', data);
        break;
      case 'join':
        io.to(roomKey).emit('user-joined', data);
        break;
      case 'leave':
        io.to(roomKey).emit('user-left', data);
        break;
      case 'users':
        io.to(roomKey).emit('online-users', data);
        break;
    }
  } catch (err) {
    console.error(`[${SERVER_ID}] ❌ Error parsing Redis message:`, err.message);
  }
});

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Mendapatkan key Redis untuk room tertentu
 * Mengganti spasi dengan underscore dan lowercase
 */
function getRoomKey(room) {
  return room.replace(/\s+/g, '_').toLowerCase();
}

/**
 * Mendapatkan daftar user online di suatu room dari Redis
 * Data disimpan di Redis Set dengan key "online:{roomKey}"
 */
async function getOnlineUsers(roomKey) {
  try {
    const users = await redisStore.smembers(`online:${roomKey}`);
    return users;
  } catch (err) {
    console.error(`[${SERVER_ID}] Error getting online users:`, err.message);
    return [];
  }
}

/**
 * Menyimpan pesan ke history di Redis
 * Menggunakan Redis List (LPUSH) dan membatasi 50 pesan terakhir (LTRIM)
 */
async function saveMessageToHistory(roomKey, messageData) {
  try {
    const key = `history:${roomKey}`;
    await redisStore.lpush(key, JSON.stringify(messageData));
    // Hanya simpan 50 pesan terakhir
    await redisStore.ltrim(key, 0, MAX_HISTORY - 1);
  } catch (err) {
    console.error(`[${SERVER_ID}] Error saving message:`, err.message);
  }
}

/**
 * Mengambil history pesan dari Redis
 * Mengembalikan array pesan yang sudah diurutkan dari lama ke baru
 */
async function getMessageHistory(roomKey) {
  try {
    const key = `history:${roomKey}`;
    const messages = await redisStore.lrange(key, 0, MAX_HISTORY - 1);
    // Parse dan balik urutan (karena LPUSH menambahkan di depan)
    return messages.map(msg => JSON.parse(msg)).reverse();
  } catch (err) {
    console.error(`[${SERVER_ID}] Error getting history:`, err.message);
    return [];
  }
}

/**
 * Broadcast daftar user online ke semua server melalui Redis
 */
async function broadcastOnlineUsers(roomKey) {
  const users = await getOnlineUsers(roomKey);
  redisPub.publish(`chat:users:${roomKey}`, JSON.stringify({
    room: roomKey,
    users: users,
    count: users.length
  }));
}

// ============================================================
//  SOCKET.IO EVENT HANDLERS
//
//  Menangani koneksi WebSocket dari client:
//  1. join-room   -> user bergabung ke room
//  2. send-message -> user mengirim pesan
//  3. disconnect  -> user terputus
// ============================================================
io.on('connection', (socket) => {
  console.log(`[${SERVER_ID}] 🔌 Client terhubung: ${socket.id}`);

  // Simpan info user di socket instance
  socket.userData = {
    username: null,
    room: null,
    roomKey: null
  };

  // ----------------------------------------------------------
  //  EVENT: join-room
  //  Dipanggil saat user masuk ke chat room
  // ----------------------------------------------------------
  socket.on('join-room', async (data) => {
    const { username, room } = data;

    // Validasi input
    if (!username || !room) {
      socket.emit('error-message', { message: 'Username dan room harus diisi!' });
      return;
    }

    // Validasi room tersedia
    if (!AVAILABLE_ROOMS.includes(room)) {
      socket.emit('error-message', { message: 'Room tidak valid!' });
      return;
    }

    const roomKey = getRoomKey(room);

    // Simpan data user di socket
    socket.userData = { username, room, roomKey };

    // Masukkan socket ke room Socket.io (untuk broadcast lokal)
    socket.join(roomKey);

    // Tambahkan user ke daftar online di Redis
    await redisStore.sadd(`online:${roomKey}`, username);

    console.log(`[${SERVER_ID}] 👤 ${username} bergabung ke room ${room}`);

    // Ambil dan kirim history pesan ke user yang baru bergabung
    const history = await getMessageHistory(roomKey);
    socket.emit('chat-history', { messages: history });

    // Publish notifikasi "user joined" ke Redis
    // Semua server akan menerima dan broadcast ke client masing-masing
    const joinData = {
      username,
      room,
      roomKey,
      timestamp: new Date().toISOString(),
      serverId: SERVER_ID,
      type: 'join'
    };
    redisPub.publish(`chat:join:${roomKey}`, JSON.stringify(joinData));

    // Broadcast update daftar user online
    await broadcastOnlineUsers(roomKey);
  });

  // ----------------------------------------------------------
  //  EVENT: send-message
  //  Dipanggil saat user mengirim pesan chat
  // ----------------------------------------------------------
  socket.on('send-message', async (data) => {
    const { message } = data;
    const { username, room, roomKey } = socket.userData;

    // Validasi
    if (!username || !roomKey) {
      socket.emit('error-message', { message: 'Anda belum bergabung ke room!' });
      return;
    }

    if (!message || message.trim() === '') {
      return; // Abaikan pesan kosong
    }

    // Buat objek pesan
    const messageData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username,
      message: message.trim(),
      room,
      roomKey,
      timestamp: new Date().toISOString(),
      serverId: SERVER_ID
    };

    console.log(`[${SERVER_ID}] 💬 ${username}@${room}: ${message.trim()}`);

    // Simpan pesan ke history di Redis
    await saveMessageToHistory(roomKey, messageData);

    // Publish pesan ke Redis channel
    // Semua server yang subscribe akan menerima dan broadcast ke client
    redisPub.publish(`chat:message:${roomKey}`, JSON.stringify(messageData));
  });

  // ----------------------------------------------------------
  //  EVENT: typing
  //  Dipanggil saat user sedang mengetik (opsional, untuk UX)
  // ----------------------------------------------------------
  socket.on('typing', () => {
    const { username, roomKey } = socket.userData;
    if (username && roomKey) {
      socket.to(roomKey).emit('user-typing', { username });
    }
  });

  socket.on('stop-typing', () => {
    const { username, roomKey } = socket.userData;
    if (username && roomKey) {
      socket.to(roomKey).emit('user-stop-typing', { username });
    }
  });

  // ----------------------------------------------------------
  //  EVENT: disconnect
  //  Dipanggil saat user terputus (menutup browser, koneksi putus)
  // ----------------------------------------------------------
  socket.on('disconnect', async () => {
    const { username, room, roomKey } = socket.userData;

    if (username && roomKey) {
      console.log(`[${SERVER_ID}] 👋 ${username} keluar dari room ${room}`);

      // Hapus user dari daftar online di Redis
      await redisStore.srem(`online:${roomKey}`, username);

      // Publish notifikasi "user left" ke Redis
      const leaveData = {
        username,
        room,
        roomKey,
        timestamp: new Date().toISOString(),
        serverId: SERVER_ID,
        type: 'leave'
      };
      redisPub.publish(`chat:leave:${roomKey}`, JSON.stringify(leaveData));

      // Broadcast update daftar user online
      await broadcastOnlineUsers(roomKey);
    }

    console.log(`[${SERVER_ID}] 🔌 Client terputus: ${socket.id}`);
  });
});

// ============================================================
//  REST API ENDPOINTS
//  Untuk mendapatkan informasi tanpa WebSocket
// ============================================================

// Endpoint: Daftar room yang tersedia
app.get('/api/rooms', (req, res) => {
  res.json({
    rooms: AVAILABLE_ROOMS,
    serverId: SERVER_ID
  });
});

// Endpoint: Info server
app.get('/api/info', (req, res) => {
  res.json({
    serverId: SERVER_ID,
    port: PORT,
    uptime: process.uptime(),
    connectedClients: io.engine.clientsCount
  });
});

// Endpoint: User online di room tertentu
app.get('/api/rooms/:room/users', async (req, res) => {
  const roomKey = getRoomKey(req.params.room);
  const users = await getOnlineUsers(roomKey);
  res.json({ room: req.params.room, users, count: users.length });
});

// Health check endpoint (penting untuk Railway deployment)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverId: SERVER_ID, timestamp: new Date().toISOString() });
});

// Fallback: serve index.html untuk route yang tidak dikenali
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ============================================================
//  JALANKAN SERVER
// ============================================================
server.listen(PORT, () => {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log(`  🚀 ${SERVER_ID} berjalan di port ${PORT}`);
  console.log(`  📡 Redis: ${REDIS_URL}`);
  console.log(`  🌐 Buka http://localhost:${PORT}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');
});

// ============================================================
//  GRACEFUL SHUTDOWN
//  Bersihkan koneksi saat server dimatikan
// ============================================================
process.on('SIGINT', async () => {
  console.log(`\n[${SERVER_ID}] 🛑 Server shutting down...`);
  
  // Tutup semua koneksi Redis
  redisPub.disconnect();
  redisSub.disconnect();
  redisStore.disconnect();
  
  // Tutup server
  server.close(() => {
    console.log(`[${SERVER_ID}] ✅ Server stopped`);
    process.exit(0);
  });
});
