FROM node:18

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the files
COPY . .

# Expose the port for HTTP (App Runner will handle HTTPS externally)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV CLIENT_ORIGIN=http://localhost:80  
# App Runner will handle HTTPS externally

# Start the server
CMD ["npm", "start"]
