const { exec } = require('child_process');
// Esto arranca n8n en segundo plano para que tú puedas usar la interfaz
exec('n8n', (err) => {
    if (err) console.error('Error al arrancar n8n:', err);
});

console.log('🚀 [RECEPTOR CARBAO] Iniciando sistema...');
import makeWASocket, { 
    useMultiFileAuthState, 
    downloadContentFromMessage, 
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import fs from 'fs';
import axios from 'axios';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';

// --- CONFIGURACIÓN ---
const ID_GRUPO = '120363361803863216@g.us';
const PROCESADOS_FILE = './DATA/procesados.json';
const N8N_WEBHOOK = 'http://localhost:10000/webhook/071685b6-7efd-4353-9b9e-ce4594fd164e';

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
    console.log('🚀 [RECEPTOR] Iniciando sistema de vigilancia CARBAO...');
    
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const socketIDS = (typeof makeWASocket === 'function') ? makeWASocket : makeWASocket.default;

    const sock = socketIDS({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sistema Contabilidad CARBAO", "Chrome", "1.0.0"], 
        syncFullHistory: true, // Esto es vital para leer lo que pasó mientras no estabas
        shouldSyncHistoryMessage: () => true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
    });

    sock.ev.on('creds.update', saveCreds);

    // MEJORA: Este evento captura los mensajes que WhatsApp envía en ráfaga al conectar (mensajes "offline")
    sock.ev.on('messaging-history.set', async ({ messages }) => {
        console.log(`⏳ [HISTORIAL] Recuperando ${messages.length} mensajes recibidos mientras el bot estaba offline...`);
        for (const m of messages) {
            await analizarMensaje(m);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // 'notify' son mensajes nuevos, 'append' suelen ser mensajes de sistema o ráfagas de historial
        if (type !== 'notify' && type !== 'append') return;
        for (const m of messages) {
            await analizarMensaje(m);
        }
    });

    async function analizarMensaje(m) {
        const msgId = m.key?.id;
        const from = m.key?.remoteJid;
        // Si no tiene timestamp (mensajes muy viejos de historial), usamos el actual pero con precaución
        const timestamp = m.messageTimestamp ? (m.messageTimestamp * 1000) : Date.now();
        const doceHorasAtras = Date.now() - (12 * 60 * 60 * 1000); // Bajamos a 12h para no saturar al reconectar

        if (from === ID_GRUPO && esNuevoMensaje(msgId) && timestamp > doceHorasAtras) {
            const content = m.message?.imageMessage || m.message?.documentMessage;
            if (content) {
                console.log(`📥 Comprobante detectado (ID: ${msgId})`);
                queue.push(m);
                if (!isProcessing) processQueue();
            }
        }
    }

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
        setTimeout(processQueue, 2000); // Un poco más rápido para procesar ráfagas de historial
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('⚠️ [AVISO] Se requiere nuevo escaneo QR (La sesión expiró o se cerró):');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ [SISTEMA] ¡CONECTADO EXITOSAMENTE!');
            console.log('🔍 Monitoreando el grupo CARBAO...');
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`🔌 Conexión cerrada. Razón: ${reason}`);
            
            // Si el error es 401 o 440, la sesión murió. Si no, reintentamos rápido.
            if (reason !== DisconnectReason.loggedOut) {
                const retryDelay = 5000; // 5 segundos es el punto dulce para no ser baneado
                console.log(`🔄 Reconectando en ${retryDelay/1000} segundos para no perder mensajes...`);
                setTimeout(startReceptor, retryDelay);
            } else {
                console.log('❌ Sesión cerrada permanentemente. Se requiere que la administradora escanee de nuevo.');
            }
        }
    });
}

startReceptor().catch(err => console.error("CRITICAL ERROR:", err));
