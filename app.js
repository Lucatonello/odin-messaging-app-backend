const express = require('express');
const path = require('path')
const app = express();
const { Pool } = require('pg');
const cors = require('cors');
const PORT = process.env.PORT || 10000;
const indexRoute = require('./routes/index');
const { router } = require('./routes/users');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/users', router);
app.use('/', indexRoute);

app.listen(PORT, () => console.log('server running on port', PORT));
