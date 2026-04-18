FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

COPY package*.json ./
COPY index_receptor.js ./

RUN npm install --omit=dev

# Puerto de Render
ENV N8N_PORT=10000
EXPOSE 10000

# LA SOLUCIÓN: Usamos la ruta absoluta del ejecutable de node en n8n
CMD ["/usr/local/bin/node", "index_receptor.js"]
