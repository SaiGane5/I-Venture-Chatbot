# Use the official Node.js image from the Docker Hub
FROM node:16-buster

# Set the working directory in the container
WORKDIR /chatbot-frontend

# Copy the package.json and package-lock.json files into the container
COPY package*.json ./

RUN apt-get update && apt-get install -y npm

# Install the required packages
CMD ["npm", "install"]

# Copy the rest of the application code into the container
COPY . .

# Build the React app for production
RUN npm run build

# Use a minimal HTTP server to serve the React app
RUN npm install -g serve

# Command to run the HTTP server
CMD ["npm" "start"]
