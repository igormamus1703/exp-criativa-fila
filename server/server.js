import bcrypt from 'bcryptjs';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import { sendNotificationEmail } from './emailConfig.js';

// Importações necessárias para servir o frontend
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURAÇÃO INICIAL ---
const app = express();
console.log('URL do banco:', process.env.DATABASE_URL);
const pool = mysql.createPool(process.env.DATABASE_URL || 'mysql://root:1234@localhost:3306/exp-criativa-fila');

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
app.use(cors()); // Configuração de CORS simples, pois o app é servido do mesmo domínio.
app.use(express.json());


// --- CÓDIGO PARA SERVIR O FRONTEND ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// O Express vai servir os arquivos estáticos da pasta 'build' do React
app.use(express.static(path.join(__dirname, '../build')));


// --- ROTAS DA API (ORGANIZADAS COM PREFIXO /api) ---
const apiRouter = express.Router(); // Criamos um roteador dedicado para a API

// Health-check
apiRouter.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// MUDANÇA: Todas as rotas agora usam 'apiRouter' em vez de 'app'
apiRouter.post('/users', async (req, res) => {
  const { login, senha, role } = req.body;
  if (!login || !senha || !role) return res.status(400).json({ error: 'Dados incompletos' });
  try {
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await pool.query('INSERT INTO usuarios (login, senha, role) VALUES (?, ?, ?)', [login, hash, role]);
    res.status(201).json({ id: result.insertId, login, role }); 
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Login já existe' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) return res.status(400).json({ error: 'Dados incompletos' });
  try {
    const [rows] = await pool.query('SELECT id, senha, role FROM usuarios WHERE login = ?', [login]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
      const user = rows[0];
      const match = await bcrypt.compare(senha, user.senha);
    if (!match) return res.status(401).json({ error: 'Credenciais inválidas' });
    res.json({ user_id: user.id, role: user.role });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Todas as outras rotas seguem o mesmo padrão, usando 'apiRouter'
apiRouter.post('/patients', async (req, res) => {
  const { name, email, phone, birth_date, insurance_provider, insurance_number, cpf, user_id } = req.body;
  if (!cpf) return res.status(400).json({ error: 'CPF obrigatório' });
  try {
    const [result] = await pool.query(`INSERT INTO patients (name, email, phone, birth_date, insurance_provider, insurance_number, cpf, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [name, email, phone, birth_date, insurance_provider, insurance_number, cpf, user_id || null]);
    const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar paciente:', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/patients/byuser', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id não fornecido' });
  try {
    const [rows] = await pool.query('SELECT * FROM patients WHERE user_id = ?', [user_id]);
    if (rows.length === 0) return res.json({ exists: false });
    res.json({ exists: true, patient: rows[0] });
  } catch (err) {
    console.error('Erro ao buscar paciente por usuário:', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/queue', async (req, res) => {
  const { cpf, is_priority = false } = req.body;
  if (!cpf) return res.status(400).json({ error: 'CPF não fornecido' });
  try {
    // MUDANÇA: Buscamos também a data de nascimento (birth_date)
    const [pRows] = await pool.query('SELECT id, birth_date FROM patients WHERE cpf = ?', [cpf]);

    if (pRows.length === 0) {
      return res.status(404).json({ error: 'Paciente não cadastrado' });
    }

    const patient = pRows[0];

    // --- LÓGICA DE PRIORIDADE POR IDADE ---
    let finalPriority = is_priority; // Começa com a prioridade vinda da requisição (se houver)
    if (patient.birth_date) {
      const birthDate = new Date(patient.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      // Se a pessoa tem 60 anos ou mais, ela recebe prioridade
      if (age >= 60) {
        finalPriority = true; // ou 1
      }
    }
    // --- FIM DA LÓGICA ---

    const [result] = await pool.query(
      'INSERT INTO queue_entries (patient_id, is_priority) VALUES (?, ?)',
      [patient.id, finalPriority] // Usa a prioridade final calculada
    );
    const [rows] = await pool.query('SELECT * FROM queue_entries WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao entrar na fila:', err);
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT NOVO: Listar fila (somente status = waiting)
// ajustei a consulta para retornar os dados relevantes do paciente
//ta funcionando suave
apiRouter.get('/queue', async (req, res) => {
  try {
    const { priority } = req.query;
    let sql = `
      SELECT 
        qe.*,
        p.name,
        p.email,
        p.phone,
        p.cpf,
        p.gender,
        p.birth_date  
      FROM queue_entries qe
      INNER JOIN patients p ON qe.patient_id = p.id
      WHERE qe.status = ?
    `;
    const params = ['waiting'];

    if (priority === 'true' || priority === 'false') {
      sql += ' AND qe.is_priority = ?';
      params.push(priority === 'true');
    }

    sql += ' ORDER BY qe.is_priority DESC, qe.created_at ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar fila:', err);
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT NOVO: Atender paciente na fila
apiRouter.post('/queue/:id/attend', async (req, res) => {
  const { id } = req.params; // ID da entrada na fila (queue_entries)
  try {
    // Primeiro, buscar os dados do paciente
    const [patientData] = await pool.query(
      `SELECT p.email, p.name 
       FROM queue_entries qe 
       JOIN patients p ON qe.patient_id = p.id 
       WHERE qe.id = ?`,
      [id]
    );

    if (patientData.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado na fila.' });
    }

    // Atualizar o status do paciente
    const [result] = await pool.query(
      "UPDATE queue_entries SET status = 'attending', served_at = NOW() WHERE id = ? AND status = 'waiting'",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado na fila de espera ou já em atendimento.' });
    }

    // Se o paciente tem email, tenta enviar notificação
    let emailSent = false;
    if (patientData[0]?.email) {
      emailSent = await sendNotificationEmail(patientData[0].email, patientData[0].name);
    }

    res.json({ 
      message: 'Atendimento iniciado com sucesso.',
      notification: emailSent ? 'Email enviado' : 'Email não enviado'
    });
  } catch (err) {
    console.error('Erro ao iniciar atendimento:', err);
    res.status(500).json({ error: 'Erro interno ao iniciar atendimento.' });
  }
});

//ENDPOINT: GET na anamnese do paciente atual
apiRouter.get('/queue/:id/anamnesis', async (req, res) => {
  const { id } = req.params;
  try {
    // Primeiro, vamos pegar o patient_id correto da fila
    const [queueEntry] = await pool.query(
      'SELECT patient_id FROM queue_entries WHERE id = ?',
      [id]
    );
    
    if (queueEntry.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado na fila' });
    }

    const patientId = queueEntry[0].patient_id;
    const [rows] = await pool.query('SELECT * FROM anamnese WHERE patient_id = ?', [patientId]);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar anamnese:', err);
    res.status(500).json({ error: err.message });
  }
});

//ENDPOINT: POST para criar anamnese
apiRouter.post('/queue/:id/anamnesis', async (req, res) => {
  const { id } = req.params;
  const {
    queixa_principal,
    historia_da_doenca_atual,
    historico_medico,
    medicacoes_em_uso,
    alergias,
    historico_familiar,
    habitos_de_vida,
    sintomas_rev_sistemas,
    outras_informacoes
  } = req.body;

  if (!queixa_principal) {
    return res.status(400).json({ message: 'Queixa principal é obrigatória.' });
  }

  try {
    // Primeiro, vamos pegar o patient_id correto da fila
    const [queueEntry] = await pool.query(
      'SELECT patient_id FROM queue_entries WHERE id = ?',
      [id]
    );
    
    if (queueEntry.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado na fila' });
    }

    const patientId = queueEntry[0].patient_id;

    const [resultado] = await pool.query(
      `INSERT INTO anamnese (
         patient_id,
         queixa_principal,
         historia_da_doenca_atual,
         historico_medico,
         medicacoes_em_uso,
         alergias,
         historico_familiar,
         habitos_de_vida,
         sintomas_rev_sistemas,
         outras_informacoes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        queixa_principal,
        historia_da_doenca_atual || null,
        historico_medico || null,
        medicacoes_em_uso || null,
        alergias || null,
        historico_familiar || null,
        habitos_de_vida || null,
        sintomas_rev_sistemas || null,
        outras_informacoes || null
      ]
    );

    return res.status(201).json({ 
      message: 'Anamnese criada com sucesso.', 
      id: resultado.insertId 
    });
  } catch (erro) {
    console.error('Erro ao criar anamnese:', erro);
    return res.status(500).json({ message: 'Erro interno ao criar anamnese.' });
  }
});

//ENDPOINT: PUT para atualizar anamnese
apiRouter.put('/queue/:id/anamnesis', async (req, res) => {
  const { id } = req.params;
  const {
    queixa_principal,
    historia_da_doenca_atual,
    historico_medico,
    medicacoes_em_uso,
    alergias,
    historico_familiar,
    habitos_de_vida,
    sintomas_rev_sistemas,
    outras_informacoes
  } = req.body;

  if (!queixa_principal) {
    return res.status(400).json({ message: 'Queixa principal é obrigatória.' });
  }

  try {
    // Primeiro, vamos pegar o patient_id correto da fila
    const [queueEntry] = await pool.query(
      'SELECT patient_id FROM queue_entries WHERE id = ?',
      [id]
    );
    
    if (queueEntry.length === 0) {
      return res.status(404).json({ error: 'Paciente não encontrado na fila' });
    }

    const patientId = queueEntry[0].patient_id;

    const [resultado] = await pool.query(
      `UPDATE anamnese SET
         queixa_principal = ?,
         historia_da_doenca_atual = ?,
         historico_medico = ?,
         medicacoes_em_uso = ?,
         alergias = ?,
         historico_familiar = ?,
         habitos_de_vida = ?,
         sintomas_rev_sistemas = ?,
         outras_informacoes = ?,
         updated_at = NOW()
       WHERE patient_id = ?`,
      [
        queixa_principal,
        historia_da_doenca_atual || null,
        historico_medico || null,
        medicacoes_em_uso || null,
        alergias || null,
        historico_familiar || null,
        habitos_de_vida || null,
        sintomas_rev_sistemas || null,
        outras_informacoes || null,
        patientId
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ message: 'Anamnese não encontrada.' });
    }

    return res.json({ 
      message: 'Anamnese atualizada com sucesso.'
    });
  } catch (erro) {
    console.error('Erro ao atualizar anamnese:', erro);
    return res.status(500).json({ message: 'Erro interno ao atualizar anamnese.' });
  }
});

// NOVO ENDPOINT: Remover/cancelar um paciente da fila (Soft Delete)
apiRouter.delete('/queue/:id', async (req, res) => {
  const { id } = req.params; // Este é o ID da entrada na tabela queue_entries

  if (!id) {
    return res.status(400).json({ error: 'ID da entrada na fila não fornecido.' });
  }

  try {
    // Em vez de um DELETE, fazemos um UPDATE no status do registro.
    // Isso preserva o histórico de quem esteve na fila.
    const [result] = await pool.query(
      "UPDATE queue_entries SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
      [id]
    );

    // Verifica se alguma linha foi de fato atualizada
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Entrada na fila não encontrada com o ID fornecido.' });
    }

    // Retorna sucesso
    res.status(200).json({ message: 'Paciente removido da fila com sucesso.' });
    
  } catch (err) {
    console.error('Erro ao remover paciente da fila:', err);
    res.status(500).json({ error: 'Erro interno do servidor ao tentar remover da fila.' });
  }
});

apiRouter.post('/patients/admin', async (req, res) => {
  // Dados do paciente e da fila (prioridade é opcional)
  const { name, email, phone, birth_date, cpf, is_priority = false } = req.body;

  // Validação básica
  if (!name || !cpf) {
    return res.status(400).json({ error: 'Nome e CPF são obrigatórios.' });
  }

  let connection;
  try {
    // Obter uma conexão do pool para usar em uma transação
    connection = await pool.getConnection();
    await connection.beginTransaction(); // Inicia a transação

    // Passo 1: Inserir o novo paciente na tabela 'patients'
    const [patientResult] = await connection.query(
      `INSERT INTO patients (name, email, phone, birth_date, cpf) VALUES (?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, birth_date || null, cpf]
    );
    const newPatientId = patientResult.insertId;

    // Passo 2: Usar o ID do paciente recém-criado para inseri-lo na fila
    await connection.query(
      `INSERT INTO queue_entries (patient_id, is_priority) VALUES (?, ?)`,
      [newPatientId, is_priority]
    );

    // Passo 3: Se ambas as operações foram bem-sucedidas, confirma a transação
    await connection.commit();

    // Retorna uma resposta de sucesso
    res.status(201).json({ message: 'Paciente cadastrado e enfileirado com sucesso!' });

  } catch (err) {
    // Se ocorrer qualquer erro, desfaz todas as operações da transação
    if (connection) await connection.rollback();

    console.error('Erro ao cadastrar e enfileirar paciente:', err);
    // Trata erro de CPF duplicado
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Um paciente com este CPF já existe.' });
    }
    // Retorna erro genérico para outros problemas
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    // Garante que a conexão seja liberada de volta para o pool
    if (connection) connection.release();
  }
});

//ENDPOINT: GET na anamnese do paciente
apiRouter.get('/patients/:id/anamnesis', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM anamnese WHERE patient_id = ?', [id]);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar anamnese:', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/queue/:id/finish', async (req, res) => {
  const { id } = req.params; // ID da entrada na fila (queue_entries)
  try {
    // Apenas muda o status para 'attended'. O served_at já foi definido no início.
    const [result] = await pool.query(
      "UPDATE queue_entries SET status = 'attended' WHERE id = ? AND status = 'attending'",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Nenhum atendimento em andamento encontrado para este paciente.' });
    }

    res.json({ message: 'Atendimento finalizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao finalizar atendimento:', err);
    res.status(500).json({ error: 'Erro interno ao finalizar atendimento.' });
  }
});

apiRouter.get('/queue/current', async (req, res) => {
  try {
    const sql = `
      SELECT 
        qe.*,
        p.name, p.email, p.phone, p.cpf, p.gender, p.birth_date
      FROM queue_entries qe
      INNER JOIN patients p ON qe.patient_id = p.id
      WHERE qe.status = 'attending'
      ORDER BY qe.served_at DESC
      LIMIT 1
    `;
    const [rows] = await pool.query(sql);
    // Retorna o paciente encontrado ou null se não houver nenhum
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Erro ao buscar paciente em atendimento:', err);
    res.status(500).json({ error: err.message });
  }
});

// NOVO ENDPOINT: Listar todos os médicos
apiRouter.get('/doctors', async (req, res) => {
  try {
    // Buscamos no banco todos os usuários cuja 'role' é 'doctor'
    const [doctors] = await pool.query(
      "SELECT id, login FROM usuarios WHERE role = 'doctor'"
    );

    // Bônus: Vamos formatar o nome do médico a partir do email para ficar mais amigável no card.
    // Ex: 'dr.felipe.boaretto@email.com' vira 'Dr. Felipe Boaretto'
    const formattedDoctors = doctors.map(doc => {
      const namePart = doc.login.split('@')[0]; // Pega a parte antes do @
      const cleanedName = namePart.replace(/[._]/g, ' '); // Troca pontos e underlines por espaço
      const capitalizedName = cleanedName.split(' ')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
      return {
        id: doc.id,
        name: capitalizedName
      };
    });

    res.json(formattedDoctors);
  } catch (error) {
    console.error('Erro ao buscar médicos:', error);
    res.status(500).json({ message: 'Erro interno ao buscar médicos.' });
  }
});



// LINHA MÁGICA: Diz ao Express para usar nosso roteador para qualquer caminho que comece com /api
app.use('/api', apiRouter);

// --- ROTA "CATCH-ALL" (DEVE SER A ÚLTIMA ROTA DE TODAS) ---
// Qualquer requisição que não seja para a API (não começa com /api) será tratada pelo React.
if (process.env.NODE_ENV === 'production') {
  // Qualquer requisição que não seja para a API, serve o site React.
  app.get('*', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server rodando na porta ${PORT}`));