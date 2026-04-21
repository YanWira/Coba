'use strict';
require('dotenv').config();

const express  = require('express');
const Database = require('better-sqlite3');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'merusaka-hotel-secret-key-change-in-production';
const DB_PATH    = process.env.DB_PATH || path.join(__dirname, 'data', 'merusaka.db');
const CORS_OPT   = process.env.CORS_ORIGINS
  ? { origin: process.env.CORS_ORIGINS.split(',').map(s => s.trim()) }
  : true;

// ─── DATABASE INIT ───────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    username     TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'user',
    is_protected INTEGER DEFAULT 0,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id           TEXT PRIMARY KEY,
    tipe         TEXT NOT NULL,
    jenis        TEXT,
    plat         TEXT,
    merk         TEXT,
    warna        TEXT,
    tujuan       TEXT,
    lambung      TEXT,
    perusahaan   TEXT,
    has_foto     INTEGER DEFAULT 0,
    thumb_data   TEXT,
    foto_data    TEXT,
    petugas      TEXT,
    timestamp    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    username  TEXT PRIMARY KEY,
    login_at  TEXT NOT NULL,
    role      TEXT NOT NULL
  );
`);

// ─── SEED DEFAULT USERS ──────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
if (!db.prepare('SELECT id FROM users WHERE username = ?').get('admin')) {
  db.prepare('INSERT INTO users (id,username,password,role,is_protected,created_at) VALUES (?,?,?,?,?,?)').run(
    'admin', 'admin', 'admin', 'admin', 1, new Date().toISOString()
  );
  db.prepare('INSERT INTO users (id,username,password,role,is_protected,created_at) VALUES (?,?,?,?,?,?)').run(
    uid(), 'user1', 'user123', 'user', 0, new Date().toISOString()
  );
  console.log('✅ Default users created: admin/admin & user1/user123');
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors(CORS_OPT));
app.use(express.json({ limit: '20mb' })); // Photos can be large base64

// Serve frontend static files
const FRONTEND_PATH = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(FRONTEND_PATH)) {
  app.use(express.static(FRONTEND_PATH));
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau sesi telah berakhir' });
  }
};

const adminOnly = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Hanya admin yang dapat mengakses fitur ini' });

// ─── ROUTES: AUTH ─────────────────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  const u = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!u) return res.status(401).json({ error: 'Username atau password salah' });

  const token = jwt.sign(
    { id: u.id, username: u.username, role: u.role },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  db.prepare('INSERT OR REPLACE INTO sessions (username, login_at, role) VALUES (?, ?, ?)').run(
    u.username, new Date().toISOString(), u.role
  );

  res.json({ token, user: { id: u.id, username: u.username, role: u.role } });
});

// POST /api/auth/logout
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE username = ?').run(req.user.username);
  res.json({ ok: true });
});

// ─── ROUTES: VEHICLES ────────────────────────────────────────────────────────

// GET /api/vehicles  – returns list without foto_data (bandwidth saving)
app.get('/api/vehicles', authMiddleware, (req, res) => {
  const rows = db.prepare(
    'SELECT id,tipe,jenis,plat,merk,warna,tujuan,lambung,perusahaan,has_foto,thumb_data,petugas,timestamp FROM vehicles ORDER BY timestamp DESC'
  ).all();
  res.json(rows);
});

// POST /api/vehicles
app.post('/api/vehicles', authMiddleware, (req, res) => {
  const { tipe, jenis, plat, merk, warna, tujuan, lambung, perusahaan, foto_data, thumb_data } = req.body || {};
  if (!tipe) return res.status(400).json({ error: 'Tipe kendaraan wajib diisi' });

  const id = uid();
  db.prepare(`
    INSERT INTO vehicles (id,tipe,jenis,plat,merk,warna,tujuan,lambung,perusahaan,has_foto,thumb_data,foto_data,petugas,timestamp)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, tipe, jenis || null,
    plat || null, merk || null, warna || null, tujuan || null,
    lambung || null, perusahaan || null,
    foto_data ? 1 : 0,
    thumb_data || null,
    foto_data || null,
    req.user.username,
    new Date().toISOString()
  );

  const v = db.prepare(
    'SELECT id,tipe,jenis,plat,merk,warna,tujuan,lambung,perusahaan,has_foto,thumb_data,petugas,timestamp FROM vehicles WHERE id = ?'
  ).get(id);
  res.status(201).json(v);
});

// PUT /api/vehicles/:id  – admin only
app.put('/api/vehicles/:id', authMiddleware, adminOnly, (req, res) => {
  const { plat, jenis, merk, warna, tujuan, lambung, perusahaan } = req.body || {};
  const r = db.prepare(`
    UPDATE vehicles SET plat=?,jenis=?,merk=?,warna=?,tujuan=?,lambung=?,perusahaan=? WHERE id=?
  `).run(plat || null, jenis || null, merk || null, warna || null, tujuan || null, lambung || null, perusahaan || null, req.params.id);

  if (!r.changes) return res.status(404).json({ error: 'Data tidak ditemukan' });

  const v = db.prepare(
    'SELECT id,tipe,jenis,plat,merk,warna,tujuan,lambung,perusahaan,has_foto,thumb_data,petugas,timestamp FROM vehicles WHERE id = ?'
  ).get(req.params.id);
  res.json(v);
});

// DELETE /api/vehicles/:id  – admin only
app.delete('/api/vehicles/:id', authMiddleware, adminOnly, (req, res) => {
  const r = db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Data tidak ditemukan' });
  res.json({ ok: true });
});

// GET /api/vehicles/:id/photo  – returns full-size photo for lightbox
app.get('/api/vehicles/:id/photo', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT foto_data FROM vehicles WHERE id = ?').get(req.params.id);
  if (!r || !r.foto_data) return res.status(404).json({ error: 'Foto tidak ditemukan' });
  res.json({ foto_data: r.foto_data });
});

// ─── ROUTES: STATS ───────────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', authMiddleware, adminOnly, (req, res) => {
  const today     = new Date().toISOString().slice(0, 10);
  const monthPfx  = today.slice(0, 7);
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  res.json({
    total:        db.prepare('SELECT COUNT(*) c FROM vehicles').get().c,
    today:        db.prepare("SELECT COUNT(*) c FROM vehicles WHERE DATE(timestamp,'localtime')=?").get(today).c,
    minggu:       db.prepare("SELECT COUNT(*) c FROM vehicles WHERE DATE(timestamp,'localtime')>=?").get(weekStart).c,
    bulan:        db.prepare("SELECT COUNT(*) c FROM vehicles WHERE timestamp LIKE ?").get(monthPfx + '%').c,
    pribadi:      db.prepare("SELECT COUNT(*) c FROM vehicles WHERE tipe='pribadi'").get().c,
    taxi:         db.prepare("SELECT COUNT(*) c FROM vehicles WHERE tipe='taxi'").get().c,
    listrik:      db.prepare("SELECT COUNT(*) c FROM vehicles WHERE jenis='listrik'").get().c,
    konvensional: db.prepare("SELECT COUNT(*) c FROM vehicles WHERE jenis='konvensional'").get().c,
  });
});

// ─── ROUTES: USERS ───────────────────────────────────────────────────────────

// GET /api/users  – admin only
app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id,username,role,is_protected,created_at FROM users').all();
  res.json(users.map(u => ({ ...u, protected: !!u.is_protected })));
});

// POST /api/users  – admin only
app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password } = req.body || {};
  if (!username?.trim() || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim()))
    return res.status(400).json({ error: 'Username sudah digunakan' });

  const id = uid();
  db.prepare('INSERT INTO users (id,username,password,role,is_protected,created_at) VALUES (?,?,?,?,?,?)').run(
    id, username.trim(), password, 'user', 0, new Date().toISOString()
  );
  const u = db.prepare('SELECT id,username,role,is_protected,created_at FROM users WHERE id = ?').get(id);
  res.status(201).json({ ...u, protected: false });
});

// PUT /api/users/:id  – admin only (change password)
app.put('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password wajib diisi' });

  const r = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ ok: true });
});

// DELETE /api/users/:id  – admin only
app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  const u = db.prepare('SELECT is_protected FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (u.is_protected) return res.status(403).json({ error: 'User ini tidak dapat dihapus (terlindungi)' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ROUTES: SESSIONS ────────────────────────────────────────────────────────

// GET /api/sessions  – admin only
app.get('/api/sessions', authMiddleware, adminOnly, (req, res) => {
  const sessions = db.prepare('SELECT username, login_at, role FROM sessions').all();
  res.json(sessions);
});

// ─── ROUTES: EXPORT / IMPORT ─────────────────────────────────────────────────

// GET /api/export  – includes foto_data for backup
app.get('/api/export', authMiddleware, adminOnly, (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY timestamp DESC').all();
  res.json({
    version:    3,
    exportedAt: new Date().toISOString(),
    vehicles,
  });
});

// POST /api/import  – restore entire database
app.post('/api/import', authMiddleware, adminOnly, (req, res) => {
  const { vehicles } = req.body || {};
  if (!Array.isArray(vehicles))
    return res.status(400).json({ error: 'Format file tidak valid. Pastikan file berisi array vehicles.' });

  const ins = db.prepare(`
    INSERT OR REPLACE INTO vehicles
      (id,tipe,jenis,plat,merk,warna,tujuan,lambung,perusahaan,has_foto,thumb_data,foto_data,petugas,timestamp)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    db.prepare('DELETE FROM vehicles').run();
    for (const v of vehicles) {
      ins.run(
        v.id, v.tipe, v.jenis || null,
        v.plat || null, v.merk || null, v.warna || null, v.tujuan || null,
        v.lambung || null, v.perusahaan || null,
        v.has_foto || (v.hasFoto ? 1 : 0),
        v.thumb_data || null,
        v.foto_data || null,
        v.petugas,
        v.timestamp
      );
    }
  })();

  res.json({ ok: true, count: vehicles.length });
});

// ─── CATCH-ALL: SERVE FRONTEND ───────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not found. Place index.html in ../frontend/' });
  }
});

// ─── START SERVER ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏨  MERUSAKA Security System`);
  console.log(`📡  Backend running → http://localhost:${PORT}`);
  console.log(`💾  Database: ${DB_PATH}`);
  console.log(`\n   Default login: admin / admin`);
  console.log(`   Default user:  user1 / user123\n`);
});
