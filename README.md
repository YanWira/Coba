# 🏨 MERUSAKA — Hotel Security System (Fullstack)

Sistem keamanan hotel berbasis web dengan backend REST API dan database server-side.

---

## 📁 Struktur Proyek

```
merusaka-security/
├── backend/
│   ├── server.js          ← Express.js REST API
│   ├── package.json
│   ├── .env.example       ← Copy ke .env dan isi nilainya
│   └── data/
│       └── merusaka.db    ← SQLite database (dibuat otomatis)
└── frontend/
    └── index.html         ← Single-page application
```

---

## 🚀 Cara Menjalankan (Development)

### 1. Install Node.js
Pastikan Node.js v18+ sudah terinstall: https://nodejs.org

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# (opsional) Edit .env sesuai kebutuhan
npm start
```

Server akan berjalan di: **http://localhost:3000**

### 3. Akses Aplikasi
Buka browser ke: **http://localhost:3000**

---

## 🔐 Login Default

| Username | Password | Role |
|----------|----------|------|
| admin    | admin    | Admin |
| user1    | user123  | Petugas |

> ⚠️ **PENTING**: Ganti password default segera setelah pertama kali login!

---

## 🌐 Deploy ke Server (Production)

### Menggunakan PM2 (Recommended)
```bash
# Install PM2 secara global
npm install -g pm2

# Masuk ke folder backend
cd backend

# Install dependencies
npm install --production

# Buat file .env dengan konfigurasi production
cp .env.example .env
nano .env  # Edit JWT_SECRET dengan string aman

# Jalankan dengan PM2
pm2 start server.js --name "merusaka"
pm2 save
pm2 startup  # Auto-start saat server reboot
```

### Menggunakan Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production
COPY . .
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "server.js"]
```

### Konfigurasi Nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }
}
```

---

## ⚙️ Environment Variables (.env)

```env
PORT=3000
JWT_SECRET=your-very-long-random-secret-key-here
DB_PATH=./data/merusaka.db
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/auth/login | Login, returns JWT token |
| POST | /api/auth/logout | Logout, hapus session |

### Vehicles
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | /api/vehicles | ✅ | Daftar semua kendaraan |
| POST | /api/vehicles | ✅ | Tambah kendaraan baru |
| PUT | /api/vehicles/:id | Admin | Edit data kendaraan |
| DELETE | /api/vehicles/:id | Admin | Hapus kendaraan |
| GET | /api/vehicles/:id/photo | ✅ | Foto full-size (untuk lightbox) |

### Stats
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | /api/stats | Admin | Statistik kendaraan |

### Users
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | /api/users | Admin | Daftar user |
| POST | /api/users | Admin | Tambah user baru |
| PUT | /api/users/:id | Admin | Ubah password user |
| DELETE | /api/users/:id | Admin | Hapus user |

### Sessions
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | /api/sessions | Admin | User yang sedang online |

### Backup & Restore
| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | /api/export | Admin | Download semua data (JSON) |
| POST | /api/import | Admin | Restore dari file JSON |

---

## 🗄️ Database

Menggunakan **SQLite** via `better-sqlite3`.
- File database disimpan di `backend/data/merusaka.db`
- Lokasi bisa dikonfigurasi via `DB_PATH` di `.env`
- Backup otomatis tersedia via fitur Export DB di admin dashboard

### Tabel
- **users** — Akun pengguna (admin & petugas)
- **vehicles** — Data kendaraan (plat, foto, petugas, dll)
- **sessions** — Sesi user yang sedang login

---

## 📦 Dependencies

| Package | Kegunaan |
|---------|----------|
| express | HTTP server & routing |
| better-sqlite3 | SQLite database |
| jsonwebtoken | JWT authentication |
| cors | Cross-origin resource sharing |
| dotenv | Environment variables |

---

## 🆚 Perubahan dari Versi Sebelumnya

| Fitur | Versi Lama | Versi Baru |
|-------|-----------|-----------|
| Database | `localStorage` (browser) | SQLite (server) |
| Foto | `IndexedDB` (browser) | SQLite base64 (server) |
| Auth | Hard-coded di browser | JWT + backend verification |
| Multi-user sync | BroadcastChannel (tab saja) | Server polling (30s) |
| Export/Import | File JSON lokal | Download dari server |

---

*MERUSAKA Hotel Security System © 2025*
