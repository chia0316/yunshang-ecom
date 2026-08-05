# --- builder ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* vars are baked into the JS bundle here, not at runtime.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_WHATSAPP_NUMBER
ENV VITE_WHATSAPP_NUMBER=${VITE_WHATSAPP_NUMBER}
RUN npm run build

# --- runner: static files served by nginx ---
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
