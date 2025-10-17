import React, { useCallback, useEffect, useRef, useState, useContext } from 'react'; // Adicionado useContext
import api from '../../services/api';
import AnamneseModal from './AnamneseModal';
import { motion } from 'framer-motion'; // Adicionado motion
import { AuthContext } from '../../context/AuthContext'; // Adicionado AuthContext
import '../styles/UserQueue.css';

const AVERAGE_SECONDS_PER_PATIENT = 10 * 60;

export default function UserQueue() { // Removida a prop userId
  const { user } = useContext(AuthContext); // Obter usuário do contexto
  const [queue, setQueue] = useState([]);
  const [patient, setPatient] = useState(null);
  const [anamnese, setAnamnese] = useState(null);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnamneseModal, setShowAnamneseModal] = useState(false);

  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!user) { // Usa o user do contexto
      setError("ID do usuário não fornecido.");
      setIsLoading(false);
      return;
    }
    
    const config = { headers: { Authorization: `Bearer ${user.token}` } };

    try {
      let patientData = null;
      try {
        const resPat = await api.get('/patients/byuser', { params: { user_id: user.user_id }, ...config });
        if (resPat.data && resPat.data.patient) {
          patientData = resPat.data.patient;
          setPatient(patientData);

          try {
            const resAnamnese = await api.get(`/patients/${patientData.id}/anamnesis`, config);
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
          setPatient(null);
          setAnamnese(null);
          setError("Seus dados de paciente não foram encontrados. Por favor, complete seu cadastro de paciente.");
        }
      } catch (err) {
        setPatient(null);
        setAnamnese(null);
        if (err.response && err.response.status === 404) {
          setError("Cadastro de paciente não encontrado. Por favor, realize seu cadastro para entrar na fila.");
        } else {
          console.error('Erro ao buscar dados do paciente:', err);
          setError('Não foi possível carregar seus dados de paciente.');
        }
      }

      const resQueue = await api.get('/queue', config);
      const currentQueue = resQueue.data || [];
      setQueue(currentQueue);

      if (patientData) {
        const userEntryInQueue = currentQueue.find(
          (entry) => entry.patient_id === patientData.id && entry.status === 'waiting'
        );
        if (userEntryInQueue) {
          setJoined(true);
        } else {
          setJoined(false);
          setRemainingSeconds(null);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } else {
        setJoined(false);
      }
    } catch (err) {
      console.error('Erro ao buscar dados da fila:', err);
      setError('Não foi possível carregar os dados da fila no momento.');
    } finally {
      if (isLoading) setIsLoading(false);
    }
  }, [user, isLoading]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 15000);
    return () => {
      clearInterval(intervalId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!joined || !patient || !queue.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRemainingSeconds(null);
      return;
    }

    const waitingQueue = queue
      .filter(e => e.status === 'waiting')
      .sort((a, b) => {
        if (a.is_priority !== b.is_priority) {
          return b.is_priority - a.is_priority;
        }
        return new Date(a.created_at) - new Date(b.created_at);
      });

    const userQueueEntry = waitingQueue.find(e => e.patient_id === patient.id);
    if (!userQueueEntry) {
      setJoined(false);
      return;
    }

    const position = waitingQueue.findIndex((e) => e.patient_id === patient.id) + 1;
    if (position > 0) {
      const totalEstimatedSecondsForUser = position * AVERAGE_SECONDS_PER_PATIENT;
      const createdAtTime = new Date(userQueueEntry.created_at).getTime();
      const currentTime = Date.now();
      const elapsedSecondsSinceJoin = Math.floor((currentTime - createdAtTime) / 1000);
      let newRemainingSeconds = totalEstimatedSecondsForUser - elapsedSecondsSinceJoin;
      newRemainingSeconds = Math.max(0, newRemainingSeconds);
      setRemainingSeconds(newRemainingSeconds);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
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
      setError('CPF do paciente não encontrado. Verifique seus dados cadastrais ou tente recarregar a página.');
      return;
    }
    if (queue.some((e) => e.patient_id === patient.id && e.status === 'waiting')) {
      setError('Você já está na fila de espera.');
      setJoined(true);
      return;
    }
    try {
      await api.post('/queue', {
        cpf: patient.cpf,
        is_priority: 0
      }, { headers: { Authorization: `Bearer ${user.token}` } }); // Adicionado header de autorização
      await fetchData();
    } catch (err) {
      console.error('Erro detalhado ao entrar na fila:', err);
      setError(err.response?.data?.error || 'Ocorreu um erro ao tentar entrar na fila.');
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return 'Calculando...';
    if (seconds === 0 && joined) return 'Provavelmente é sua vez!';
    if (seconds === 0 && !joined) return '0m 00s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const waitingCount = queue.filter(e => e.status === 'waiting').length;
  const estimatedMinutesBeforeJoining = (waitingCount + 1) * (AVERAGE_SECONDS_PER_PATIENT / 60);

  if (isLoading) {
    return (
      <div className="queue-box">
        <p>Carregando informações da fila...</p>
      </div>
    );
  }
  
  const patientName = patient ? patient.name : 'Usuário';

  return (
    <motion.div
      className="queue-box"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
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
                <button 
                  className="anamnese-btn" 
                  onClick={() => setShowAnamneseModal(true)}
                >
                  {anamnese ? 'Editar Anamnese' : 'Criar Anamnese'}
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
            </div>
          )}
        </>
      )}
      {showAnamneseModal && patient && (
        <AnamneseModal
          patientId={patient.id}
          existingAnamnese={anamnese}
          onClose={() => {
            setShowAnamneseModal(false);
            fetchData();
          }}
        />
      )}
    </motion.div>
  );
}