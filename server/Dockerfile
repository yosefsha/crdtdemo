FROM node:18

WORKDIR /app

# Build shared package first (server imports @crdtdemo/shared)
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Install server dependencies (all deps needed for tsc)
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
RUN npm install ../shared

# Copy source and compile TypeScript at build time
COPY server/ .
RUN npx tsc

EXPOSE 5001
ENV PORT=5001

# Run compiled JS directly — no tsc or nodemon at runtime
CMD ["node", "build/index.js"]
