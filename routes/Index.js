const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('./users');

router.get('/', verifyToken, async (req, res) => {
    const senderid = req.user.id;

    const contacts = await pool.query(`
        SELECT DISTINCT 
        users.id, 
        users.username, 
        users.profilepic, 
        sender.profilepic AS sender_profilepic
        FROM users
        JOIN messages ON users.id = messages.recieverid
        JOIN users AS sender ON sender.id = messages.senderid
        WHERE messages.senderid = $1

        UNION

        SELECT 
        users.id, 
        users.username, 
        users.profilepic, 
        sender.profilepic AS sender_profilepic
        FROM users
        JOIN messages ON users.id = messages.senderid
        JOIN users AS sender ON sender.id = messages.recieverid
        WHERE messages.recieverid = $1;

    `, [senderid]);

    const currentUserProfile = await pool.query(
        `SELECT id, username, profilepic FROM users WHERE id = $1`, [senderid]
    );

    res.json({
        contacts: contacts.rows,
        currentUser: currentUserProfile.rows[0] 
    });
});

router.get('/chat/:contactid', verifyToken, async (req, res) => {
    const contactId = req.params.contactid;
    const userId = req.user.id;

    try {
        const chat = await pool.query(`
            SELECT 
                messages.id, 
                messages.text, 
                messages.sentat,  
                sender.username AS sender_username, 
                sender.profilepic AS sender_profilepic,
                receiver.username AS receiver_username, 
                receiver.profilepic AS receiver_profilepic,
                messages.senderid, 
                messages.recieverid
            FROM messages
            JOIN users AS sender ON messages.senderid = sender.id
            JOIN users AS receiver ON messages.recieverid = receiver.id
            WHERE (messages.senderid = $1 AND messages.recieverid = $2)
            OR (messages.senderid = $2 AND messages.recieverid = $1)
            ORDER BY messages.sentat;

        `, [userId, contactId]);
        
        res.json(chat.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });;
    }
});


router.post('/newMessage/:senderid/:receiverid', verifyToken, async (req, res) => {
    const newMessage = req.body.newMessage;
    const senderid = req.params.senderid;
    const receiverid = req.params.receiverid;

    try {
        await pool.query(`
            INSERT INTO messages 
            (text, senderid, recieverid)
            VALUES ($1, $2, $3)
        `, [newMessage, senderid, receiverid]);

    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' });;
    }
   
});

router.get('/profiles/:id', verifyToken, async (req, res) => {
    const userid = req.params.id;
    try {
        const result = await pool.query(`
            SELECT username, bio, profilepic, joindate 
            FROM users
            WHERE id = $1
        `, [userid]);
        
        res.send(result.rows);
    } catch (err) {
        console.log(err);
    }
});

router.post('/getReceiverId', verifyToken, async (req, res) => {
    const receiverName = req.body.receiver;
    try {
        const result = await pool.query(`SELECT id FROM users WHERE username = $1`, [receiverName]);
        const receiverId = result.rows[0].id;
        res.json({ id: receiverId });
    } catch (err) {
        console.error(err);
    }
   
});

router.put('/editData/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const type = req.body.type;
    const newData = req.body.newData;

    try {
        if (type == 'username') {
            await pool.query(`
                UPDATE users
                SET username = $1
                WHERE id = $2
            `, [newData, id])
        } else if (type == 'bio') {
            await pool.query(`
                UPDATE users
                SET bio = $1
                WHERE id = $2
            `, [newData, id])
        }
    } catch (err) {
        console.error(err)
    }
});

router.get('/getUsers', async (req, res)  => {
    const users = await pool.query('SELECT id, username FROM users');
    res.json(users.rows);
});

module.exports = router;
