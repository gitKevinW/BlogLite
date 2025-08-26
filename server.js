require('dotenv').config();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const express = require('express');
const db = require('better-sqlite3')('BlogLite.db');
db.pragma("journal_mode = WAL");

const createTables = db.transaction(() => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username string NOT NULL UNIQUE,
      password string NOT NULL
    )
    `
  ).run()
})

createTables();

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(function (req, res, next) {
  res.locals.errors = [];
  next();
});

app.get('/', (req, res) => {
  res.render('homepage');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/register', (req, res) => {
  const errors = [];

  if (typeof req.body.username !== 'string') req.body.username = '';
  if (typeof req.body.password !== 'string') req.body.password = '';

  req.body.username = req.body.username.trim();

  if (!req.body.username) errors.push('Username is required');
  if (req.body.username && req.body.username.length < 3) errors.push('Username must be at least 3 characters long');
  if (req.body.username && req.body.username.length > 10) errors.push('Username cannot exceed 10 characters');
  if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push('Username can only contain letters and numbers');

  if (!req.body.password) errors.push('Password is required');
  if (req.body.password && req.body.password.length < 8) errors.push('Password must be at least 8 characters long');
  if (req.body.password && req.body.password.length > 20) errors.push('Password cannot exceed 20 characters');

  if (errors.length) {
    return res.render('homepage', { errors });
  }
    
  const salt = bcrypt.genSaltSync(10);
  req.body.password = bcrypt.hashSync(req.body.password, salt);

  const statement = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
  const result = statement.run(req.body.username, req.body.password);

  const lookupStatement = db.prepare("SELECT * FROM users WHERE ROWID = ?");
  const ourUser = lookupStatement.get(result.lastInsertRowid);

  const token = jwt.sign(
    { username: req.body.username },
    process.env.JWT_SECRET
  );

  res.cookie('BlogLiteUser', req.body.username, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  });


  res.send('Registration successful');
});

app.listen(3000);