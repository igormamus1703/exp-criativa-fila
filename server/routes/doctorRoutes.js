import express from 'express';

// A função recebe 'pool' como um argumento do server.js e retorna o roteador.
export default function createDoctorRouter(pool) {
  const router = express.Router();

  // Endpoint para listar todos os usuários com a role 'doctor'
  router.get('/doctors', async (req, res) => {
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

  return router;
}