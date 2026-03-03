# Stage 1: build
FROM node:20-slim AS build
WORKDIR /app

COPY apps/frontend/package*.json ./
RUN npm ci

COPY apps/frontend ./
COPY packages/shared /packages/shared

RUN npm run build

# Stage 2: serve
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve

COPY --from=build /app ./

ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]
