FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

# Usamos apt-get porque n8n corre sobre Debian, no Alpine
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

# Instalamos las librerías de Node
RUN npm install

# Puerto para Render
ENV N8N_PORT=10000
EXPOSE 10000

# Comando directo para arrancar tu receptor
CMD ["node", "index_receptor.js"]
