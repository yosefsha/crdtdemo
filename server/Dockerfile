FROM node:18

# Set the working directory
WORKDIR /app

# Copy and build shared package first (required by server)
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Set working directory for server
WORKDIR /app/server

# Copy the package.json and package-lock.json
COPY server/package*.json ./

# Install the dependencies and the shared package
RUN npm install --production
RUN npm install ../shared

# Copy the rest of the server files
COPY server/ .

# Expose the port for HTTP (App Runner will handle HTTPS externally)
EXPOSE 5001

# Set environment variables
ENV PORT=5001
# App Runner will handle HTTPS externally

# Start the server
CMD ["npm", "run", "start:docker"]
