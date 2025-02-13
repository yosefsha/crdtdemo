# use the official node image
FROM node:18
# Set the working directory
WORKDIR /app
# Copy the package.json and package-lock.json
COPY package*.json ./
# Install the dependencies
RUN npm install
# Copy the rest of the files
COPY . .
# Expose the port
EXPOSE 5000
# Set the environment variable
ENV PORT=5000
ENV CLIENT_ORIGIN=http://localhost:81
# Start the server
CMD ["npm", "start"]