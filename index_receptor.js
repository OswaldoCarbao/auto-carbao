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
import qrcodeTerminal from 'qrcode-terminal'; // Renombrado para evitar conflicto
import QRCodeImage from 'qrcode'; // Librería para generar el link web
import { Boom } from '@hapi/boom';

// --- 1. CONFIGURACIÓN DEL SERVIDOR Y RUTA QR ---
const app = express();
import httpProxy from 'http-proxy';
const proxy = httpProxy.createProxyServer({});

// El "Puente" para entrar a n8n
app.all('/n8n*', (req, res) => {
    // Limpiamos la URL para que n8n no se confunda
    req.url = req.url.replace('/n8n', ''); 
    proxy.web(req, res, { target: 'http://localhost:10001' }, (e) => {
        res.status(500).send("n8n aún está cargando...");
    });
});
const port = process.env.PORT || 10000;
let ultimoQR = ""; // Aquí guardaremos el string del QR

app.get('/', (req, res) => res.send('Sistema CARBAO Activo 🚀 - Revisa /qr para vincular'));

// NUEVA RUTA: Para ver el QR como imagen y poder escanearlo fácil
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h2>El QR aún no se ha generado o ya estás conectado.</h2>
                <p>Si no estás conectado, espera unos segundos y refresca la página.</p>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </body>
        `);
    }
    
    try {
        const qrImage = await QRCodeImage.toDataURL(ultimoQR);
        res.send(`
            <html>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                    <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,0.1);text-align:center;">
                        <h2 style="color:#1a73e8;">Vincular WhatsApp CARBAO</h2>
                        <img src="${qrImage}" style="width:300px;height:300px;border:1px solid #ddd;padding:10px;border-radius:10px;">
                        <p style="color:#555;margin-top:15px;">Abre WhatsApp > Dispositivos vinculados > Vincular.</p>
                        <p style="font-size:12px;color:#999;">Esta página se refresca cada 20 segundos</p>
                    </div>
                    <script>setTimeout(() => location.reload(), 20000);</script>
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send("Error generando imagen QR");
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor de salud escuchando en puerto ${port}`);
    iniciarTodo();
});

// --- 2. LÓGICA DE ARRANQUE ---
function iniciarTodo() {
    console.log("🚀 Iniciando n8n en segundo plano...");
    exec('n8n start', (err, stdout, stderr) => {
        if (err) console.error(`Error n8n: ${err}`);
        console.log(stdout);
    });

    startReceptor();
}

// --- 3. CONFIGURACIÓN WHATSAPP ---
const ID_GRUPO = '120363361803863216@g.us';
const PROCESADOS_FILE = './DATA/procesados.json';
const N8N_WEBHOOK = 'http://localhost:10001/webhook/071685b6-7efd-4353-9b9e-ce4594fd164e';

if (!fs.existsSync('./DATA')) fs.mkdirSync('./DATA');

let procesados = fs.existsSync(PROCESADOS_FILE) 
    ? JSON.parse(fs.readFileSync(PROCESADOS_FILE, 'utf-8')) 
    : [];

const queue = [];
let isProcessing = false;

function esNuevoMensaje(id) {
    if (!id) return false;
    if (!procesados.includes(id)) {
        procesados.push(id);
        if (procesados.length > 5000) procesados.shift(); 
        fs.writeFileSync(PROCESADOS_FILE, JSON.stringify(procesados));
        return true;
    }
    return false;
}

async function startReceptor() {
    console.log('🔍 [RECEPTOR] Iniciando vigilancia de comprobantes...');
    
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sistema Contabilidad CARBAO", "Chrome", "1.0.0"], 
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;
        for (const m of messages) {
            const msgId = m.key?.id;
            const from = m.key?.remoteJid;
            const timestamp = m.messageTimestamp ? (m.messageTimestamp * 1000) : Date.now();
            const doceHorasAtras = Date.now() - (12 * 60 * 60 * 1000);

            if (from === ID_GRUPO && esNuevoMensaje(msgId) && timestamp > doceHorasAtras) {
                const content = m.message?.imageMessage || m.message?.documentMessage;
                if (content) {
                    console.log(`📥 Comprobante detectado (ID: ${msgId})`);
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
            const ext = m.message?.imageMessage ? 'jpg' : 'pdf';
            const fileName = `CARBAO_${Date.now()}.${ext}`;
            const type = m.message?.imageMessage ? 'image' : 'document';
            
            const stream = await downloadContentFromMessage(content, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await axios.post(N8N_WEBHOOK, {
                fileName,
                fileData: buffer.toString('base64'),
                mimeType: content.mimetype,
                sender: m.pushName || 'Admin',
                msgId: m.key.id
            });
            console.log(`✅ ENVIADO A N8N: ${fileName}`);
        } catch (e) {
            console.error("❌ Error enviando a n8n:", e.message);
        }
        setTimeout(processQueue, 2000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            ultimoQR = qr; // Guardamos el QR para la ruta web
            console.log('⚠️ [AVISO] Nuevo QR generado. Míralo en: https://auto-carbao.onrender.com/qr');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'open') {
            ultimoQR = ""; // Limpiamos el QR al conectar
            console.log('✅ [WHATSAPP] Conectado y listo.');
        }

        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startReceptor, 5000);
        }
    });
}
