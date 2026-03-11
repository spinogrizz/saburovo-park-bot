FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY *.js ./
COPY images/ ./images/

# token.js will be mounted at runtime
CMD ["node", "saburovo-bot.js"]
