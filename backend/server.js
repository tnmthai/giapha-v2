const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'giapha-secret-key-2024';

// PostgreSQL connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:giapha2024@postgres.railway.internal:5432/railway';
const pool = new Pool({ connectionString: DATABASE_URL });

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
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS family_members (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name VARCHAR(100) NOT NULL,
      birth_year INTEGER,
      death_year INTEGER,
      gender VARCHAR(10),
      occupation VARCHAR(100),
      generation INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS relationships (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      from_id INTEGER REFERENCES family_members(id),
      to_id INTEGER REFERENCES family_members(id),
      type VARCHAR(50) NOT NULL,
      label VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
}

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, password, full_name } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, full_name) VALUES ($1, $2, $3) RETURNING id, username, full_name',
      [username, hash, full_name]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
    res.json({ user, token });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
  res.json({ user: { id: user.id, username: user.username, full_name: user.full_name }, token });
});

// Family members routes
app.get('/api/members', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM family_members WHERE user_id = $1', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/members', auth, async (req, res) => {
  const { name, birth_year, death_year, gender, occupation, generation, notes } = req.body;
  const result = await pool.query(
    'INSERT INTO family_members (user_id, name, birth_year, death_year, gender, occupation, generation, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [req.user.id, name, birth_year, death_year, gender, occupation, generation || 0, notes]
  );
  res.json(result.rows[0]);
});

app.put('/api/members/:id', auth, async (req, res) => {
  const { name, birth_year, death_year, gender, occupation, generation, notes } = req.body;
  const result = await pool.query(
    'UPDATE family_members SET name=$1, birth_year=$2, death_year=$3, gender=$4, occupation=$5, generation=$6, notes=$7 WHERE id=$8 AND user_id=$9 RETURNING *',
    [name, birth_year, death_year, gender, occupation, generation, notes, req.params.id, req.user.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/members/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM relationships WHERE (from_id=$1 OR to_id=$1) AND user_id=$2', [req.params.id, req.user.id]);
  await pool.query('DELETE FROM family_members WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// Relationships routes
app.get('/api/relationships', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM relationships WHERE user_id = $1', [req.user.id]);
  res.json(result.rows);
});

app.post('/api/relationships', auth, async (req, res) => {
  const { from_id, to_id, type, label } = req.body;
  const result = await pool.query(
    'INSERT INTO relationships (user_id, from_id, to_id, type, label) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [req.user.id, from_id, to_id, type, label]
  );
  res.json(result.rows[0]);
});

app.put('/api/relationships/:id', auth, async (req, res) => {
  const { label, type } = req.body;
  const result = await pool.query(
    'UPDATE relationships SET label=$1, type=$2 WHERE id=$3 AND user_id=$4 RETURNING *',
    [label, type, req.params.id, req.user.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/relationships/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM relationships WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
