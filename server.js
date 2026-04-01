'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const mysql = require("mysql2/promise");
const session = require("express-session");

const HOST = '0.0.0.0';
const PORT = process.env.PORT || 80;

const app = express();
const fsPromises = fs.promises;

const dbConfig = {
	host: process.env.DB_HOST || 'db',
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || 'root',
	database: process.env.DB_NAME || 'pantry_app',
	waitForConnections: true,
	connectionLimit: 10
};

if (process.env.DB_SSL === 'true')
	dbConfig.ssl = process.env.DB_CA ? { ca: process.env.DB_CA } : { rejectUnauthorized: false };

const db = mysql.createPool(dbConfig);

/* --------------------
   NEW: server HTML
--------------------- */
app.use(express.static('inventory'));
app.use(express.static('user'));
app.use(express.static('public'));
app.use(express.static('recipe-app'));
app.use(express.json());
app.use(bodyParser.json());
app.set('trust proxy', 1);

app.use(session({
	secret: process.env.SESSION_SECRET || "secret-key",
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: process.env.NODE_ENV === "production",
		httpOnly: true,
		maxAge: 1000 * 60 * 60 * 24
	}
}));

/* recipe related functions */

// gives current logged in user for recipe filtering
async function getCurrentUser(req) {
	if (!req.session.userId)
		return null;

	const [rows] = await db.query(
		`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`,
		[req.session.userId]
	);
	return rows[0] || null;
}

// this gives only this user's saved recipes and all the global recipes
async function getAllRecipes(userId) {
	const [rows] = await db.query(
		`SELECT id, user_id, name, calories, diet_tag AS dietTag, ingredients_json AS ingredients
		FROM recipes WHERE user_id = ? OR is_global = 1 ORDER BY id DESC`, [userId]
	);
	return rows;
}

// loads pantry items so recipe availability can be checked
async function getInventoryForUser(userId) {
	const [rows] = await db.query(`SELECT name, quant FROM inventory WHERE user_id = ?`, [userId]);
	return rows;
}

// returns a normalized recipe fro a given recipe in form of array with the recipe, its calories, dietary tag and ingredients to make it
function normalizeRecipe(recipe) {
	let parsedIngredients = recipe.ingredients;

	if (typeof parsedIngredients === "string") {
		try {
			parsedIngredients = JSON.parse(parsedIngredients);
		} catch {
			parsedIngredients = [];
		}
	}

	if (!Array.isArray(parsedIngredients))
		parsedIngredients = [];
	return {
		...recipe,
		calories: Number(recipe.calories) || 0,
		dietTag: recipe.dietTag || "None",
		ingredients: parsedIngredients
	};
}

// returns a map of each inventory items with their quantities
function buildInventoryMap(items) {
	const inventoryMap = new Map();

	items.forEach(item => {
		const key = String(item.name || "").trim().toLowerCase();
		const quant = Number(item.quant) || 0;

		if (key) {
			inventoryMap.set(key, quant);
		}
	});

	return inventoryMap;
}

// THis is for matching if any ingredients for a recipe are missing from the pantry inventory and if so then returns them
function attachPantryMatch(recipe, inventoryMap) {
	const missingIngredients = recipe.ingredients.map(ingredient => {
		const key = String(ingredient.name || "").trim().toLowerCase();
		const need = Number(ingredient.quantity) || 0;
		const have = inventoryMap.get(key) || 0;

		if (have >= need) {
			return null;
		}

		return {
			name: ingredient.name,
			need,
			have,
			unit: ingredient.unit || ""
		};
	}).filter(Boolean);

	return {
		...recipe,
		canMake: missingIngredients.length === 0,
		missingIngredients
	};
}

//tells Express to serve static files (HTML, CSS, images, client-side JS)
// from a folder called public.
/*****
 *
 * This HTML page lives on the server.
   Clicking a link sends a request.”
   The server runs JavaScript and sends a response.
 */

app.get('/', (req, res) => {
	res.sendFile("public/index.html", { root: __dirname });
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
	}
	catch (err) {
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

	}
	catch (err) {

		console.error(err);
		res.status(500).json({ error: 'Failed to read messages' });

	}
});

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

	}
	catch (err) {

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

	}
	catch (err) {

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

	}
	catch (err) {

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

	}
	catch (err) {

		res.status(500).send('Delete failed');

	}

});

app.get('/gp', (req, res) => {
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
			return res.json({ exists: false, user: null });

		const [rows] = await db.query(`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`, [req.session.userId]);

		if (rows.length === 0)
			return res.json({ exists: false, user: null });
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
		res.status(500).json({ message: "Error reading user data" });
	}
});

app.post("/signup", async (req, res) => {
	try {
		const { name, username, email, password, dietPreference, allowSubstitutions } = req.body;

		if (!name || !username || !password)
			return res.status(400).json({ message: "Name, username, and password are required" });

		const [existingUsers] = await db.query("SELECT id FROM users WHERE username = ?", [username]);

		if (existingUsers.length > 0)
			return res.status(409).json({ message: "Username already exists" });

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
		res.status(500).json({ message: "Error creating profile" });
	}
});

app.post("/login", async (req, res) => {
	try {
		const { username, password } = req.body;
		if (!username || !password)
			return res.status(400).json({ message: "Username and password are required" });
		const [rows] = await db.query(`SELECT id, name, username, email, password, diet_preference, allow_substitutions FROM users WHERE username = ?`, [username]);

		if (rows.length === 0 || rows[0].password !== password)
			return res.status(401).json({ message: "Invalid username or password" });
		const user = rows[0];
		req.session.userId = user.id;
		res.json({ message: "Login successful" });
	}
	catch (error) {
		console.error(error);
		res.status(500).json({ message: "Error logging in" });
	}
});

app.post("/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error(err);
			return res.status(500).json({ message: "Error logging out" });
		}
		res.clearCookie("connect.sid");
		res.json({ message: "Logged out successfully" });
	});
});

app.put("/user", async (req, res) => {
	try {
		if (!req.session.userId)
			return res.status(401).json({ message: "No active user session found" });
		const { name, email, dietPreference } = req.body;

		const [rows] = await db.query(`SELECT id, name, username, email, diet_preference, allow_substitutions FROM users WHERE id = ?`, [req.session.userId]);

		if (rows.length === 0)
			return res.status(404).json({ message: "User not found" });

		const existingUser = rows[0];
		const updatedName = name ?? existingUser.name;
		const updatedEmail = email ?? existingUser.email;
		const updatedDietPreference = dietPreference ?? existingUser.diet_preference;

		await db.query(`UPDATE users SET name = ?, email = ?, diet_preference = ? WHERE id = ?`, [updatedName, updatedEmail, updatedDietPreference, req.session.userId]);

		const [updatedRows] = await db.query(
			`SELECT id, name, username, email, diet_preference, allow_substitutions
			FROM users
			WHERE id = ?`,
			[req.session.userId]
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
		res.status(500).json({ message: "Error updating user profile" });
	}
});

/*#########			END OF USER API			############*/


/**
 * ***************************************************************
 *					 		RECIPE	API
 * ***************************************************************
 */

app.get("/api/recipes", async (req, res) => {
	try {
		const { search = "", dietTag = "", ingredient = "", maxCalories = "", availableOnly = "false"} = req.query;

		const user = await getCurrentUser(req);
		if (!user)
			return res.status(401).json({ message: "Not logged in." });

		const rawRecipes = await getAllRecipes(user.id);
		let recipes = rawRecipes.map(normalizeRecipe);

		const rawInventory = await getInventoryForUser(user.id);
		const inventoryMap = buildInventoryMap(rawInventory);

		const cleanSearch = search.trim().toLowerCase();
		const cleanDietTag = dietTag.trim().toLowerCase();
		const cleanIngredient = ingredient.trim().toLowerCase();
		const calorieLimit = Number(maxCalories);

		// filter by recipe name
		if (cleanSearch)
			recipes = recipes.filter(recipe => String(recipe.name || "").toLowerCase().includes(cleanSearch));

		// filter by diet tag
		if (cleanDietTag && cleanDietTag !== "none")
			recipes = recipes.filter(recipe => String(recipe.dietTag || "").toLowerCase() === cleanDietTag);

		// filter by ingredient name
		if (cleanIngredient)
			recipes = recipes.filter(recipe =>
				recipe.ingredients.some(item => String(item.name || "").toLowerCase().includes(cleanIngredient))
			);

		// filter by max calories
		if (!Number.isNaN(calorieLimit) && maxCalories !== "")
			recipes = recipes.filter(recipe => recipe.calories <= calorieLimit);

		// attach pantry match info for each recipe
		recipes = recipes.map(recipe => attachPantryMatch(recipe, inventoryMap));

		// return only recipes the pantry can fully make
		if (availableOnly === "true")
			recipes = recipes.filter(recipe => recipe.canMake);

		res.json(recipes);
	}
	catch (err) {
		console.error("Error filtering recipes:", err);
		res.status(500).json({ message: "Could not load filtered recipes." });
	}
});

app.post("/api/recipes", async (req, res) => {
	try {
		if (!req.session.userId)
			return res.status(401).json({ message: "No active user session found" });

		const { name, ingredients, calories, dietTag } = req.body;

		if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
			return res.status(400).json({ message: "Recipe name and ingredients are required" });
		}

		const parsedCalories = Number(calories) || 0;

		const [result] = await db.query(
			"INSERT INTO recipes (user_id, name, calories, diet_tag, ingredients_json) VALUES (?, ?, ?, ?, ?)",
			[
				req.session.userId,
				name,
				parsedCalories,
				dietTag || null,
				JSON.stringify(ingredients)
			]
		);

		res.status(201).json({
			message: "Recipe saved successfully",
			recipeId: result.insertId
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).json({message: "Error saving recipe" });
	}
});

app.delete("/api/recipes/:id", async (req, res) => {
	try {
		if (!req.session.userId)
			return res.status(401).json({ message: "No active user session found" });
		const recipeId = req.params.id;

		await db.query(
			"DELETE FROM recipes WHERE id = ? AND user_id = ?",
			[recipeId, req.session.userId]
		);
		res.json({ message: "Recipe deleted successfully" });
	}
	catch (error) {
		console.error(error);
		res.status(500).json({ message: "Error deleting recipe" });
	}
});

/*#########			END OF RECIPE API		############*/


app.listen(PORT, HOST, () => {
	console.log(`Server running on ${PORT} by host ${HOST}`);
});