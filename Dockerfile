FROM node:latest

WORKDIR /app

COPY package*.json ./
COPY server.js ./
COPY inventory ./inventory
COPY user ./user

RUN npm install

EXPOSE 80

CMD ["node", "server.js"]