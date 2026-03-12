const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());

const userFilePath = path.join(__dirname, "user", "user.json");

app.post("/signup", (req, res) => {
	const { name, username, email, password, dietPreference, allowSubstitutions } = req.body;

	if (!name || !username || !password)
		return res.status(400).json({message: "Name, username, and password are required"});

	const newUser = {
		name,
		username,
		email: email || "",
		password,
		dietPreference: dietPreference || "",
		allowSubstitutions: allowSubstitutions ?? true
	};

	fs.writeFileSync(userFilePath, JSON.stringify(newUser, null, 2));

	res.status(201).json({
		message: "User profile created successfully",
		user: {
			id: newUser.id,
			name: newUser.name,
			username: newUser.username
		}
	});
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});