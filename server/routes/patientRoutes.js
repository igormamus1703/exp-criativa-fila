import express from 'express';

// Padronizado: A função agora recebe o objeto 'cache' completo.
export default function createPatientRouter(pool, cache) {
  // A função necessária é extraída de dentro do objeto cache.
  const { atualizarCacheDaFila } = cache;
  const router = express.Router();

  // Endpoint para registrar os dados de um novo paciente
  router.post('/patients', async (req, res) => {
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

  // Endpoint para verificar se um usuário já tem um perfil de paciente associado
  router.get('/patients/byuser', async (req, res) => {
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
  
  // Endpoint para o admin cadastrar um paciente e já colocá-lo na fila
  router.post('/patients/admin', async (req, res) => {
    const { name, email, phone, birth_date, cpf, is_priority = false } = req.body;
    if (!name || !cpf) {
      return res.status(400).json({ error: 'Nome e CPF são obrigatórios.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [patientResult] = await connection.query(
        `INSERT INTO patients (name, email, phone, birth_date, cpf) VALUES (?, ?, ?, ?, ?)`,
        [name, email || null, phone || null, birth_date || null, cpf]
      );
      const newPatientId = patientResult.insertId;

      await connection.query(
        `INSERT INTO queue_entries (patient_id, is_priority) VALUES (?, ?)`,
        [newPatientId, is_priority]
      );

      await connection.commit();
      await atualizarCacheDaFila();
      res.status(201).json({ message: 'Paciente cadastrado e enfileirado com sucesso!' });

    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Erro ao cadastrar e enfileirar paciente:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Um paciente com este CPF já existe.' });
      }
      res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
      if (connection) connection.release();
    }
  });

  // Endpoint para buscar a anamnese de um paciente específico
  router.get('/patients/:id/anamnesis', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query('SELECT * FROM anamnese WHERE patient_id = ?', [id]);
      res.json(rows);
    } catch (err){
      console.error('Erro ao buscar anamnese:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
