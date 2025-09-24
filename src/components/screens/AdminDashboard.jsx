// src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import RegisterPatient from './RegisterPatient';
import '../styles/AdminDashboard.css';

export default function AdminDashboard() {
  const [queue, setQueue] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState('');

  // Carrega a fila do servidor
  const loadQueue = async () => {
    try {
      const res = await api.get('/queue');
      setQueue(res.data);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  // Remove paciente da fila
  const handleRemove = async (entryId) => {
    try {
      await api.delete(`/queue/${entryId}`);
      loadQueue();
    } catch (err) {
      console.error('Erro ao remover da fila:', err);
    }
  };

  // Callback após cadastro/admin, recarrega fila e esconde formulário
  const handleRegistered = () => {
    setShowRegister(false);
    loadQueue();
  };

  return (
    <div className="container">
      <div className="admin-box">
        <h2>Painel de Administração</h2>

        {/* Número de pessoas na fila */}
        <p className="queue-count">
          {queue.length} pessoa{queue.length !== 1 && 's'} na fila
        </p>

        {/* Lista de nomes com botão Remover */}
        <ul className="admin-list">
          {queue.map((entry) => (
            <li key={entry.id} className="admin-item">
              {entry.name} {/* O SELECT /queue já inclui p.name */}
              <button
                className="remove-btn"
                onClick={() => handleRemove(entry.id)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>

        {/* Botão que abre o formulário de cadastro + enqueue */}
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
      </div>

      {/* Se showRegister=true, renderiza RegisterPatient em modo admin */}
      {showRegister && (
        <RegisterPatient
          userId={null}     // Opcional: se admin não precisa de userId, pode passar null
          adminMode={true}
          onRegistered={handleRegistered}
        />
      )}
    </div>
  );
}
