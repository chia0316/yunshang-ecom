FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Product photos and the docker-entrypoint migration step both need this to
# exist; the volume mount in docker-compose.yml persists it across restarts.
RUN mkdir -p public/images

EXPOSE 8090

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "app.js"]
