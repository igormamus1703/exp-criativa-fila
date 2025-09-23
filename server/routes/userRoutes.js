import express from 'express';
import bcrypt from 'bcryptjs';

// A função abaixo recebe 'pool' como um argumento do server.js
// e retorna o roteador pronto.
export default function createUserRouter(pool) {
  const router = express.Router();

  // Endpoint para criar um novo usuário (seja admin, doctor ou patient)
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

  // Endpoint para autenticar um usuário e retornar seu id e role
  router.post('/auth/login', async (req, res) => {
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

  return router;
}