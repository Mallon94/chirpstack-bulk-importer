# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_CHIRPSTACK_URL
ARG VITE_CHIRPSTACK_API_TOKEN
ARG VITE_CHIRPSTACK_APPLICATION_ID
ARG VITE_CHIRPSTACK_DEVICE_PROFILE_ID

# Set as environment variables for the build
ENV VITE_CHIRPSTACK_URL=$VITE_CHIRPSTACK_URL
ENV VITE_CHIRPSTACK_API_TOKEN=$VITE_CHIRPSTACK_API_TOKEN
ENV VITE_CHIRPSTACK_APPLICATION_ID=$VITE_CHIRPSTACK_APPLICATION_ID
ENV VITE_CHIRPSTACK_DEVICE_PROFILE_ID=$VITE_CHIRPSTACK_DEVICE_PROFILE_ID

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]