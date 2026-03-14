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
app.use(express.static('inventory')); 
app.use(express.json());
//tells Express to serve static files (HTML, CSS, images, client-side JS)
// from a folder called public.
/*****
 * 
 * This HTML page lives on the server.
   Clicking a link sends a request.”
   The server runs JavaScript and sends a response.
 */


/********
 * TODO: NOTE ON THE DATAFILE:
 * when we make the uers, when a new account is made, have a new inv json file made initialized with []. this will cover it well.
 */

const DATA_FILE = path.join(__dirname, 'data', 'posts.json');

app.get('/', (req,res) => {
    res.sendFile("inventory/invpage.html", {root: __dirname});
});




// app.get('/api/styles', (req,res) => {
//     res.sendFile("public/styles.css", {root: __dirname});
// });
// app.get('/api/newpost', (req,res) => {
//     res.sendFile("public/newpost.html", {root: __dirname});
// });

app.get('/api/getmsg', async (req, res) => {
    try {

        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        res.json(items);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: 'Failed to read messages' });

    }
})

app.post('/api/sendmsg', async (req, res) => {
    const { quant, name, cals, defa } = req.body;

    try {

        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const entry = {
            id: Date.now(),
            quant,
            name,
            cals,
            defa
        };

        items.push(entry);

        await fsPromises.writeFile(DATA_FILE, JSON.stringify(items, null, 2));

        res.send('Saved');

    } catch (err) {

        res.status(500).send('Write failed');

    }
});

app.post('/api/editmsg', async (req, res) => {

    const { id, quant, name, cals, defa } = req.body;

    try {

        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const updated = items.map(item =>
            item.id == id
                ? { id, quant, name, cals, defa }
                : item
        );

        await fsPromises.writeFile(DATA_FILE, JSON.stringify(updated, null, 2));

        res.send('Edited');

    } catch (err) {

        res.status(500).send('Edit failed');

    }
});

app.post('/api/resetmsg', async (req, res) => {

    const { id } = req.body;

    try {

        const data = await fsPromises.readFile(DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const updated = items.map(item => {
            if (item.id == id) {
                item.quant = item.defa;
            }
            return item;
        });

        await fsPromises.writeFile(DATA_FILE, JSON.stringify(updated, null, 2));

        res.send('Reset');

    } catch (err) {

        res.status(500).send('Reset failed');

    }

});

app.get('/gp', (req,res) => {
    res.json(DATA_FILE);
});

app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PORT} by host ${HOST}`);
});