const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { verifyToken } = require('./users');

router.get('/', verifyToken, async (req, res) => {
    const senderid = req.user.id;

    const contacts = await pool.query(`
        WITH combined_messages AS (
        SELECT 
            users.id, 
            users.username, 
            users.profilepic, 
            sender.profilepic AS sender_profilepic, 
            MAX(messages.sentat) AS last_interaction
        FROM users
        JOIN messages ON users.id = messages.recieverid
        JOIN users AS sender ON sender.id = messages.senderid
        WHERE messages.senderid = $1
        GROUP BY users.id, users.username, users.profilepic, sender.profilepic

        UNION ALL

        SELECT 
            users.id, 
            users.username, 
            users.profilepic, 
            sender.profilepic AS sender_profilepic, 
            MAX(messages.sentat) AS last_interaction
        FROM users
        JOIN messages ON users.id = messages.senderid
        JOIN users AS sender ON sender.id = messages.recieverid
        WHERE messages.recieverid = $1
        GROUP BY users.id, users.username, users.profilepic, sender.profilepic
    )
    SELECT *
    FROM (
        SELECT 
            id, 
            username, 
            profilepic, 
            sender_profilepic, 
            last_interaction,
            ROW_NUMBER() OVER (PARTITION BY id ORDER BY last_interaction DESC) AS rn
        FROM combined_messages
    ) AS ranked_messages
    WHERE rn = 1
    ORDER BY last_interaction DESC;


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

        res.json({ isDone: true });

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
        console.error(err);
    }
});

router.post('/getReceiverId', verifyToken, async (req, res) => {
    const receiverName = req.body.receiver;
    console.log('receiverName', receiverName);
    try {
        const result = await pool.query(`SELECT id FROM users WHERE username = $1`, [receiverName]);
        console.log('result rows', result.rows);
        const receiverId = result.rows[0].id;
        res.json({ id: receiverId, isDone: true });
    } catch (err) {
        console.error(err);
    }
   
});

router.put('/editData/:id', verifyToken, upload.single('pfp'), async (req, res) => {
    const id = req.params.id;
    const type = req.body.type;
    const newData = req.body.newData;
    const file = req.file

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
        } else if (type == 'pfp') {
            const profilePicPath = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`

            await pool.query(`
                UPDATE users
                SET profilepic = $1
                WHERE id = $2
            `, [profilePicPath, id]);

            res.json({ message: 'pfp updated', profilePicPath, isDone: true });
        } else {
            res.status(400).json({ error: 'type of change not valid' });
        }
    } catch (err) {
        console.error(err)
    }
});

router.get('/getUsers', async (req, res)  => {
    const users = await pool.query('SELECT id, username FROM users');
    res.json(users.rows);
});

router.post('/createGroupChat/:id', verifyToken, async (req, res) => {
    const name = req.body.name;
    const description = req.body.description;
    const members = req.body.members;
    let adminUsername;

    try {
        const result = await pool.query('SELECT username FROM users WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            res.status(500).json({ message: 'Error getting admin username' });
        }

        adminUsername = result.rows[0].username;
        members.push(adminUsername);
  
      await pool.query(`
          INSERT into groupchats
          (name, description, members, admin)
          VALUES ($1, $2, $3, $4)    
      `, [name, description, members, adminUsername]);

      res.json({ message: 'group chat created succesfully', isDone: true })
    } catch(err) {
        console.error(err)
        res.status(500).json({ message: 'Error creating groupchat' });
    }
});

router.get('/getUserGroupChats/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    let username;
    try {
        const getUsername = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
        if (getUsername) {
            username = getUsername.rows[0].username;
        }

        const result = await pool.query(`
            SELECT 
                gc.id, 
                gc.name, 
                gc.description, 
                gc.members, 
                gc.admin, 
                array_agg(u.profilepic ORDER BY array_position(gc.members, u.username)) AS profilepics,
                array_agg(u.username ORDER BY array_position(gc.members, u.username)) AS usernames
            FROM groupchats gc
            JOIN unnest(gc.members) AS member ON true
            JOIN users u ON u.username = member
            WHERE $1 = ANY(gc.members)
            GROUP BY gc.id, gc.name, gc.description, gc.members, gc.admin
        `, [username]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching group chats' });
    }
});

router.get('/groupChat/:id', verifyToken, async (req, res) => {
    const id = req.params.id;

    try {
        const result = await pool.query(`
            SELECT gcm.*, u.username 
            FROM groupChatMessages gcm
            JOIN users u ON gcm.senderid = u.id
            WHERE groupchatid = $1    
        `, [id]);

        res.json(result.rows)
    } catch (err) {
        console.error(err);
        res.status(500).json('Error getting group data'); 
    }
});

router.post('/newGroupChatMessage/:id', verifyToken, async (req, res) => {
    const groupId = req.params.id;
    const newMessage = req.body.newMessage;
    const userId = req.body.userId;

    try {
        await pool.query(`
            INSERT INTO groupChatMessages
            (text, senderid, groupchatid)
            VALUES ($1, $2, $3)    
        `, [newMessage, userId, groupId]);

        res.json({ isDone: true })
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'error inserting message in database' })
    }
});

router.get('/groupChatInfo/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query(`
            SELECT 
                gc.id, 
                gc.name, 
                gc.description, 
                gc.members, 
                gc.admin, 
                array_agg(u.profilepic ORDER BY array_position(gc.members, u.username)) AS profilepics,
                array_agg(u.username ORDER BY array_position(gc.members, u.username)) AS usernames,
                array_agg(u.id ORDER BY array_position(gc.members, u.username)) AS ids
            FROM groupchats gc
            JOIN unnest(gc.members) AS member ON true
            JOIN users u ON u.username = member
            WHERE gc.id = $1
            GROUP BY gc.id, gc.name, gc.description, gc.members, gc.admin
        `, [id]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching metadata' });
    }
});

router.put('/editGroupData/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const type = req.body.type;
    const newData = req.body.newData;

    try {
        if (type == 'name') {
            await pool.query(`
                UPDATE groupchats
                SET name = $1
                WHERE id = $2
            `, [newData, id])
        } else if (type == 'description') {
            await pool.query(`
                UPDATE groupchats
                SET description = $1
                WHERE id = $2
            `, [newData, id])
        } else {
            res.status(400).json({ error: 'type of change not valid' });
        }
    } catch (err) {
        console.error(err)
    }
});

router.put('/deleteGroupMember/:id/:member', verifyToken, async (req, res) => {
    const member = req.params.member;
    const id = req.params.id
    try {
        await pool.query(`
            UPDATE groupchats
            SET members = array_remove(members, $1)
            WHERE id = $2
        `, [member, id])
    } catch (err) {
        console.error(err)
    }
});

module.exports = router;
