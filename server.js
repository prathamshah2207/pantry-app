'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
// const cors = require("cors");
const mysql = require("mysql2/promise");
const session = require("express-session");

const HOST = '0.0.0.0';
const PORT = 80;

const app = express();
const fsPromises = fs.promises;

const db = mysql.createPool({
	host: 'db',
	user: 'root',
	password: 'root',
	database: 'pantry_app',
	waitForConnections: true
})

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
app.use(session({
	secret: "secret-key",
	resave: false,
	cookie: {
		secure: false,
		httpOnly: true,
		maxAge: 1000 * 60 * 60 * 24
	}
}));

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

		if (!req.session.userId) {
			return res.status(401).json({ error: 'No active user session' });
		}

		const [items] = await db.query(
			'SELECT id, quant, name, cals, defa, unit FROM inventory WHERE user_id = ?',
			[req.session.userId]
		);

		res.json(items);

	} catch (err) {

		console.error(err);
		res.status(500).json({ error: 'Failed to read messages' });

	}
})

app.post('/api/sendmsg', async (req, res) => {
    const { quant, name, cals, defa, unit } = req.body;

	try {

        if (!req.session.userId) {
            return res.status(401).send('Write failed');
        }

        const entry = {
            id: Date.now(),
            quant,
            name,
            cals,
            defa,
            unit
        };

		await db.query(
			'INSERT INTO inventory (id, user_id, quant, name, cals, defa, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[entry.id, req.session.userId, entry.quant, entry.name, entry.cals, entry.defa, entry.unit]
		);

		res.send('Saved');

	} catch (err) {

		res.status(500).send('Write failed');

	}
});

app.post('/api/editmsg', async (req, res) => {

    const { id, quant, name, cals, defa, unit } = req.body;

	try {

        if (!req.session.userId) {
            return res.status(401).send('Edit failed');
        }

		await db.query(
			'UPDATE inventory SET quant = ?, name = ?, cals = ?, defa = ?, unit = ? WHERE id = ? AND user_id = ?',
			[quant, name, cals, defa, unit, id, req.session.userId]
		);

		res.send('Edited');

	} catch (err) {

		res.status(500).send('Edit failed');

	}
});

app.post('/api/resetmsg', async (req, res) => {

	const { id } = req.body;

	try {

		if (!req.session.userId) {
			return res.status(401).send('Reset failed');
		}

		await db.query(
			'UPDATE inventory SET quant = defa WHERE id = ? AND user_id = ?',
			[id, req.session.userId]
		);

		res.send('Reset');

	} catch (err) {

		res.status(500).send('Reset failed');

	}

});

app.post('/api/deletemsg', async (req, res) => {

	const { id } = req.body;

	try {

		if (!req.session.userId) {
			return res.status(401).send('Delete failed');
		}

		await db.query(
			'DELETE FROM inventory WHERE id = ? AND user_id = ?',
			[id, req.session.userId]
		);

		res.send('Deleted');

	} catch (err) {

		res.status(500).send('Delete failed');

	}

});

app.get('/gp', (req,res) => {
	res.json('inventory table in MySQL');
});

/*#########			END OF INVENTORY API		############*/


/**
 * ***************************************************************
 *					 		USER	API
 * ***************************************************************
 */

app.get("/user", async (req, res) => {
	try {
		if (!req.session.userId)
			return res.json({exists: false, user: null});

		const [rows] = await db.query(`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`, [req.session.userId]);

		if (rows.length === 0)
			return res.json({exists: false, user: null});
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
		res.status(500).json({message: "Error reading user data"});
	}
});

app.post("/signup", async (req, res) => {
	try {
		const {name, username, email, password, dietPreference, allowSubstitutions} = req.body;

		if (!name || !username || !password)
			return res.status(400).json({message: "Name, username, and password are required"});

		const [existingUsers] = await db.query("SELECT id FROM users WHERE username = ?", [username]);

		if (existingUsers.length > 0)
			return res.status(409).json({message: "Username already exists"});

		const [result] = await db.query(`INSERT INTO users (name, username, email, password, diet_preference, allow_substitutions) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				name,
				username,
				email || null,
				password,
				dietPreference || null,
				allowSubstitutions ? 1 : 0
			]
		);

		const newUserId = result.insertId;
		req.session.userId = newUserId;
		res.status(201).json({
			message: "Profile created successfully",
			userId: newUserId
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({message: "Error creating profile"});
	}
});

app.post("/login", async (req, res) => {
	try {
		const {username, password} = req.body;
		if (!username || !password)
			return res.status(400).json({message: "Username and password are required"});
		const [rows] = await db.query(`SELECT id, name, username, email, password, diet_preference, allow_substitutions FROM users WHERE username = ?`, [username]);

		if (rows.length === 0 || rows[0].password !== password)
			return res.status(401).json({message: "Invalid username or password"});
		const user = rows[0];
		req.session.userId = user.id;
		res.json({message: "Login successful"});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({message: "Error logging in"});
	}
});

app.post("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error(err);
			return res.status(500).json({message: "Error logging out"});
		}
		res.clearCookie("connect.sid");
		res.json({message: "Logged out successfully"});
	});
});

app.put("/user", async (req, res) => {
	try {
		if (!req.session.userId)
			return res.status(401).json({message: "No active user session found"});
		const { name, email, dietPreference } = req.body;

		const [rows] = await db.query(`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`, [req.session.userId]);

		if (rows.length === 0)
			return res.status(404).json({message: "User not found"});

		const existingUser = rows[0];
		const updatedName = name ?? existingUser.name;
		const updatedEmail = email ?? existingUser.email;
		const updatedDietPreference = dietPreference ?? existingUser.diet_preference;

		await db.query(`UPDATE users SET name = ?, email = ?, diet_preference = ? WHERE id = ?`, [updatedName, updatedEmail, updatedDietPreference, req.session.userId]);
		
		const [updatedRows] = await db.query(
			`SELECT id, name, username, email, diet_preference, allow_substitutions
			FROM users
			WHERE id = ?`,
			[req.session.userId]);
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
		res.status(500).json({message: "Error updating user profile"});
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
