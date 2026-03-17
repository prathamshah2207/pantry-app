# CMPT 370 Project

This is our CMPT 370 group project. The app is basically a pantry / recipe / nutrition manager type thing where users can keep track of what food items they have, manage their profile and diet preferences, and work with recipe and inventory features in one place. The whole point was to build a simple working prototype so we kept things pretty straightforward and focused on getting the core stuff working.

Right now the project has a basic user profile system and inventory functionality working. A user can create a profile, view it, and edit parts of it like display name, email, and diet preference. The app also has the inventory page and backend routes connected through the shared server setup. We also set the project up with Docker so it’s easier to run without everyone’s laptop doing some weird dependency drama.

## THis si what’s implemented right now

- basic landing page
- user profile creation and editing
- user profile display
- diet preference and inventory saved with user profile
- inventory page and inventory backend routes
- docker setup for running the app

## this is how to run it

make sure Docker Desktop is running first, otherwise this whole thing is gonna act dead

from the project folder, run this command in cmd or powershell or bash or in any terminal:

docker compose up --build
and then after the whole process is up and running, goto localhost:80