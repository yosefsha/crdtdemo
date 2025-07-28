FROM node:18

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install the dependencies
RUN npm install --production

# Copy the rest of the files
COPY . .

# Expose the port for HTTP (App Runner will handle HTTPS externally)
EXPOSE 5001

# Set environment variables
ENV PORT=5001
# App Runner will handle HTTPS externally

# Start the server
CMD ["npm", "run", "start:docker"]
