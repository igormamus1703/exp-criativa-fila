import React, { useState, useEffect, useContext } from 'react'; // Adicionado useContext
import api from '../../services/api';
import RegisterPatient from './RegisterPatient';
import { motion } from 'framer-motion';
import { AuthContext } from '../../context/AuthContext'; // Importar o AuthContext
import '../styles/AdminDashboard.css';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext); // Obter o usuário (com token) do contexto
  const [queue, setQueue] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    try {
      // Adicionado o header de autorização que faltava
      const res = await api.get('/queue', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setQueue(res.data);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
      setError('Não foi possível carregar a fila.');
    }
  };

  useEffect(() => {
    if (user) { // Garante que só carrega a fila se houver um usuário
      loadQueue();
    }
  }, [user]); // Adicionado user como dependência

  const handleRemove = async (entryId) => {
    try {
      // Adicionado o header de autorização que faltava
      await api.delete(`/queue/${entryId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      loadQueue();
    } catch (err) {
      console.error('Erro ao remover da fila:', err);
      setError('Não foi possível remover o paciente.');
    }
  };

  const handleRegistered = () => {
    setShowRegister(false);
    loadQueue();
  };

  return (
    <>
      <motion.div
        className="admin-box"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        transition={{ duration: 0.5 }}
      >
        <h2>Painel de Administração</h2>

        <p className="queue-count">
          {queue.length} pessoa{queue.length !== 1 && 's'} na fila
        </p>

        <ul className="admin-list">
          {queue.map((entry) => (
            <li key={entry.id} className="admin-item">
              {entry.name}
              <button
                className="remove-btn"
                onClick={() => handleRemove(entry.id)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>

        <button
          className="open-register-btn"
          onClick={() => {
            setError('');
            setShowRegister(true);
          }}
        >
          Cadastrar e Enfileirar
        </button>
        {error && <p className="error">{error}</p>}
      </motion.div>

      {showRegister && (
        <RegisterPatient
          userId={null}
          adminMode={true}
          onRegistered={handleRegistered}
        />
      )}
    </>
  );
}