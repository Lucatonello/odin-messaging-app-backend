const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('./users');

router.get('/', verifyToken, async (req, res) => {
    const senderid = req.user.id;

    const contacts = await pool.query(`
        SELECT users.id, users.username FROM users
        JOIN messages ON users.id = messages.recieverid
        WHERE messages.senderid = $1
        UNION
        SELECT users.id, users.username FROM users
        JOIN messages ON users.id = messages.senderid
        WHERE messages.recieverid = $1
    `, [senderid]);

    res.json(contacts.rows);
})

module.exports = router;