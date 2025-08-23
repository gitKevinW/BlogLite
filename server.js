const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello world from our cool app');
});

app.listen(3000);