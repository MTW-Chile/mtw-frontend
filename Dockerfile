# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build arguments for Vite environment variables
ARG VITE_API_URL
ARG VITE_SERVICE_TOKEN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SERVICE_TOKEN=$VITE_SERVICE_TOKEN

RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine
ENV PORT=80

COPY --from=builder /app/dist /usr/share/nginx/html
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
