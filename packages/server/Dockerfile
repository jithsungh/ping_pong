FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY tsconfig.base.json ./

# Build shared package
RUN npm run build -w @paddlelink/shared

# Build server
RUN npm run build -w @paddlelink/server

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "run", "start", "-w", "@paddlelink/server"]
