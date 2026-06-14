FROM node:18-alpine

WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /data

# Copy backend dependencies
COPY package-prod.json package.json
RUN npm install

# Copy backend code
COPY backend/ backend/

# Copy built frontend
COPY dist/ dist/

EXPOSE 3000

CMD ["node", "backend/server.js"]
