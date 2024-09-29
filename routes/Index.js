const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('./users');

router.get('/', verifyToken, async (req, res) => {
    const senderid = req.user.id;

    const contacts = await pool.query(`
        SELECT DISTINCT users.id, users.username FROM users
        JOIN messages ON users.id = messages.recieverid
        WHERE messages.senderid = $1
        UNION
        SELECT users.id, users.username FROM users
        JOIN messages ON users.id = messages.senderid
        WHERE messages.recieverid = $1
    `, [senderid]);

    res.json(contacts.rows);
});

router.get('/chat/:contactid', verifyToken, async (req, res) => {
    const contactId = req.params.contactid;
    const userId = req.user.id;

    try {
        const chat = await pool.query(`
            SELECT messages.id, messages.text, messages.sentat, users.username, users.id AS sender_id FROM messages
            JOIN users ON messages.senderid = users.id
            WHERE (messages.senderid = $1 AND messages.recieverid = $2)
            OR (messages.senderid = $2 AND messages.recieverid = $1)
            ORDER BY messages.sentat
        `, [userId, contactId]);
        
        res.json(chat.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });;
    }
});


router.post('/newMessage/:senderid/:recieverid', verifyToken, async (req, res) => {
    const newMessage = req.body.newMessage;
    const senderid = req.params.senderid;
    const recieverid = req.params.recieverid;

    try {
        await pool.query(`
            INSERT INTO messages 
            (text, senderid, recieverid)
            VALUES ($1, $2, $3)
        `, [newMessage, senderid, recieverid]);

    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' });;
    }
   
});
module.exports = router;

router.get('/profiles/:id', verifyToken, async (req, res) => {
    const userid = req.params.id;
    try {
        const result = await pool.query(`
            SELECT username, bio, profilepic, joindate, number 
            FROM users
            WHERE id = $1
        `, [userid]);
        
        res.send(result.rows);
    } catch (err) {
        console.log(err);
    }
});