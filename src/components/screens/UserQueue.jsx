import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import AnamneseModal from './AnamneseModal';
import DoctorsModal from './DoctorsModal';
import '../styles/UserQueue.css';

const AVERAGE_SECONDS_PER_PATIENT = 10 * 60; // 10 minutos

export default function UserQueue({ userId }) {
  const [queue, setQueue] = useState([]);
  const [patient, setPatient] = useState(null);
  const [anamnese, setAnamnese] = useState(null);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnamneseModal, setShowAnamneseModal] = useState(false);
  const [isDoctorsModalOpen, setDoctorsModalOpen] = useState(false);
  const [queueEtag, setQueueEtag] = useState(null);

  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setError("ID do usuário não fornecido.");
      setIsLoading(false);
      return;
    }

    try {
      let patientData = patient;
      if (!patientData) {
        const resPat = await api.get('/patients/byuser', { params: { user_id: userId } });
        if (resPat.data && resPat.data.patient) {
          patientData = resPat.data.patient;
          setPatient(patientData);
          const resAnamnese = await api.get(`/patients/${patientData.id}/anamnesis`);
          if (resAnamnese.data && resAnamnese.data.length > 0) {
            setAnamnese(resAnamnese.data[0]);
          } else {
            setAnamnese(null);
          }
        } else {
          setError("Seus dados de paciente não foram encontrados. Por favor, complete seu cadastro.");
        }
      }

      const resQueue = await api.get('/queue', { headers: { 'If-None-Match': queueEtag } });
      const newQueue = resQueue.data || [];
      setQueue(newQueue);
      setQueueEtag(resQueue.headers.etag);

      if (patientData) {
        const userEntryInQueue = newQueue.find(entry => entry.patient_id === patientData.id && entry.status === 'waiting');
        setJoined(!!userEntryInQueue);
      }
    } catch (err) {
      if (err.response && err.response.status === 304) {
        // Fila não mudou, tudo certo.
      } else {
        console.error('Erro geral no fetchData:', err);
        setError('Não foi possível carregar os dados da fila no momento.');
      }
    } finally {
      if (isLoading) setIsLoading(false);
    }
  }, [userId, patient, isLoading, queueEtag]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  useEffect(() => {
    if (!joined || !patient || !queue.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRemainingSeconds(null);
      return;
    }

    const waitingQueue = queue.filter(e => e.status === 'waiting').sort((a, b) => {
      if (a.is_priority !== b.is_priority) return b.is_priority - a.is_priority;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const userQueueEntry = waitingQueue.find(e => e.patient_id === patient.id);
    if (!userQueueEntry) {
      setJoined(false);
      return;
    }

    const position = waitingQueue.findIndex(e => e.patient_id === patient.id) + 1;
    if (position > 0) {
      const totalEstimatedSecondsForUser = position * AVERAGE_SECONDS_PER_PATIENT;
      const createdAtTime = new Date(userQueueEntry.created_at).getTime();
      const elapsedSecondsSinceJoin = Math.floor((Date.now() - createdAtTime) / 1000);
      let newRemainingSeconds = Math.max(0, totalEstimatedSecondsForUser - elapsedSecondsSinceJoin);
      setRemainingSeconds(newRemainingSeconds);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current);
            fetchData();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setJoined(false);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [joined, patient, queue, fetchData]);

  const handleEnterQueue = async () => {
    setError('');
    if (!patient || !patient.cpf) {
      setError('CPF do paciente não encontrado.');
      return;
    }
    try {
      await api.post('/queue', { cpf: patient.cpf, is_priority: 0 });
      await fetchData();
    } catch (err) {
      console.error('Erro detalhado ao entrar na fila:', err);
      setError(err.response?.data?.error || 'Ocorreu um erro ao tentar entrar na fila.');
    }
  };

  const handleLeaveQueue = async () => {
    if (!window.confirm("Você tem certeza que deseja sair da fila?")) return;
    const userQueueEntry = queue.find(entry => entry.patient_id === patient.id && entry.status === 'waiting');
    if (!userQueueEntry) {
      setError("Não foi possível encontrar sua entrada na fila.");
      fetchData();
      return;
    }
    try {
      await api.delete(`/queue/${userQueueEntry.id}`);
      await fetchData();
    } catch (err) {
      console.error("Erro ao sair da fila:", err);
      setError("Ocorreu um erro ao tentar sair da fila.");
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return 'Calculando...';
    if (seconds === 0 && joined) return 'Provavelmente é sua vez!';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const waitingCount = queue.filter(e => e.status === 'waiting').length;
  const estimatedMinutesBeforeJoining = (waitingCount + 1) * (AVERAGE_SECONDS_PER_PATIENT / 60);
  const patientName = patient ? patient.name : 'Usuário';

  if (isLoading) {
    return (
      <div className="container">
        <div className="queue-box"><p>Carregando informações da fila...</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="queue-box">
        <h2><span role="img" aria-label="relógio">🕰️</span> Fila de Espera <span role="img" aria-label="pessoa">👤</span></h2>
        <p className="patient-greeting">Olá, <strong>{patientName}</strong>!</p>
        {error && <p className="error-message">{error}</p>}
        {!patient && !error && <p>Verificando seus dados de paciente...</p>}

        {patient && (
          <>
            <hr />
            <p className="queue-count">{waitingCount} pessoa(s) aguardando na fila.</p>
            {!joined ? (
              <div className="join-section">
                <p className="queue-time-estimate">
                  Tempo estimado de espera se entrar agora: <strong>aproximadamente {Math.round(estimatedMinutesBeforeJoining)} minutos</strong>.
                </p>
                <div className="buttons-row">
                  <button className="enter-btn" onClick={handleEnterQueue} disabled={!patient || !patient.cpf}>
                    Entrar na Fila
                  </button>
                </div>
              </div>
            ) : (
              <div className="joined-section">
                <p className="queue-status-joined">Você está na fila!</p>
                <p className="queue-pos">
                  Sua posição atual: <strong>{
                    queue.filter(e => e.status === 'waiting')
                         .sort((a, b) => {
                           if (a.is_priority !== b.is_priority) return b.is_priority - a.is_priority;
                           return new Date(a.created_at) - new Date(b.created_at);
                         })
                         .findIndex(e => e.patient_id === patient.id) + 1
                  }</strong>
                </p>
                {remainingSeconds !== null && (
                  <p className="queue-time-remaining">
                    Tempo restante estimado: <strong className="timer-display">{formatTime(remainingSeconds)}</strong>
                  </p>
                )}
                {queue.find(e => e.patient_id === patient.id && e.status === 'waiting') && (
                  <p className="arrival-time">
                    <em>Entrou na fila às: {new Date(queue.find(e => e.patient_id === patient.id).created_at).toLocaleTimeString()}</em>
                  </p>
                )}
                
                {/* BOTÃO DA ANAMNESE ADICIONADO AQUI, NO LUGAR CERTO */}
                <button 
                  className="anamnese-btn" 
                  onClick={() => setShowAnamneseModal(true)}
                >
                  {anamnese ? 'Editar Minha Anamnese' : 'Preencher Minha Anamnese'}
                </button>

                <button className="leave-btn" onClick={handleLeaveQueue}>
                  Sair da Fila
                </button>
                
                <div className="doctors-promo">
                  <p>Quer saber quem pode te atender? <br/>
                  Que tal conhecer os médicos do nosso corpo clínico?</p>
                  <button onClick={() => setDoctorsModalOpen(true)}>Conhecer Médicos</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DoctorsModal isOpen={isDoctorsModalOpen} onClose={() => setDoctorsModalOpen(false)} />

      {showAnamneseModal && patient && (
        <AnamneseModal
          // CHAMADA DO MODAL CORRIGIDA
          queueEntryId={queue.find(entry => entry.patient_id === patient.id)?.id}
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