const express = require('express');
const path = require('path')
const app = express();
const { Pool } = require('pg');
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const router = require('./routes/Index');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

app.listen(PORT, () => console.log('server running on port', PORT));

module.exports = app;