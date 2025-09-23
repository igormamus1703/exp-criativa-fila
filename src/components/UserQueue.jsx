import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api'; // Confirme se o caminho para seu arquivo api.js está correto
import AnamneseModal from './AnamneseModal';
import DoctorsModal from './DoctorsModal';
import './UserQueue.css'; // Arquivo de estilos para este componente

// Constante para o tempo médio de atendimento
const AVERAGE_SECONDS_PER_PATIENT = 10 * 60; // 10 minutos em segundos

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
  
  // Estado para a otimização de performance (ETag)
  const [queueEtag, setQueueEtag] = useState(null);

  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setError("ID do usuário não fornecido.");
      setIsLoading(false);
      return;
    }

    try {
      // A busca de dados do paciente e anamnese continua idêntica
      let patientData = patient; // Usa o estado atual para evitar buscas repetidas
      if (!patientData) {
        try {
          const resPat = await api.get('/patients/byuser', { params: { user_id: userId } });
          if (resPat.data && resPat.data.patient) {
            //console.log("Dados do paciente recebidos do backend:", resPat.data.patient);
            patientData = resPat.data.patient;
            setPatient(patientData);

            try {
              const resAnamnese = await api.get(`/patients/${patientData.id}/anamnesis`);
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
      }

      // --- Bloco de busca da fila: Otimizado e Corrigido ---
      try {
        const resQueue = await api.get('/queue', { 
          headers: { 'If-None-Match': queueEtag } 
        });
        
        // CORREÇÃO: Usamos uma variável local 'newQueue' para guardar os dados frescos da API.
        const newQueue = resQueue.data || [];
        
        // Atualizamos o estado para a próxima renderização e o ETag para a próxima requisição.
        setQueue(newQueue);
        setQueueEtag(resQueue.headers.etag);

        // A verificação de 'joined' agora usa a variável local 'newQueue' para ter a informação correta e imediata.
        if (patientData) {
          const userEntryInQueue = newQueue.find(
            (entry) => entry.patient_id === patientData.id && entry.status === 'waiting'
          );
          setJoined(!!userEntryInQueue); // '!!' converte o resultado para true ou false
        }

      } catch (err) {
        if (err.response && err.response.status === 304) {
          // Resposta 304: A fila não mudou. Não fazemos nada, o que mantém a performance.
        } else {
          // Se for outro tipo de erro, nós o relançamos para o catch principal.
          throw err;
        }
      }
      // --- Fim do Bloco Corrigido ---

    } catch (err) {
      console.error('Erro geral no fetchData:', err);
      setError('Não foi possível carregar os dados da fila no momento.');
    } finally {
      if (isLoading) setIsLoading(false);
    }
  }, [userId, patient, isLoading, queueEtag]); // A dependência de 'patient' e 'isLoading' é importante aqui

  // useEffect para configurar o polling a cada 5 segundos
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 5000); // Intervalo mais curto e eficiente
    return () => {
      clearInterval(intervalId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]); // Depende de `fetchData` para reiniciar o intervalo se a função mudar

  // useEffect que controla a lógica do timer regressivo (sem alterações)
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

  // Função para entrar na fila (sem alterações de lógica)
  const handleEnterQueue = async () => {
    setError('');

    if (!patient || !patient.cpf) {
      setError('CPF do paciente não encontrado. Verifique seus dados cadastrais ou tente recarregar a página.');
      //console.log('Tentativa de entrar na fila sem CPF (ou sem dados do paciente):', patient);
      return;
    }

    if (queue.some((e) => e.patient_id === patient.id && e.status === 'waiting')) {
      setError('Você já está na fila de espera.');
      setJoined(true);
      return;
    }

    try {
      //console.log(`Tentando entrar na fila com CPF: ${patient.cpf}`);

      await api.post('/queue', {
        cpf: patient.cpf,
        is_priority: 0
      });

      await fetchData();

    } catch (err) {
      console.error('Erro detalhado ao entrar na fila:', err);
      if (err.response) {
        //console.log('Resposta de erro do backend (ao entrar na fila):', err.response.data);
        if (err.response.data && err.response.data.error) {
          setError(`Erro ao entrar na fila: ${err.response.data.error}`);
        } else if (err.response.data && typeof err.response.data === 'object') {
          setError(`Erro ao entrar na fila: ${JSON.stringify(err.response.data)}`);
        } else {
          setError('Ocorreu um erro ao tentar entrar na fila. Tente novamente.');
        }
      } else {
        setError('Ocorreu um erro de comunicação ao tentar entrar na fila.');
      }
    }
  };

  // Função para sair da fila (sem alterações de lógica)
  const handleLeaveQueue = async () => {
    if (!window.confirm("Você tem certeza que deseja sair da fila?")) {
        return;
    }

    const userQueueEntry = queue.find(
      (entry) => entry.patient_id === patient.id && entry.status === 'waiting'
    );

    if (!userQueueEntry) {
      setError("Não foi possível encontrar sua entrada na fila. A página será atualizada.");
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

  // Função para formatar o tempo (sem alterações)
  const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return 'Calculando...';
    if (seconds === 0 && joined) return 'Provavelmente é sua vez!';
    if (seconds === 0 && !joined) return '0m 00s';

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Variáveis auxiliares para a renderização (sem alterações)
  const waitingCount = queue.filter(e => e.status === 'waiting').length;
  const estimatedMinutesBeforeJoining = (waitingCount + 1) * (AVERAGE_SECONDS_PER_PATIENT / 60);
  const patientName = patient ? patient.name : 'Usuário';

  // JSX de renderização (sem alterações)
  if (isLoading) {
    return (
      <div className="container">
        <div className="queue-box">
          <p>Carregando informações da fila...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <div className="queue-box">
        <h2><span role="img" aria-label="relógio">🕰️</span> Fila de Espera <span role="img" aria-label="pessoa">👤</span></h2>
        <p className="patient-greeting">Olá, <strong>{patientName}</strong>!</p>

        {error && <p className="error-message">{error}</p>}

        {!patient && !error && (
            <p>Verificando seus dados de paciente...</p>
        )}

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
                  {/* <button 
                    className="anamnese-btn" 
                    onClick={() => setShowAnamneseModal(true)}
                  >
                    {anamnese ? 'Editar Anamnese' : 'Criar Anamnese'}
                  </button> */}
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

                <button className="leave-btn" onClick={handleLeaveQueue}>
                  Sair da Fila
                </button>

                <div className="doctors-promo">
                    <p>Quer saber quem pode te antender? <br/>
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
          patientId={patient.id}
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