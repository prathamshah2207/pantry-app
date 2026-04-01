# CMPT 370 Project

The app is basically a pantry / recipe manager app. The idea is to keep everything in one place so a user can manage their profile, track pantry inventory, build and save recipes, and use filtering features based on things like diet preference, ingredients, calories, and pantry availability.

## What is implemented right now

- landing page with navigation to the main app sections
- user signup, login, logout, and session handling
- user profile display and editing
- diet preference saved with user profile
- inventory page with add, edit, reset, and delete item features
- inventory stored in MySQL and tied to the correct logged in user
- recipe builder page
- recipe saving and loading through backend APIs
- saved recipes page
- recipe filtering by:
	- recipe name
	- ingredient
	- diet tag
	- max calories
	- pantry availability
- pantry matching for recipes so users can see which recipes they can fully make from their current inventory
- global recipe support along with user-created recipes
- Docker setup for local development
- deployed live version on Render

## Live deployed version

The deployed version is available here:

`https://pantry.somehowimanaged.website`

The database is setup on railway services for MySQL

### Important note about the deployed version

Since the deployed app is running on Render free tier, it may take a little time to load the first time if it has gone to sleep. If nobody has used it for a bit, Render may need to wake the service back up, so the first load can take around 3 to 5 minutes sometimes. After that, it should work normally.

## Local run instructions

Make sure Docker Desktop is running first, otherwise the app will just not work
From the project folder, run this command in cmd, powershell, bash, or whatever terminal you use:

```bash
docker compose up --build -d