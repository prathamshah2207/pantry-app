'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
//const cors = require('cors');

const HOST = '0.0.0.0';
const PORT = 80;

const app = express();
const fsPromises = fs.promises;

const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_FILE = path.join(__dirname, 'data', "user.json");
const INV_DATA_FILE = path.join(__dirname, 'data', 'inv.json');

/* ########### NEED DATA FOLDER OR IT WILL CRASH */
if (!fs.existsSync(DATA_DIR))
	fs.mkdirSync(DATA_DIR);


/* --------------------
   NEW: server HTML
--------------------- */
app.use(express.static('inventory'));
app.use(express.static('user'))
app.use(express.static('public'))
app.use(express.static('recipe-app'))
app.use(express.json());
app.use(bodyParser.json());
//app.use(cors());
//tells Express to serve static files (HTML, CSS, images, client-side JS)
// from a folder called public.
/*****
 * 
 * This HTML page lives on the server.
   Clicking a link sends a request.”
   The server runs JavaScript and sends a response.
 */

app.get('/', (req,res) => {
    res.sendFile("public/index.html", {root: __dirname});
});


/**
 * *****************************************************************
 * 						INVENTORY	API
 * *****************************************************************
 */

const INGRED_FILE = path.join(__dirname, 'inventory', 'data', 'ingred.json');

app.get('/api/ingredients', async (req, res) => {
    try {
        const data = await fsPromises.readFile(INGRED_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Failed to load ingredients' });
    }
});

app.get('/api/getmsg', async (req, res) => {
    try {

        const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        res.json(items);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: 'Failed to read messages' });

    }
})

app.post('/api/sendmsg', async (req, res) => {
    const { quant, name, cals, defa, unit } = req.body;

    try {

        const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const entry = {
            id: Date.now(),
            quant,
            name,
            cals,
            defa,
            unit
        };

        items.push(entry);

        await fsPromises.writeFile(INV_DATA_FILE, JSON.stringify(items, null, 2));

        res.send('Saved');

    } catch (err) {

        res.status(500).send('Write failed');

    }
});

app.post('/api/editmsg', async (req, res) => {

    const { id, quant, name, cals, defa } = req.body;

    try {

        const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const updated = items.map(item =>
            item.id == id
                ? { id, quant, name, cals, defa, unit }
                : item
        );

        await fsPromises.writeFile(INV_DATA_FILE, JSON.stringify(updated, null, 2));

        res.send('Edited');

    } catch (err) {

        res.status(500).send('Edit failed');

    }
});

app.post('/api/resetmsg', async (req, res) => {

    const { id } = req.body;

    try {

        const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const updated = items.map(item => {
            if (item.id == id) {
                item.quant = item.defa;
            }
            return item;
        });

        await fsPromises.writeFile(INV_DATA_FILE, JSON.stringify(updated, null, 2));

        res.send('Reset');

    } catch (err) {

        res.status(500).send('Reset failed');

    }

});

app.post('/api/deletemsg', async (req, res) => {

    const { id } = req.body;

    try {

        const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
        const items = JSON.parse(data);

        const filtered = items.filter(item => item.id != id);

        await fsPromises.writeFile(INV_DATA_FILE, JSON.stringify(filtered, null, 2));

        res.send('Deleted');

    } catch (err) {

        res.status(500).send('Delete failed');

    }

});

app.get('/gp', (req,res) => {
    res.json(INV_DATA_FILE);
});

/*#########			END OF INVENTORY API		############*/


/**
 * ***************************************************************
 *					 		USER	API
 * ***************************************************************
 */

app.get("/user", (req, res) => {
	try {
		if (!fs.existsSync(USER_DATA_FILE)) {
			return res.json({ exists: false, user: null });
		}

		const fileData = fs.readFileSync(USER_DATA_FILE, "utf8");

		if (!fileData || fileData === "null") {
			return res.json({ exists: false, user: null });
		}

		const user = JSON.parse(fileData);

		res.json({
			exists: true,
			user
		});
	}
	catch (error) {
		res.status(500).json({ message: "Error reading user data" });
	}
});

app.post("/user", (req, res) => {
	const { name, username, email, password, dietPreference, allowSubstitutions } = req.body;

	if (!name || !username || !password) {
		return res.status(400).json({
			message: "Name, username, and password are required"
		});
	}
	
	if (!fs.existsSync(USER_DATA_FILE)) {
/////////////////		NEW USER CREATION ALSO CREATES EMPTY INV FILE
		fs.writeFileSync(USER_DATA_FILE, "null");
		fs.writeFileSync(INV_DATA_FILE, "[]")
	}

	// const existingData = fs.readFileSync(USER_DATA_FILE, "utf8");
	// if (existingData && existingData !== "null") {
	// 	return res.status(409).json({
	// 		message: "User profile already exists on this device"
	// 	});
	// }

	const newUser = {
		name,
		username,
		email: email || "",
		password,
		dietPreference: dietPreference || "",
		allowSubstitutions: allowSubstitutions ?? true
	};

	fs.writeFileSync(USER_DATA_FILE, JSON.stringify(newUser, null, 2));

	res.status(201).json({
		message: "User profile created successfully",
		user: newUser
	});
});

app.put("/user", (req, res) => {
	try {
		if (!fs.existsSync(USER_DATA_FILE)) {
			return res.status(404).json({
				message: "No user profile found"
			});
		}

		const fileData = fs.readFileSync(USER_DATA_FILE, "utf8");

		if (!fileData || fileData === "null") {
			return res.status(404).json({
				message: "No user profile found"
			});
		}

		const existingUser = JSON.parse(fileData);
		const { name, email, dietPreference } = req.body;

		const updatedUser = {
			...existingUser,
			name: name ?? existingUser.name,
			email: email ?? existingUser.email,
			dietPreference: dietPreference ?? existingUser.dietPreference
		};

		fs.writeFileSync(USER_DATA_FILE, JSON.stringify(updatedUser, null, 2));

		res.json({
			message: "User profile updated successfully",
			user: updatedUser
		});
	}
	catch (error) {
		res.status(500).json({
			message: "Error updating user profile"
		});
	}
});

/*#########			END OF USER API			############*/


app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PORT} by host ${HOST}`);
});
