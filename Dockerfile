FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app
COPY . .
RUN npm install

# Puerto para Render
ENV N8N_PORT=10000
EXPOSE 10000

# Usamos la ruta completa donde n8n guarda node
CMD ["/usr/local/bin/node", "index_receptor.js"]
