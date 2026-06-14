const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'giapha-secret-key-2024';

// SQLite database
const db = new Database('/tmp/giapha.db');
db.pragma('journal_mode = WAL');

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Initialize database
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      birth_year INTEGER,
      death_year INTEGER,
      gender TEXT,
      occupation TEXT,
      generation INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      from_id INTEGER REFERENCES family_members(id),
      to_id INTEGER REFERENCES family_members(id),
      type TEXT NOT NULL,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database initialized');
}

// Auth routes
app.post('/api/register', (req, res) => {
  const { username, password, full_name } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)');
    const result = stmt.run(username, hash, full_name);
    const user = { id: result.lastInsertRowid, username, full_name };
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
    res.json({ user, token });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
  res.json({ user: { id: user.id, username: user.username, full_name: user.full_name }, token });
});

// Family members
app.get('/api/members', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM family_members WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

app.post('/api/members', auth, (req, res) => {
  const { name, birth_year, death_year, gender, occupation, generation, notes } = req.body;
  const stmt = db.prepare('INSERT INTO family_members (user_id, name, birth_year, death_year, gender, occupation, generation, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(req.user.id, name, birth_year, death_year, gender, occupation, generation || 0, notes);
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(result.lastInsertRowid);
  res.json(member);
});

app.put('/api/members/:id', auth, (req, res) => {
  const { name, birth_year, death_year, gender, occupation, generation, notes } = req.body;
  db.prepare('UPDATE family_members SET name=?, birth_year=?, death_year=?, gender=?, occupation=?, generation=?, notes=? WHERE id=? AND user_id=?')
    .run(name, birth_year, death_year, gender, occupation, generation, notes, req.params.id, req.user.id);
  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id);
  res.json(member);
});

app.delete('/api/members/:id', auth, (req, res) => {
  db.prepare('DELETE FROM relationships WHERE (from_id=? OR to_id=?) AND user_id=?').run(req.params.id, req.params.id, req.user.id);
  db.prepare('DELETE FROM family_members WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Relationships
app.get('/api/relationships', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM relationships WHERE user_id = ?').all(req.user.id);
  res.json(rows);
});

app.post('/api/relationships', auth, (req, res) => {
  const { from_id, to_id, type, label } = req.body;
  const stmt = db.prepare('INSERT INTO relationships (user_id, from_id, to_id, type, label) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(req.user.id, from_id, to_id, type, label);
  const rel = db.prepare('SELECT * FROM relationships WHERE id = ?').get(result.lastInsertRowid);
  res.json(rel);
});

app.put('/api/relationships/:id', auth, (req, res) => {
  const { label, type } = req.body;
  db.prepare('UPDATE relationships SET label=?, type=? WHERE id=? AND user_id=?')
    .run(label, type, req.params.id, req.user.id);
  const rel = db.prepare('SELECT * FROM relationships WHERE id = ?').get(req.params.id);
  res.json(rel);
});

app.delete('/api/relationships/:id', auth, (req, res) => {
  db.prepare('DELETE FROM relationships WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start
initDB();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
