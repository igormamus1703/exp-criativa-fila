import express from 'express';

// Importa todas as funções que criam os roteadores
import createUserRouter from './userRoutes.js';
import createDoctorRouter from './doctorRoutes.js';
import createPatientRouter from './patientRoutes.js';
import createQueueRouter from './queueRoutes.js';

// A função principal que irá construir e unificar todas as rotas da API
export default function createApiRouter(pool, cache, sendNotificationEmail) {
  const router = express.Router();

  // Cria e utiliza cada roteador, passando as dependências necessárias
  const userRoutes = createUserRouter(pool);
  router.use(userRoutes);

  const doctorRoutes = createDoctorRouter(pool);
  router.use(doctorRoutes);

  const patientRoutes = createPatientRouter(pool, cache);
  router.use(patientRoutes);
  
  const queueRoutes = createQueueRouter(pool, cache, sendNotificationEmail);
  router.use(queueRoutes);

  // Adicionamos a rota de health-check aqui para centralizar todas as rotas da API
  router.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

  return router;
}