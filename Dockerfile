FROM node:20-slim
LABEL org.opencontainers.image.source="https://github.com/Levelearn/backend"

WORKDIR /app

# Install dependencies first to maximize Docker layer caching
COPY package*.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

# Copy the rest of the application source code
COPY . .

ENV NODE_ENV=production \
	PORT=7000

EXPOSE 7000

CMD ["node", "src/index.js"]