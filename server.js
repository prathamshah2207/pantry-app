'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const HOST = '0.0.0.0';
const PORT = 80;

const app = express();
const fsPromises = fs.promises;


/* --------------------
   NEW: server HTML
--------------------- */
app.use(express.static('public')); 
app.use(express.json());
//tells Express to serve static files (HTML, CSS, images, client-side JS)
// from a folder called public.
/*****
 * 
 * This HTML page lives on the server.
   Clicking a link sends a request.”
   The server runs JavaScript and sends a response.
 */

const DATA_FILE = path.join(__dirname, 'data', 'posts.json');

app.get('/api/posts', (req,res) => {
    res.sendFile("public/posts.html", {root: __dirname});
});
app.get('/api/styles', (req,res) => {
    res.sendFile("public/styles.css", {root: __dirname});
});
app.get('/api/newpost', (req,res) => {
    res.sendFile("public/newpost.html", {root: __dirname});
});

app.get('/api/getmsg', async (req, res) => {
    try {
        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const messages = lines.map(line => JSON.parse(line));

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read messages' });
    }
})

app.post('/api/sendmsg', async (req, res) => {
    const {topic, message, date} = req.body;

    try {
        // await pauses THIS function, not the server

        const entry = {topic, message, date};
        await fsPromises.appendFile(DATA_FILE, JSON.stringify(entry) + '\n');

        res.send('Async/Await: saved!');
    } catch (err) {
        res.status(500).send('Async/Await: write failed');
    }
});

app.get('/gp', (req,res) => {
    res.json(DATA_FILE);
});

app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PORT} by host ${HOST}`);
});