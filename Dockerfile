FROM node:18-alpine

WORKDIR /app

# Copy package files dan install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy semua source code
COPY server/ ./server/
COPY client/ ./client/

# Expose port
EXPOSE 3000

# Working directory ke server
WORKDIR /app/server

# Jalankan server
CMD ["node", "server.js"]
