// src/pages/DoctorDashboard.jsx
import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import AnamneseModal from './AnamneseModal';
import './DoctorDashboard.css';

// FUNÇÃO PARA CALCULAR A IDADE (VERSÃO FINAL E ROBUSTA)
// Ela lida com datas nulas e formata a saída corretamente.
const calculateAge = (birthDateString) => {
  // Se não houver data, retorna uma mensagem padrão.
  if (!birthDateString) {
    return 'Não informada';
  }

  // Cria o objeto Date a partir da string da API.
  const birthDate = new Date(birthDateString);

  // Checa se a data criada é válida.
  if (isNaN(birthDate.getTime())) {
    return 'Data inválida';
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  
  // Ajuste para caso o aniversário ainda não tenha ocorrido no ano.
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return `${age} anos`; // Retorna a string completa.
};


export default function DoctorDashboard({ userId }) {
  const [attendingPatient, setAttendingPatient] = useState(null);
  const [nextPatient, setNextPatient] = useState(null);
  const [waitingQueueSize, setWaitingQueueSize] = useState(0);
  const [anamnese, setAnamnese] = useState(null);
  const [showAnamneseModal, setShowAnamneseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [currentRes, queueRes] = await Promise.all([
        api.get('/queue/current'),
        api.get('/queue'),
      ]);
      setAttendingPatient(currentRes.data);
      setNextPatient(queueRes.data?.[0] || null);
      setWaitingQueueSize(queueRes.data.length);
      if (!currentRes.data) setAnamnese(null);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setError('Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  useEffect(() => {
    if (!attendingPatient) {
      setAnamnese(null);
      return;
    }
    const fetchAnamnesis = async () => {
      try {
        const resAnamnese = await api.get(`/queue/${attendingPatient.id}/anamnesis`);
        setAnamnese(resAnamnese.data?.[0] || null);
      } catch (err) { console.error('Erro ao buscar anamnese:', err); }
    };
    fetchAnamnesis();
  }, [attendingPatient]);

  const handleAttendPatient = async (queueEntryId) => {
    setError('');
    try {
      await api.post(`/queue/${queueEntryId}/attend`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar atendimento.');
    }
  };

  const handleFinishAttendance = async () => {
    if (!attendingPatient) return;
    setError('');
    try {
      await api.post(`/queue/${attendingPatient.id}/finish`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao finalizar atendimento.');
    }
  };

  const getPriorityText = (priority) => (priority ? 'Prioridade' : 'Normal');

  if (loading && !attendingPatient && !nextPatient) return <div>Carregando...</div>;

  return (
    <div className="doctor-dashboard">
      <h2>Painel do Médico</h2>
      {error && <div className="error">{error}</div>}

      <div className="queue-info">
        <div className="queue-size">
          <h3>Fila de Espera</h3>
          <span className="size-number">{waitingQueueSize}</span>
          <p>pacientes aguardando</p>
        </div>
      </div>

      {attendingPatient ? (
        <div className="paciente-atual">
          <h3>Paciente em Atendimento</h3>
          <div className="patient-card">
            <div className="patient-info">
              <div className="info-row"><span className="label">Nome:</span><span className="value">{attendingPatient.name}</span></div>
              {/* CORREÇÃO: Chamando a função corretamente */}
              <div className="info-row"><span className="label">Idade:</span><span className="value">{calculateAge(attendingPatient.birth_date)}</span></div>
              <div className="info-row"><span className="label">CPF:</span><span className="value">{attendingPatient.cpf}</span></div>
              <div className="info-row"><span className="label">Email:</span><span className="value">{attendingPatient.email || 'N/A'}</span></div>
              <div className="info-row"><span className="label">Início Atend.:</span><span className="value">{new Date(attendingPatient.served_at).toLocaleTimeString()}</span></div>
            </div>
            <div className="buttons-row">
              <button onClick={() => setShowAnamneseModal(true)} className="attend-button anamnesis">
                {anamnese ? 'Ver/Editar Anamnese' : 'Criar Anamnese'}
              </button>
              <button onClick={handleFinishAttendance} className="attend-button finish">
                Finalizar Atendimento
              </button>
            </div>
          </div>
        </div>
      ) : nextPatient ? (
        <div className="paciente-atual">
          <h3>Próximo Paciente</h3>
          <div className="patient-card">
            <div className="patient-info">
              <div className="info-row"><span className="label">Nome:</span><span className="value">{nextPatient.name}</span></div>
              {/* CORREÇÃO: Chamando a função corretamente */}
              <div className="info-row"><span className="label">Idade:</span><span className="value">{calculateAge(nextPatient.birth_date)}</span></div>
              <div className="info-row"><span className="label">CPF:</span><span className="value">{nextPatient.cpf}</span></div>
              <div className="info-row"><span className="label">Email:</span><span className="value">{nextPatient.email || 'N/A'}</span></div>
              <div className="info-row"><span className="label">Chegada:</span><span className="value">{new Date(nextPatient.created_at).toLocaleTimeString()}</span></div>
              <div className="info-row">
                <span className="label">Prioridade:</span>
                <span className={`priority-badge ${nextPatient.is_priority ? 'priority' : 'normal'}`}>
                  {getPriorityText(nextPatient.is_priority)}
                </span>
              </div>
            </div>
            <div className="buttons-row">
              <button onClick={() => handleAttendPatient(nextPatient.id)} className="attend-button">
                Atender Paciente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="paciente-atual">
          <h3>Atendimento</h3>
          <p className="no-patients">A fila de espera está vazia.</p>
        </div>
      )}

      {showAnamneseModal && attendingPatient && (
        <AnamneseModal
          queueEntryId={attendingPatient.id}
          existingAnamnese={anamnese}
          onClose={() => {
            setShowAnamneseModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}