require('dotenv').config();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
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
app.use(cookieParser());

// Middleware
app.use(function (req, res, next) {
  res.locals.errors = [];

  // Check for JWT cookie
  try {
    const decoded = jwt.verify(req.cookies.BlogLiteUser, process.env.JWTSECRET);
    req.user = decoded;
  } catch (e) {
    // Invalid token
    req.user = false;
  }

  res.locals.user = req.user;
  console.log(req.user);

  next();
});

// Homepage route
app.get('/', (req, res) => {

  if (req.user) {
    return res.render('dashboard');
  }

  res.render('homepage');
});

// Logout route
app.get('/logout', (req, res) => {
  res.clearCookie('BlogLiteUser');
  res.redirect('/');
});

// Login route
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  let errors = [];

  if (typeof req.body.username !== 'string') req.body.username = '';
  if (typeof req.body.password !== 'string') req.body.password = '';

  if (req.body.username.trim() === '') errors = ['Invalid username or password'];
  if (req.body.password === '') errors = ['Invalid username or password'];

  if (errors.length) { // if there are errors, return early
    return res.render('login', { errors });
  }

  const statement = db.prepare("SELECT * FROM users WHERE USERNAME = ?");
  const user = statement.get(req.body.username);

  if (!user) {
    errors = ['Invalid username or password'];
    return res.render('login', { errors });
  }

  const match = bcrypt.compareSync(req.body.password, user.password);
  if (!match) {
    errors = ['Invalid username or password'];
    return res.render('login', { errors });
  }

  const token = jwt.sign( // Expires in 24 hours
    { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, userid: user.id, username: user.username },
    process.env.JWTSECRET
  );

  res.cookie('BlogLiteUser', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  });

  res.redirect('/');

});

// Registration route
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

  if (errors.length) { // if there are errors, return early
    return res.render('homepage', { errors });
  }
    
  const salt = bcrypt.genSaltSync(10);
  req.body.password = bcrypt.hashSync(req.body.password, salt);

  const statement = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
  const result = statement.run(req.body.username, req.body.password);

  const lookupStatement = db.prepare("SELECT * FROM users WHERE ROWID = ?");
  const ourUser = lookupStatement.get(result.lastInsertRowid);

  const token = jwt.sign( // Expires in 24 hours
    { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, userid: ourUser.id, username: ourUser.username },
    process.env.JWTSECRET
  );

  res.cookie('BlogLiteUser', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  });


  res.send('Registration successful');
});

app.listen(3000);