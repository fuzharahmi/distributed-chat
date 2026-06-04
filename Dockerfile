FROM node:18-alpine

WORKDIR /app

# Copy package.json dulu (agar Docker cache layer install dependencies)
COPY server/package.json ./server/

# Masuk ke folder server lalu install dependencies
# Pakai npm install (bukan npm ci) agar tidak butuh package-lock.json
WORKDIR /app/server
RUN npm install --production

# Kembali ke /app lalu copy semua source code
WORKDIR /app
COPY server/ ./server/
COPY client/ ./client/

# Expose port (akan di-override oleh environment variable PORT)
EXPOSE 3000

# Set working directory ke server dan jalankan
WORKDIR /app/server
CMD ["node", "server.js"]
