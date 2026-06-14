# Stage 1: Build the React app
FROM node:18-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for build tools)
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:18-alpine

WORKDIR /app

# Install only server dependencies
COPY package-server.json package.json
RUN npm install

# Copy built assets from builder stage
COPY --from=builder /app/dist dist/
COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
