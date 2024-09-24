const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(500).send('Invalid credentials');
        };

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send('Invalid credentials');
        }

        jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, (err, token) => {
            if (err) {
                console.log(err);
                return res.status(500).send('error with JWT');
            }
            res.json({
                token: token,
                authorid: user.id
            });
        });

    } catch (err) {
        console.error(err); 
        return res.status(500).send('Error loging in');
    }
});

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== 'undefined') {
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];
        req.token = bearerToken;
        
        jwt.verify(bearerToken, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        return res.status(403).send('Forbidden');
    }
}

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!password) {
        console.log('Password is indeed undefined. Username: ', username);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            return res.status(400).send('Username already exists');
        }

        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ message: 'Cool, now log in' });

    } catch (err) {
        console.log(err);
        return res.status(500).send('error creating user');
    }
});

module.exports = { router, verifyToken };