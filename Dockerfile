FROM node:18-alpine

WORKDIR /app

# Install dependencies for server
COPY package-server.json package.json
RUN npm install

# Copy built files
COPY dist/ dist/
COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
