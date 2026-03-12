const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());

const userFilePath = path.join(__dirname, "user", "user.json");


app.get("/user", (req, res) => {
	try {
		if (!fs.existsSync(userFilePath)) {
			return res.json({ exists: false, user: null });
		}

		const fileData = fs.readFileSync(userFilePath, "utf8");

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
	
	if (!fs.existsSync(userFilePath)) {
		fs.writeFileSync(userFilePath, "null");
	}

	// const existingData = fs.readFileSync(userFilePath, "utf8");
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

	fs.writeFileSync(userFilePath, JSON.stringify(newUser, null, 2));

	res.status(201).json({
		message: "User profile created successfully",
		user: newUser
	});
});

app.get("/", (req, res) => {
	res.send("Server is running");
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});