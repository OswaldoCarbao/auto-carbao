FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

# Instalamos las dependencias
COPY package*.json ./
RUN npm install express && npm install --omit=dev

# Copiamos todo el proyecto
COPY . .

# Aseguramos que el usuario node sea dueño de TODO, incluso de su carpeta personal
RUN chown -R node:node /home/node/app && chown -R node:node /home/node

USER node

ENV PORT=10000
EXPOSE 10000

# Usamos la RUTA ABSOLUTA que n8n usa internamente
CMD ["/usr/local/bin/node", "index_receptor.js"]
