# This docker file will create a docker image for the rclient react app
# It will use the node:16 image as the base image
# It will copy the package.json and package-lock.json files to the /app directory
# It will run the npm install command to install the dependencies
# It will copy the rest of the files to the /app directory
# It will run the npm run build command to build the react app
# It will use the nginx:alpine image as the base image
# It will copy the build directory from the /app directory to the /usr/share/nginx/html directory
# It will expose port 80
# It will run the nginx command to start the nginx server

# Declare build-time argument
ARG MYENV

FROM node:16 AS build

# Set the working directory
WORKDIR /app

# Copy the shared folder first
COPY shared/ ./shared/

# Build shared package first (required by rclient)
WORKDIR /app/shared
COPY shared/package.json shared/tsconfig.json ./
RUN npm run build || tsc

# Set working directory for rclient
WORKDIR /app/rclient

# Copy the package.json and package-lock.json files
COPY rclient/package.json rclient/package-lock.json ./

# Install the dependencies (will use ../shared)
RUN npm install

# Copy the rest of the rclient files
COPY rclient/ .

# Build the react app
# Declare ARG before ENV to ensure it gets a value
ARG MYENV
ENV MYENV=$MYENV
# Use it in your build
RUN echo "Building with MYENV=$MYENV"
ARG API_URL
ARG SOCKET_PATH
ENV REACT_APP_API_URL=$API_URL
ENV REACT_APP_SOCKET_PATH=$SOCKET_PATH
RUN echo "Building with REACT_APP_API_URL=$REACT_APP_API_URL"

# RUN npm run build
RUN REACT_APP_API_URL=$API_URL REACT_APP_MYENV=$MYENV npm run build

# Use the nginx image as the base image
FROM nginx:alpine

WORKDIR /usr/share/nginx/html
# Copy the build directory to the nginx html directory
COPY --from=build /app/rclient/build .

# Copy custom nginx config for SPA fallback
COPY rclient/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start the nginx server
CMD ["nginx", "-g", "daemon off;"]
