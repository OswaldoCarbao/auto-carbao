FROM n8nio/n8n:latest

# Cambiamos a root solo para asegurar permisos de carpeta
USER root
WORKDIR /home/node/app

# Copiamos solo los archivos necesarios
COPY package*.json ./
COPY index_receptor.js ./

# Instalación limpia
RUN npm install --production

# Puerto de Render
ENV N8N_PORT=10000
EXPOSE 10000

# Ejecutamos con node directamente
CMD ["node", "index_receptor.js"]
