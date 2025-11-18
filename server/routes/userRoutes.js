import express from 'express';
import bcrypt from 'bcryptjs';

export default function createUserRouter(pool) {
  const router = express.Router();

  // Endpoint para criar um novo usuário
  router.post('/users', async (req, res) => {
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

  // --- ALTERAÇÃO AQUI ---
  // Endpoint para autenticar um usuário
  router.post('/auth/login', async (req, res) => {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({ error: 'Dados incompletos' });
    try {
      // 1. Busca o usuário básico
      const [rows] = await pool.query('SELECT id, senha, role FROM usuarios WHERE login = ?', [login]);
      if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });

      const user = rows[0];
      const match = await bcrypt.compare(senha, user.senha);

      if (!match) return res.status(401).json({ error: 'Credenciais inválidas' });

      // 2. CORREÇÃO: Verifica se existe um paciente vinculado a este usuário
      let patientId = null;
      if (user.role === 'user') {
        const [pRows] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [user.id]);
        if (pRows.length > 0) {
          patientId = pRows[0].id;
        }
      }

      // 3. Retorna o patient_id junto (se existir)
      res.json({ 
        user_id: user.id, 
        role: user.role,
        patient_id: patientId 
      });

    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  return router;
}