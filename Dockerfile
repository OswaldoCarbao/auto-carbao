FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

# Instalamos express y dependencias rápido
COPY package*.json ./
RUN npm install express --omit=dev

# Copiamos todo
COPY . .

# Permisos totales a la carpeta de trabajo y a la home de node
RUN chown -R node:node /home/node/app && \
    chown -R node:node /home/node

# Volvemos al usuario node
USER node

# Render usa la variable PORT, n8n usará el 10001 internamente
ENV PORT=10000
ENV N8N_PORT=10001

EXPOSE 10000

# Usamos el comando "node" a secas. 
# Si esto falla, es que el PATH de la imagen está vacío, 
# pero al ser usuario "node", debería reconocerlo.
CMD ["node", "index_receptor.js"]
