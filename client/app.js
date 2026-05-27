// ============================================================
//  DISTRIBUTED CHAT - CLIENT-SIDE JAVASCRIPT
//
//  File ini menangani semua logika frontend:
//  1. Koneksi Socket.io ke server
//  2. Login & join room
//  3. Kirim & terima pesan real-time
//  4. Update daftar user online
//  5. Notifikasi join/leave
//  6. Typing indicator
// ============================================================

(function () {
  'use strict';

  // ============================================================
  //  KONFIGURASI
  // ============================================================

  // Warna avatar berdasarkan initial nama (konsisten per user)
  const AVATAR_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
    '#F97316', '#EAB308', '#22C55E', '#14B8A6',
    '#06B6D4', '#3B82F6', '#A855F7', '#D946EF'
  ];

  // Room emoji mapping
  const ROOM_EMOJIS = {
    'Teknik Informatika': '🖥️',
    'Sistem Informasi': '📊',
    'Manajemen': '📈',
    'Umum': '🌐'
  };

  // ============================================================
  //  STATE
  // ============================================================
  let socket = null;
  let currentUser = null;
  let currentRoom = null;
  let typingTimeout = null;
  let isTyping = false;

  // ============================================================
  //  UTILITY FUNCTIONS
  // ============================================================

  /**
   * Mendapatkan warna avatar berdasarkan nama user
   * Menggunakan hash sederhana untuk konsistensi warna
   */
  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  /**
   * Mendapatkan initial nama (1-2 karakter)
   */
  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Format timestamp ke format waktu lokal
   */
  function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    // Jika hari berbeda, tampilkan tanggal
    if (date.toDateString() !== now.toDateString()) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    }
    
    return `${hours}:${minutes}`;
  }

  /**
   * Escape HTML untuk mencegah XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Auto scroll ke pesan terbaru
   */
  function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
      // Gunakan requestAnimationFrame untuk smooth scroll
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  /**
   * Tampilkan toast notification
   */
  function showToast(message) {
    // Hapus toast lama
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Hapus setelah 3 detik
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  // ============================================================
  //  SOCKET.IO CONNECTION
  // ============================================================

  /**
   * Inisialisasi koneksi Socket.io ke server
   */
  function initSocket() {
    // Connect ke server yang sama (auto-detect URL)
    // Penting untuk Railway: mulai dengan 'polling' agar handshake berhasil
    // melewati proxy cloud, lalu upgrade ke 'websocket' secara otomatis
    socket = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    // Event: Berhasil terhubung
    socket.on('connect', () => {
      console.log('✅ Terhubung ke server:', socket.id);
      updateServerStatus('connected', 'Terhubung ke server');

      // Jika sedang di halaman chat, re-join room
      if (currentUser && currentRoom) {
        socket.emit('join-room', {
          username: currentUser,
          room: currentRoom
        });
      }
    });

    // Event: Terputus dari server
    socket.on('disconnect', (reason) => {
      console.log('❌ Terputus dari server:', reason);
      updateServerStatus('error', 'Terputus dari server');
    });

    // Event: Sedang mencoba reconnect
    socket.on('reconnect_attempt', (attemptNumber) => {
      updateServerStatus('', `Reconnecting... (${attemptNumber})`);
    });

    // Event: Error
    socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err.message);
      updateServerStatus('error', 'Gagal terhubung ke server');
    });

    // Event: Error dari server
    socket.on('error-message', (data) => {
      showToast('⚠️ ' + data.message);
    });

    // ========================================
    //  CHAT EVENTS
    // ========================================

    // Event: Menerima history chat saat join room
    socket.on('chat-history', (data) => {
      console.log(`📜 Menerima ${data.messages.length} history messages`);
      renderHistory(data.messages);
    });

    // Event: Pesan baru masuk (dari Redis Pub/Sub)
    socket.on('new-message', (data) => {
      console.log(`💬 Pesan dari ${data.username}: ${data.message}`);
      appendMessage(data);
      scrollToBottom();
    });

    // Event: User bergabung ke room
    socket.on('user-joined', (data) => {
      console.log(`👤 ${data.username} bergabung`);
      appendSystemMessage(`<strong>${escapeHtml(data.username)}</strong> bergabung ke room`);
      scrollToBottom();
    });

    // Event: User keluar dari room
    socket.on('user-left', (data) => {
      console.log(`👋 ${data.username} keluar`);
      appendSystemMessage(`<strong>${escapeHtml(data.username)}</strong> keluar dari room`);
      scrollToBottom();
    });

    // Event: Update daftar user online
    socket.on('online-users', (data) => {
      console.log(`👥 Online users: ${data.count}`, data.users);
      updateOnlineUsers(data.users);
    });

    // Event: Typing indicators
    socket.on('user-typing', (data) => {
      showTypingIndicator(data.username);
    });

    socket.on('user-stop-typing', () => {
      hideTypingIndicator();
    });
  }

  // ============================================================
  //  SERVER STATUS UPDATE
  // ============================================================
  function updateServerStatus(status, text) {
    // Update status dot di halaman LOGIN (index.html)
    const statusEl = document.getElementById('serverStatus');
    if (statusEl) {
      statusEl.className = 'server-status ' + status;
      const textEl = statusEl.querySelector('.status-text');
      if (textEl) textEl.textContent = text;
    }

    // Update info server di sidebar halaman CHAT (chat.html)
    // Ini terpisah dari statusEl agar tidak terkena early return
    const serverInfo = document.getElementById('serverInfo');
    if (serverInfo) {
      serverInfo.textContent = status === 'connected' ? '✅ Terhubung' : text;
    }
  }

  // ============================================================
  //  LOGIN PAGE LOGIC
  // ============================================================
  function initLoginPage() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = document.getElementById('usernameInput').value.trim();
      const room = document.getElementById('roomSelect').value;

      // Validasi
      if (!username) {
        document.getElementById('usernameInput').classList.add('shake');
        setTimeout(() => document.getElementById('usernameInput').classList.remove('shake'), 500);
        return;
      }

      if (!room) {
        document.getElementById('roomSelect').parentElement.classList.add('shake');
        setTimeout(() => document.getElementById('roomSelect').parentElement.classList.remove('shake'), 500);
        return;
      }

      // Simpan data user ke sessionStorage
      sessionStorage.setItem('chat_username', username);
      sessionStorage.setItem('chat_room', room);

      // Redirect ke halaman chat
      window.location.href = 'chat.html';
    });
  }

  // ============================================================
  //  CHAT PAGE LOGIC
  // ============================================================
  function initChatPage() {
    const chatApp = document.getElementById('chatApp');
    if (!chatApp) return;

    // Ambil data user dari sessionStorage
    currentUser = sessionStorage.getItem('chat_username');
    currentRoom = sessionStorage.getItem('chat_room');

    // Jika belum login, redirect ke halaman login
    if (!currentUser || !currentRoom) {
      window.location.href = 'index.html';
      return;
    }

    // Set judul room
    const roomEmoji = ROOM_EMOJIS[currentRoom] || '💬';
    document.getElementById('roomName').textContent = `${roomEmoji} ${currentRoom}`;
    document.title = `${currentRoom} | Distributed Chat`;

    // Join room via Socket.io
    socket.emit('join-room', {
      username: currentUser,
      room: currentRoom
    });

    // Setup event listeners
    setupMessageForm();
    setupSidebar();
    setupLeaveButton();
  }

  /**
   * Setup form pengiriman pesan
   */
  function setupMessageForm() {
    const form = document.getElementById('messageForm');
    const input = document.getElementById('messageInput');

    if (!form || !input) return;

    // Submit pesan
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const message = input.value.trim();
      if (!message) return;

      // Kirim pesan ke server
      socket.emit('send-message', { message });

      // Kosongkan input
      input.value = '';
      input.focus();

      // Stop typing indicator
      if (isTyping) {
        socket.emit('stop-typing');
        isTyping = false;
      }
    });

    // Typing indicator
    input.addEventListener('input', () => {
      if (!isTyping) {
        isTyping = true;
        socket.emit('typing');
      }

      // Reset timeout
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('stop-typing');
      }, 2000);
    });

    // Focus input saat halaman dimuat
    input.focus();
  }

  /**
   * Setup sidebar toggle (responsive)
   */
  function setupSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) {
        overlay.classList.toggle('active');
        overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
      }
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        overlay.style.display = 'none';
      });
    }
  }

  /**
   * Setup tombol keluar
   */
  function setupLeaveButton() {
    const btn = document.getElementById('leaveBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      // Hapus data session
      sessionStorage.removeItem('chat_username');
      sessionStorage.removeItem('chat_room');

      // Disconnect socket
      if (socket) socket.disconnect();

      // Redirect ke login
      window.location.href = 'index.html';
    });
  }

  // ============================================================
  //  RENDERING FUNCTIONS
  // ============================================================

  /**
   * Render history pesan yang sudah ada
   */
  function renderHistory(messages) {
    const container = document.getElementById('messagesScroll');
    if (!container) return;

    // Hapus welcome message jika ada history
    const welcome = document.getElementById('welcomeMessage');

    messages.forEach(msg => {
      appendMessage(msg, false);
    });

    // Hapus welcome jika sudah ada pesan
    if (messages.length > 0 && welcome) {
      welcome.style.display = 'none';
    }

    scrollToBottom();
  }

  /**
   * Tambahkan pesan chat ke area pesan
   */
  function appendMessage(data, animate = true) {
    const container = document.getElementById('messagesScroll');
    if (!container) return;

    // Sembunyikan welcome message
    const welcome = document.getElementById('welcomeMessage');
    if (welcome) welcome.style.display = 'none';

    const isSelf = data.username === currentUser;
    const color = getAvatarColor(data.username);
    const initials = getInitials(data.username);
    const time = formatTime(data.timestamp);

    const msgEl = document.createElement('div');
    msgEl.className = `message ${isSelf ? 'self' : 'other'}`;
    if (!animate) msgEl.style.animation = 'none';

    msgEl.innerHTML = `
      <div class="message-avatar" style="background: ${color};">
        ${initials}
      </div>
      <div class="message-bubble">
        <div class="message-sender" style="color: ${color};">
          ${escapeHtml(data.username)}
        </div>
        <div class="message-text">${escapeHtml(data.message)}</div>
        <div class="message-time">
          ${time}
          <span class="message-server-tag">${data.serverId || ''}</span>
        </div>
      </div>
    `;

    container.appendChild(msgEl);
  }

  /**
   * Tambahkan pesan sistem (join/leave)
   */
  function appendSystemMessage(html) {
    const container = document.getElementById('messagesScroll');
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'system-message';
    msgEl.innerHTML = `<span class="system-text">${html}</span>`;
    container.appendChild(msgEl);
  }

  /**
   * Update daftar user online di sidebar
   */
  function updateOnlineUsers(users) {
    const list = document.getElementById('userList');
    const countEl = document.getElementById('onlineCount');
    const headerCount = document.getElementById('headerOnlineCount');

    if (!list) return;

    // Update count
    if (countEl) countEl.textContent = users.length;
    if (headerCount) headerCount.textContent = users.length;

    // Render user list
    list.innerHTML = '';
    users.sort().forEach(user => {
      const li = document.createElement('li');
      const color = getAvatarColor(user);
      const initials = getInitials(user);
      const isYou = user === currentUser;

      li.innerHTML = `
        <div class="user-avatar" style="background: ${color};">
          ${initials}
        </div>
        <div>
          <div class="user-name">${escapeHtml(user)}</div>
          ${isYou ? '<div class="user-you">Kamu</div>' : ''}
        </div>
      `;

      list.appendChild(li);
    });
  }

  /**
   * Tampilkan typing indicator
   */
  function showTypingIndicator(username) {
    if (username === currentUser) return;

    const indicator = document.getElementById('typingIndicator');
    const text = document.getElementById('typingText');
    if (!indicator) return;

    text.textContent = `${username} sedang mengetik...`;
    indicator.style.display = 'flex';

    // Auto-hide setelah 3 detik
    clearTimeout(indicator._hideTimeout);
    indicator._hideTimeout = setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  }

  /**
   * Sembunyikan typing indicator
   */
  function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // ============================================================
  //  INITIALIZATION
  //  Jalankan saat DOM sudah siap
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi koneksi Socket.io
    initSocket();

    // Deteksi halaman mana yang aktif
    if (document.getElementById('loginForm')) {
      initLoginPage();
    } else if (document.getElementById('chatApp')) {
      initChatPage();
    }
  });

})();
