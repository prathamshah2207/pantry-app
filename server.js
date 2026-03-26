'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
// const cors = require("cors");
const mysql = require("mysql2/promise");

const HOST = '0.0.0.0';
const PORT = 80;

const app = express();
const fsPromises = fs.promises;

const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_FILE = path.join(__dirname, 'data', "user.json");
const INV_DATA_FILE = path.join(__dirname, 'data', 'inv.json');

const db = mysql.createPool({
	host: 'db',
	user: 'root',
	password: 'root',
	database: 'pantry_app',
	waitForConnections: true
})

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
	const { quant, name, cals, defa } = req.body;

	try {

		const data = await fsPromises.readFile(INV_DATA_FILE, 'utf8');
		const items = JSON.parse(data);

		const entry = {
			id: Date.now(),
			quant,
			name,
			cals,
			defa
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
				? { id, quant, name, cals, defa }
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

app.get("/user", async (req, res) => {
	try {
		if (!fs.existsSync(USER_DATA_FILE)) 
			return res.json({
				exists: false,
				user: null
			});
		const session = JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf8"));
		const [rows] = await db.query(`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`, 
			[session.userId]
		);
		if (rows.length === 0) {
			return res.json({
				exists: false,
				user: null
			});
		}

		const user = rows[0];
		res.json({
			exists: true,
			user: {
				id: user.id,
				name: user.name,
				username: user.username,
				email: user.email,
				dietPreference: user.diet_preference,
				allowSubstitutions: !!user.allow_substitutions
			}
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({message: "error reading user data"});
	}
});

app.post("/signup", async (req, res) => {
	const { name, username, email, password, dietPreference, allowSubstitutions } = req.body;
	if (!name || !username || !password) 
		return res.status(400).json({message: "Name, username, and password are required"});

	try {
		const [result] = await db.query(
			`INSERT INTO users (name, username, email, password, diet_preference, allow_substitutions) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				name,
				username,
				email,
				password,
				dietPreference,
				allowSubstitutions
			]
		);
		await fsPromises.writeFile(USER_DATA_FILE, JSON.stringify({ userId: result.insertId }));
		await fsPromises.writeFile(INV_DATA_FILE, '[]');
		res.status(201).json({
			message: "User created successfully",
			user: {
				id: result.insertId,
				name,
				username,
				email: email,
				dietPreference: dietPreference,
				allowSubstitutions: allowSubstitutions
			}
		});
	}
	catch (err) {
		console.error(err);
		res.status(500).json({message: "Error creating user"});
	}
});

app.post("/login", async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password)
		return res.status(400).json({message: "Username and password are required"});

	try {
		const [rows] = await db.query(
			`SELECT id, name, username, email, password, diet_preference, allow_substitutions
			 FROM users
			 WHERE username = ?`,
			[username]
		);

		if (rows.length === 0) {
			return res.status(401).json({
				message: "Invalid username or password"
			});
		}

		const user = rows[0];

		if (user.password !== password) {
			return res.status(401).json({
				message: "Invalid username or password"
			});
		}
		fs.writeFileSync(USER_DATA_FILE, JSON.stringify({ userId: user.id }));
		res.json({
			message: "Login successful",
			user: {
				id: user.id,
				name: user.name,
				username: user.username,
				email: user.email,
				dietPreference: user.diet_preference,
				allowSubstitutions: !!user.allow_substitutions
			}
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({
			message: "Error logging in"
		});
	}
});

app.post("/logout", (req, res) => {
	if (fs.existsSync(USER_DATA_FILE)) {
		fs.unlinkSync(USER_DATA_FILE);
	}
	res.json({
		message: "Logged out successfully"
	});
});

app.put("/user", async (req, res) => {
	try {

		const sessionData = fs.readFileSync(USER_DATA_FILE, "utf8");
		if (!sessionData || !JSON.parse(sessionData).userId) {
			return res.status(404).json({
				message: "No active user session found"
			});
		}

		const session = JSON.parse(sessionData);

		const { name, email, dietPreference } = req.body;

		const [rows] = await db.query(
			`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`,
			[session.userId]
		);

		const existingUser = rows[0];
		const updatedName = name ?? existingUser.name;
		const updatedEmail = email ?? existingUser.email;
		const updatedDietPreference = dietPreference ?? existingUser.diet_preference;

		await db.query(
			`UPDATE users SET name = ?, email = ?, diet_preference = ? WHERE id = ?`,
			[
				updatedName,
				updatedEmail,
				updatedDietPreference,
				session.userId
			]
		);

		const [updatedRows] = await db.query(
			`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`,
			[session.userId]
		);

		const user = updatedRows[0];

		res.json({
			message: "User profile updated successfully",
			user: {
				id: user.id,
				name: user.name,
				username: user.username,
				email: user.email,
				dietPreference: user.diet_preference,
				allowSubstitutions: !!user.allow_substitutions
			}
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({
			message: "Error updating user profile"
		});
	}
});

/*#########			END OF USER API			############*/


/**
 * ***************************************************************
 *					 		RECIPE	API
 * ***************************************************************
 */

/* ==============================
   CREATE RECIPE
============================== */

app.post("/recipes", async (req, res) => {

    try {

        const { title, description } = req.body;

        const [result] = await db.query(
            "INSERT INTO recipes (title, description) VALUES (?, ?)",
            [title, description]
        );

        res.json({
            message: "Recipe created",
            recipeId: result.insertId
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});

/* ==============================
   ADD INGREDIENT TO RECIPE
============================== */

app.post("/recipes/:id/ingredients", async (req, res) => {

    try {

        const recipeId = req.params.id;
        const { ingredientId, quantity } = req.body;

        await db.query(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)",
            [recipeId, ingredientId, quantity]
        );

        res.json({
            message: "Ingredient added"
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});

/* ==============================
   GET RECIPE INGREDIENTS
============================== */

app.get("/recipes/:id/ingredients", async (req, res) => {

    try {

        const recipeId = req.params.id;

        const [rows] = await db.query(`
            SELECT i.name, ri.quantity
            FROM recipe_ingredients ri
            JOIN ingredients i
            ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id = ?
        `, [recipeId]);

        res.json(rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});

/* ==============================
   CALCULATE CALORIES
============================== */

app.get("/recipes/:id/calories", async (req, res) => {

    try {

        const recipeId = req.params.id;

        const [rows] = await db.query(`
            SELECT SUM(i.calories_per_unit * ri.quantity) AS totalCalories
            FROM recipe_ingredients ri
            JOIN ingredients i
            ON ri.ingredient_id = i.ingredient_id
            WHERE ri.recipe_id = ?
        `, [recipeId]);

        res.json(rows[0]);

    } catch (error) {

        console.error(error);
        res.status(500).json({ error: "Server error" });

    }

});

/*#########			END OF RECIPE API		############*/


app.listen(PORT, HOST, () => {
	console.log(`Server running on ${PORT} by host ${HOST}`);
});
