# This docker file will create a docker image for the rclient react app
# It will use the node:12.18.3 image as the base image
# It will copy the package.json and package-lock.json files to the /app directory
# It will run the npm install command to install the dependencies
# It will copy the rest of the files to the /app directory
# It will run the npm run build command to build the react app
# It will use the nginx:1.19.0 image as the base image
# It will copy the build directory from the /app directory to the /usr/share/nginx/html directory
# It will expose port 80
# It will run the nginx command to start the nginx server

# Declare build-time argument
ARG MYENV

FROM node:16 AS build

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files

COPY package.json package-lock.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the files
COPY . .

# Build the react app
# Declare ARG before ENV to ensure it gets a value
ARG MYENV
ENV MYENV=$MYENV

RUN echo "MYENV is iiiiiiii: $MYENV"  # Debugging

# Use it in your build
RUN echo "Building with MYENV=$MYENV"

# RUN npm run build
RUN REACT_APP_MYENV=$MYENV npm run build

# Use the nginx image as the base image
FROM nginx:alpine

WORKDIR /usr/share/nginx/html
# Copy the build directory to the nginx html directory
COPY --from=build /app/build .

# Expose port 80
EXPOSE 80

ENV PORT=80
# ENV REACT_APP_API_URL=http://localhost:5000

# Start the nginx server
CMD ["nginx", "-g", "daemon off;"]


