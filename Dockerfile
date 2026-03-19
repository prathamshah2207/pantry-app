FROM node:latest

WORKDIR /app

COPY *.json ./
COPY server.js ./
COPY inventory ./inventory
COPY user ./user
COPY public ./public
COPY recipe-app ./recipe-app

RUN npm install

EXPOSE 80

CMD ["node", "server.js"]