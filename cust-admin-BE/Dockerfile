FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Product photos/videos/QR codes and the docker-entrypoint migration step
# both need these to exist; the volume mounts in docker-compose.yml persist
# them across restarts.
RUN mkdir -p public/images public/videos public/qrcodes

EXPOSE 8090

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "app.js"]
