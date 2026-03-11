FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY *.js ./
COPY images/ ./images/

# token.js will be mounted at runtime
CMD ["node", "saburovo-bot.js"]
