# ================================
# Stage 1: Build Stage (Frontend)
# ================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies (needed for some npm packages)
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
# Use npm ci for faster, deterministic builds
RUN npm ci --include=dev

# Copy source code (respects .dockerignore)
COPY . .

# Build arguments for environment variables (injected at build time)
ARG VITE_AUTH_MODE
ARG VITE_META_APP_ID
ARG VITE_META_APP_SECRET
ARG VITE_OAUTH_REDIRECT_URI
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL
ARG VITE_WEBHOOK_URL
ARG VITE_WEBHOOK_VERIFY_TOKEN
ARG VITE_SHOW_ADMIN_LINK
ARG N8N_BASE_URL
ARG N8N_DM_WEBHOOK
ARG N8N_COMMENT_WEBHOOK
ARG N8N_ORDER_WEBHOOK
ARG DELETION_MAX_RETRIES
ARG DELETION_RETRY_BASE_MINUTES
ARG DELETION_ENABLE_AUTO_RETRY
ARG CRON_API_KEY
ARG ADMIN_API_KEY

# Set environment variables for Vite build
ENV VITE_AUTH_MODE=${VITE_AUTH_MODE} \
    VITE_META_APP_ID=${VITE_META_APP_ID} \
    VITE_META_APP_SECRET=${VITE_META_APP_SECRET} \
    VITE_OAUTH_REDIRECT_URI=${VITE_OAUTH_REDIRECT_URI} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_WEBHOOK_URL=${VITE_WEBHOOK_URL} \
    VITE_WEBHOOK_VERIFY_TOKEN=${VITE_WEBHOOK_VERIFY_TOKEN} \
    VITE_SHOW_ADMIN_LINK=${VITE_SHOW_ADMIN_LINK} \
    N8N_BASE_URL=${N8N_BASE_URL} \
    N8N_DM_WEBHOOK=${N8N_DM_WEBHOOK} \
    N8N_COMMENT_WEBHOOK=${N8N_COMMENT_WEBHOOK} \
    N8N_ORDER_WEBHOOK=${N8N_ORDER_WEBHOOK} \
    DELETION_MAX_RETRIES=${DELETION_MAX_RETRIES} \
    DELETION_RETRY_BASE_MINUTES=${DELETION_RETRY_BASE_MINUTES} \
    DELETION_ENABLE_AUTO_RETRY=${DELETION_ENABLE_AUTO_RETRY} \
    CRON_API_KEY=${CRON_API_KEY} \
    ADMIN_API_KEY=${ADMIN_API_KEY}

# Build the application using Vite
RUN npm run build

# ================================
# Stage 2: Production Stage (Nginx)
# ================================
FROM nginx:1.25-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy static files that may not be in dist
COPY --from=builder /app/public /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx (daemon off to keep container running)
CMD ["nginx", "-g", "daemon off;"]
