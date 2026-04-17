# 1. Usamos la imagen de n8n (que ya trae Node.js incluido)
FROM n8nio/n8n:latest

USER root

# 2. Instalamos herramientas necesarias para procesar archivos de WhatsApp
RUN apt-get update && apt-get install -y ffmpeg libvips-dev && apt-get clean

# 3. Creamos la carpeta para el sistema de CARBAO
WORKDIR /home/node/app

# 4. Copiamos tus archivos (index_receptor.js, package.json)
COPY . .

# 5. Instalamos las librerías de tu receptor
RUN npm install

# 6. Configuramos el puerto que pide Render
ENV N8N_PORT=10000
EXPOSE 10000

# 7. Ejecutamos n8n y tu script al mismo tiempo
CMD ["sh", "-c", "n8n & node index_receptor.js"]
