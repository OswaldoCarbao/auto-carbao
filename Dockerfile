# Usamos una imagen de Node oficial donde el comando 'node' es sagrado
FROM node:18-alpine

# Instalamos herramientas básicas y n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos tu index_receptor.js y el resto
COPY . .

# Creamos la carpeta para los datos de n8n y damos permisos
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node

USER node

# Puertos
ENV PORT=10000
ENV N8N_PORT=10001
EXPOSE 10000

# Ahora el comando 'node' funcionará sin trucos
CMD ["node", "index_receptor.js"]
