# 1. Usamos n8n como base
FROM n8nio/n8n:latest

USER root

# 2. Carpeta de trabajo
WORKDIR /home/node/app

# 3. Copiamos tus archivos de CARBAO
COPY . .

# 4. Instalamos las librerías del receptor
RUN npm install

# 5. Puerto de Render
ENV N8N_PORT=10000
EXPOSE 10000

# 6. Lanzamos n8n en segundo plano y luego el receptor
ENTRYPOINT ["/usr/local/bin/node", "index_receptor.js"]
