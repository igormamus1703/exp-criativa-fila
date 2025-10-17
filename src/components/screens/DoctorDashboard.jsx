import React, { useEffect, useState, useContext } from 'react'; // Adicionado useContext
import api from '../../services/api';
import AnamneseModal from './AnamneseModal';
import { motion } from 'framer-motion'; // Adicionado motion
import { AuthContext } from '../../context/AuthContext'; // Adicionado AuthContext
import '../styles/DoctorDashboard.css';

export default function DoctorDashboard() { // Removida a prop userId
  const { user } = useContext(AuthContext); // Obter usuário do contexto
  const [pacienteAtual, setPacienteAtual] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [errorQueue, setErrorQueue] = useState('');
  const [anamnese, setAnamnese] = useState(null);
  const [showAnamneseModal, setShowAnamneseModal] = useState(false);

  const fetchQueueData = async () => {
    if (!user) return; // Não fazer nada se o usuário não estiver logado

    try {
      // Adicionado header de autorização
      const response = await api.get('/queue', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const patients = response.data;
      setQueueSize(patients.length);
      setPacienteAtual(patients[0] || null);
      setLoadingQueue(false);

      if (patients[0]) {
        try {
          // Adicionado header de autorização
          const resAnamnese = await api.get(`/patients/${patients[0].patient_id}/anamnesis`, {
            headers: { Authorization: `Bearer ${user.token}` }
          });
          if (resAnamnese.data && resAnamnese.data.length > 0) {
            setAnamnese(resAnamnese.data[0]);
          } else {
            setAnamnese(null);
          }
        } catch (err) {
          console.error('Erro ao buscar anamnese:', err);
          setAnamnese(null);
        }
      } else {
        setAnamnese(null);
      }
    } catch (err) {
      console.error(err);
      setErrorQueue('Erro ao carregar dados da fila');
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const intervalId = setInterval(fetchQueueData, 5000);
    return () => clearInterval(intervalId);
  }, [user]); // Adicionado user como dependência

  const handleAttendPatient = async (patientId) => {
    try {
      // Adicionado header de autorização
      await api.post(`/queue/${patientId}/attend`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      fetchQueueData();
    } catch (err) {
      console.error(err);
      setErrorQueue('Erro ao atender paciente');
    }
  };

  const getPriorityText = (priority) => {
    return priority === 1 ? 'Prioridade' : 'Normal';
  };

  if (loadingQueue) return <div>Carregando...</div>;
  if (errorQueue) return <div className="error">{errorQueue}</div>;

  return (
    <motion.div
      className="doctor-dashboard"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
      <h2>Painel do Médico</h2>

      <div className="queue-info">
        <div className="queue-size">
          <h3>Tamanho da Fila</h3>
          <span className="size-number">{queueSize > 0 ? queueSize - 1 : 0}</span>
          <p>pacientes aguardando</p>
        </div>
      </div>

      <div className="paciente-atual">
        <h3>Paciente Atual</h3>
        {pacienteAtual ? (
          <div className="patient-card">
            <div className="patient-info">
              <div className="info-row">
                <span className="label">Nome:</span>
                <span className="value">{pacienteAtual.name}</span>
              </div>
              <div className="info-row">
                <span className="label">Sexo:</span>
                <span className="value">{pacienteAtual.gender}</span>
              </div>
              <div className="info-row">
                <span className="label">Email:</span>
                <span className="value">{pacienteAtual.email}</span>
              </div>
              <div className="info-row">
                <span className="label">Telefone:</span>
                <span className="value">{pacienteAtual.phone}</span>
              </div>
              <div className="info-row">
                <span className="label">CPF:</span>
                <span className="value">{pacienteAtual.cpf}</span>
              </div>
              <div className="info-row">
                <span className="label">Prioridade:</span>
                <span className={`priority-badge ${pacienteAtual.is_priority === 1 ? 'priority' : 'normal'}`}>
                  {getPriorityText(pacienteAtual.is_priority)}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Horário de Chegada:</span>
                <span className="value">
                  {new Date(pacienteAtual.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="buttons-row">
              <button
                onClick={() => handleAttendPatient(pacienteAtual.id)}
                className="attend-button"
              >
                Atender Paciente
              </button>
              <button
                onClick={() => setShowAnamneseModal(true)}
                className="attend-button"
              >
                {anamnese ? 'Ver Anamnese' : 'Criar Anamnese'}
              </button>
            </div>
          </div>
        ) : (
          <p className="no-patients">Não há pacientes na fila no momento</p>
        )}
      </div>

      {showAnamneseModal && pacienteAtual && (
        <AnamneseModal
          patientId={pacienteAtual.patient_id}
          existingAnamnese={anamnese}
          onClose={() => {
            setShowAnamneseModal(false);
            fetchQueueData();
          }}
        />
      )}
    </motion.div>
  );
}