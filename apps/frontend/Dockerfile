FROM node:20-alpine

WORKDIR /app

# Install dependencies first to maximize layer cache hits.
COPY package*.json ./
RUN npm ci

# Copy source and run the frontend build script.
COPY . .

CMD ["npm", "run", "build"]
