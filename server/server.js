import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import { sendNotificationEmail } from './emailConfig.js';

// Importações para servir o frontend
import path from 'path';
import { fileURLToPath } from 'url';

// Importa o construtor principal de rotas da API
import createApiRouter from './routes/index.js';

// --- CONFIGURAÇÃO INICIAL E BANCO DE DADOS ---
const app = express();
const pool = mysql.createPool(process.env.DATABASE_URL);

// Teste de conexão ao banco
(async () => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS now');
    console.log('🔌 Connected to DB at:', rows[0].now);
  } catch (err) {
    console.error('❌ DB connection error:', err);
  }
})();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());


// --- LÓGICA DE CACHE DA APLICAÇÃO ---
let filaEmCache = [];
let versaoDaFila = 0;

async function atualizarCacheDaFila() {
  try {
    const sql = `
      SELECT 
        qe.*,
        p.name, p.email, p.phone, p.cpf, p.gender, p.birth_date
      FROM queue_entries qe
      INNER JOIN patients p ON qe.patient_id = p.id
      WHERE qe.status = 'waiting'
      ORDER BY qe.is_priority DESC, qe.created_at ASC
    `;
    const [rows] = await pool.query(sql);
    filaEmCache = rows;
    versaoDaFila++;
    console.log(`[Cache] Fila atualizada para a versão ${versaoDaFila}. ${filaEmCache.length} pessoas esperando.`);
  } catch (err) {
    console.error('[Cache] Erro ao atualizar o cache da fila:', err);
  }
}

const getFilaEmCache = () => filaEmCache;
const getVersaoDaFila = () => versaoDaFila;

// Agrupa as dependências para passar para os roteadores
const cacheFuncs = { atualizarCacheDaFila, getFilaEmCache, getVersaoDaFila };


// --- ROTAS DA API ---
// Cria o roteador principal da API passando todas as dependências necessárias
const apiRouter = createApiRouter(pool, cacheFuncs, sendNotificationEmail);
// Usa o roteador principal para todos os caminhos que começam com /api
app.use('/api', apiRouter);


// --- CÓDIGO PARA SERVIR O FRONTEND ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../build')));

// --- ROTA "CATCH-ALL" ---
// Qualquer requisição que não seja para a API, serve o site React.
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  await atualizarCacheDaFila(); // Carga inicial do cache
  console.log(`🚀 Server rodando na porta ${PORT}`);
});