import express from 'express';

export default function createQueueRouter(pool, cache, sendNotificationEmail) {
  const router = express.Router();
  const { atualizarCacheDaFila, getFilaEmCache, getVersaoDaFila } = cache;

  router.post('/queue', async (req, res) => {
    const { cpf, is_priority = false } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF não fornecido' });
    try {
      const [pRows] = await pool.query('SELECT id, birth_date FROM patients WHERE cpf = ?', [cpf]);

      if (pRows.length === 0) {
        return res.status(404).json({ error: 'Paciente não cadastrado' });
      }
      const patient = pRows[0];

      let finalPriority = is_priority;
      if (patient.birth_date) {
        const birthDate = new Date(patient.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age >= 60) {
          finalPriority = true;
        }
      }

      const [result] = await pool.query(
        'INSERT INTO queue_entries (patient_id, is_priority) VALUES (?, ?)',
        [patient.id, finalPriority]
      );
      const [rows] = await pool.query('SELECT * FROM queue_entries WHERE id = ?', [result.insertId]);
      await atualizarCacheDaFila();
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Erro ao entrar na fila:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/queue', (req, res) => {
    const etagDoCliente = req.get('If-None-Match');
    const versaoDaFila = getVersaoDaFila();
    if (etagDoCliente && etagDoCliente === String(versaoDaFila)) {
      return res.status(304).send();
    }
    res.set('ETag', String(versaoDaFila));
    res.json(getFilaEmCache());
  });

  router.get('/queue/current', async (req, res) => {
    try {
      const sql = `
        SELECT qe.*, p.name, p.email, p.phone, p.cpf, p.gender, p.birth_date
        FROM queue_entries qe
        INNER JOIN patients p ON qe.patient_id = p.id
        WHERE qe.status = 'attending'
        ORDER BY qe.served_at DESC
        LIMIT 1
      `;
      const [rows] = await pool.query(sql);
      res.json(rows[0] || null);
    } catch (err) {
      console.error('Erro ao buscar paciente em atendimento:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/queue/:id/attend', async (req, res) => {
    const { id } = req.params;
    try {
      const [patientData] = await pool.query(
        `SELECT p.email, p.name FROM queue_entries qe 
         JOIN patients p ON qe.patient_id = p.id WHERE qe.id = ?`,
        [id]
      );
      if (patientData.length === 0) {
        return res.status(404).json({ error: 'Paciente não encontrado na fila.' });
      }
      const [result] = await pool.query(
        "UPDATE queue_entries SET status = 'attending', served_at = NOW() WHERE id = ? AND status = 'waiting'",
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Paciente não encontrado na fila de espera ou já em atendimento.' });
      }
      let emailSent = false;
      if (patientData[0]?.email) {
        emailSent = await sendNotificationEmail(patientData[0].email, patientData[0].name);
      }
      await atualizarCacheDaFila();
      res.json({ 
        message: 'Atendimento iniciado com sucesso.',
        notification: emailSent ? 'Email enviado' : 'Email não enviado'
      });
    } catch (err) {
      console.error('Erro ao iniciar atendimento:', err);
      res.status(500).json({ error: 'Erro interno ao iniciar atendimento.' });
    }
  });

  router.post('/queue/:id/finish', async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await pool.query(
        "UPDATE queue_entries SET status = 'attended' WHERE id = ? AND status = 'attending'",
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Nenhum atendimento em andamento encontrado para este paciente.' });
      }
      await atualizarCacheDaFila();
      res.json({ message: 'Atendimento finalizado com sucesso.' });
    } catch (err) {
      console.error('Erro ao finalizar atendimento:', err);
      res.status(500).json({ error: 'Erro interno ao finalizar atendimento.' });
    }
  });

  router.delete('/queue/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'ID da entrada na fila não fornecido.' });
    }
    try {
      const [result] = await pool.query(
        "UPDATE queue_entries SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Entrada na fila não encontrada com o ID fornecido.' });
      }
      await atualizarCacheDaFila();
      res.status(200).json({ message: 'Paciente removido da fila com sucesso.' });
    } catch (err) {
      console.error('Erro ao remover paciente da fila:', err);
      res.status(500).json({ error: 'Erro interno do servidor ao tentar remover da fila.' });
    }
  });

  router.get('/queue/:id/anamnesis', async (req, res) => {
    const { id } = req.params;
    try {
      const [queueEntry] = await pool.query('SELECT patient_id FROM queue_entries WHERE id = ?', [id]);
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

  router.post('/queue/:id/anamnesis', async (req, res) => {
    const { id } = req.params;
    const {
      queixa_principal, historia_da_doenca_atual, historico_medico,
      medicacoes_em_uso, alergias, historico_familiar, habitos_de_vida,
      sintomas_rev_sistemas, outras_informacoes
    } = req.body;

    if (!queixa_principal) {
      return res.status(400).json({ message: 'Queixa principal é obrigatória.' });
    }

    try {
      const [queueEntry] = await pool.query('SELECT patient_id FROM queue_entries WHERE id = ?', [id]);
      if (queueEntry.length === 0) {
        return res.status(404).json({ error: 'Paciente não encontrado na fila' });
      }
      const patientId = queueEntry[0].patient_id;

      const [resultado] = await pool.query(
        `INSERT INTO anamnese (
          patient_id, queixa_principal, historia_da_doenca_atual, historico_medico,
          medicacoes_em_uso, alergias, historico_familiar, habitos_de_vida,
          sintomas_rev_sistemas, outras_informacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientId, queixa_principal, historia_da_doenca_atual || null,
          historico_medico || null, medicacoes_em_uso || null, alergias || null,
          historico_familiar || null, habitos_de_vida || null,
          sintomas_rev_sistemas || null, outras_informacoes || null
        ]
      );

      return res.status(201).json({ message: 'Anamnese criada com sucesso.', id: resultado.insertId });
    } catch (erro) {
      console.error('Erro ao criar anamnese:', erro);
      return res.status(500).json({ message: 'Erro interno ao criar anamnese.' });
    }
  });

  router.put('/queue/:id/anamnesis', async (req, res) => {
    const { id } = req.params;
    const {
      queixa_principal, historia_da_doenca_atual, historico_medico,
      medicacoes_em_uso, alergias, historico_familiar, habitos_de_vida,
      sintomas_rev_sistemas, outras_informacoes
    } = req.body;

    if (!queixa_principal) {
      return res.status(400).json({ message: 'Queixa principal é obrigatória.' });
    }

    try {
      const [queueEntry] = await pool.query('SELECT patient_id FROM queue_entries WHERE id = ?', [id]);
      if (queueEntry.length === 0) {
        return res.status(404).json({ error: 'Paciente não encontrado na fila' });
      }
      const patientId = queueEntry[0].patient_id;

      const [resultado] = await pool.query(
        `UPDATE anamnese SET
          queixa_principal = ?, historia_da_doenca_atual = ?, historico_medico = ?,
          medicacoes_em_uso = ?, alergias = ?, historico_familiar = ?, habitos_de_vida = ?,
          sintomas_rev_sistemas = ?, outras_informacoes = ?, updated_at = NOW()
        WHERE patient_id = ?`,
        [
          queixa_principal, historia_da_doenca_atual || null, historico_medico || null,
          medicacoes_em_uso || null, alergias || null, historico_familiar || null,
          habitos_de_vida || null, sintomas_rev_sistemas || null, outras_informacoes || null,
          patientId
        ]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ message: 'Anamnese não encontrada.' });
      }

      return res.json({ message: 'Anamnese atualizada com sucesso.' });
    } catch (erro) {
      console.error('Erro ao atualizar anamnese:', erro);
      return res.status(500).json({ message: 'Erro interno ao atualizar anamnese.' });
    }
  });

  return router;
}