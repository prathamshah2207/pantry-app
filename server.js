const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());

/* ==============================
   DATABASE CONNECTION
============================== */

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",       // change if your mysql has password
    database: "recipe_app"
});

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


/* ==============================
   START SERVER
============================== */

const PORT = 3000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});
