import express from 'express';
import { exec } from 'child_process';
import makeWASocket, { 
    useMultiFileAuthState, 
    downloadContentFromMessage, 
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import fs from 'fs';
import axios from 'axios';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCodeImage from 'qrcode';
import { Boom } from '@hapi/boom';
import httpProxy from 'http-proxy';

// --- 1. CONFIGURACIÓN DEL SERVIDOR Y PROXY ---
const app = express();
const proxy = httpProxy.createProxyServer({});
const port = process.env.PORT || 10000;
let ultimoQR = "";

// EL PUENTE MAESTRO CORREGIDO
app.all('/n8n*', (req, res) => {
    // 1. Quitamos /n8n de la ruta para que n8n interno lo entienda
    let newUrl = req.url.replace('/n8n', '');
    if (newUrl === '') newUrl = '/';
    req.url = newUrl;

    // 2. Redirigimos al puerto 10001
    proxy.web(req, res, { 
        target: 'http://localhost:10001',
        changeOrigin: true
    }, (e) => {
        console.error("Proxy error:", e.message);
        res.status(502).send("n8n está iniciando... recarga en 15 segundos.");
    });
});

app.get('/', (req, res) => res.send('Sistema CARBAO Activo 🚀 - Ve a /n8n/ para configurar'));

// RUTA PARA EL QR
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.send(`<body><h2>Esperando QR...</h2><script>setTimeout(()=>location.reload(),5000)</script></body>`);
    }
    try {
        const qrImage = await QRCodeImage.toDataURL(ultimoQR);
        res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                <h2>Vincular WhatsApp CARBAO</h2>
                <img src="${qrImage}" style="width:300px; border:10px solid white; border-radius:10px;">
                <script>setTimeout(() => location.reload(), 20000);</script>
            </body>
        `);
    } catch (err) { res.status(500).send("Error QR"); }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor CARBAO en puerto ${port}`);
    iniciarTodo();
});

// --- 2. LÓGICA DE ARRANQUE ---
function iniciarTodo() {
    console.log("🚀 Iniciando n8n...");
    // n8n start hereda las variables del Dockerfile
    exec('n8n start', (err, stdout, stderr) => {
        if (err) console.error(`Error n8n: ${err}`);
    });
    startReceptor();
}

// --- 3. WHATSAPP ---
const ID_GRUPO = '120363361803863216@g.us';
const PROCESADOS_FILE = './DATA/procesados.json';
// Nota: al usar N8N_PATH=/n8n/, la URL del webhook interna cambia
const N8N_WEBHOOK = 'http://localhost:10001/n8n/webhook/071685b6-7efd-4353-9b9e-ce4594fd164e'; 

if (!fs.existsSync('./DATA')) fs.mkdirSync('./DATA');
let procesados = fs.existsSync(PROCESADOS_FILE) ? JSON.parse(fs.readFileSync(PROCESADOS_FILE, 'utf-8')) : [];
const queue = [];
let isProcessing = false;

async function startReceptor() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sistema Carbao", "Chrome", "1.0.0"],
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (m.key.remoteJid === ID_GRUPO) {
                if (m.message?.imageMessage || m.message?.documentMessage) {
                    queue.push(m);
                    if (!isProcessing) processQueue();
                }
            }
        }
    });

    async function processQueue() {
        if (queue.length === 0) { isProcessing = false; return; }
        isProcessing = true;
        const m = queue.shift();
        const content = m.message?.imageMessage || m.message?.documentMessage;
        try {
            const type = m.message?.imageMessage ? 'image' : 'document';
            const stream = await downloadContentFromMessage(content, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            
            await axios.post(N8N_WEBHOOK, {
                fileName: `CARBAO_${Date.now()}`,
                fileData: buffer.toString('base64'),
                mimeType: content.mimetype,
                sender: m.pushName || 'User'
            });
            console.log("✅ Enviado a n8n");
        } catch (e) { console.error("❌ Error enviando:", e.message); }
        setTimeout(processQueue, 2000);
    }

    sock.ev.on('connection.update', (u) => {
        if (u.qr) ultimoQR = u.qr;
        if (u.connection === 'open') {
            ultimoQR = "";
            console.log('✅ WhatsApp Conectado');
        }
        if (u.connection === 'close') {
            if ((new Boom(u.lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(startReceptor, 5000);
            }
        }
    });
}
