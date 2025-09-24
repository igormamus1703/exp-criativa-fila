import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import '../styles/AnamneseModal.css';

export default function AnamneseModal({ queueEntryId, existingAnamnese, onClose }) {
  const [formAnamnese, setFormAnamnese] = useState({
    queixa_principal: '',
    historia_da_doenca_atual: '',
    historico_medico: '',
    medicacoes_em_uso: '',
    alergias: '',
    historico_familiar: '',
    habitos_de_vida: '',
    sintomas_rev_sistemas: '',
    outras_informacoes: ''
  });
  const [savingAnamnese, setSavingAnamnese] = useState(false);
  const [errorSaveAnamnese, setErrorSaveAnamnese] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (existingAnamnese) {
      setFormAnamnese(existingAnamnese);
    }
  }, [existingAnamnese]);

  const handleChange = (e) => {
    setFormAnamnese({
      ...formAnamnese,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSavingAnamnese(true);
    setErrorSaveAnamnese('');
    setSuccessMessage('');

    try {
      if (existingAnamnese) {
        // Atualizar anamnese existente
         await api.put(`/queue/${queueEntryId}/anamnesis`, formAnamnese);
        setSuccessMessage('Anamnese atualizada com sucesso!');
      } else {
        // Criar nova anamnese
        await api.post(`/queue/${queueEntryId}/anamnesis`, formAnamnese);
        setSuccessMessage('Anamnese criada com sucesso!');
      }
      
      // Fechar o modal após 2 segundos
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Erro ao salvar anamnese:', err);
      setErrorSaveAnamnese('Ocorreram erros ao salvar. Verifique os campos e tente novamente.');
    } finally {
      setSavingAnamnese(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{existingAnamnese ? 'Editar Anamnese' : 'Nova Anamnese'}</h2>
        
        {errorSaveAnamnese && <p className="error">{errorSaveAnamnese}</p>}
        {successMessage && <p className="success">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="form-anamnese">
          <div className="form-group">
            <label htmlFor="queixa_principal">Queixa Principal *</label>
            <textarea
              id="queixa_principal"
              name="queixa_principal"
              value={formAnamnese.queixa_principal}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="historia_da_doenca_atual">História da Doença Atual</label>
            <textarea
              id="historia_da_doenca_atual"
              name="historia_da_doenca_atual"
              value={formAnamnese.historia_da_doenca_atual}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="historico_medico">Histórico Médico</label>
            <textarea
              id="historico_medico"
              name="historico_medico"
              value={formAnamnese.historico_medico}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="medicacoes_em_uso">Medicações em Uso</label>
            <textarea
              id="medicacoes_em_uso"
              name="medicacoes_em_uso"
              value={formAnamnese.medicacoes_em_uso}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="alergias">Alergias</label>
            <textarea
              id="alergias"
              name="alergias"
              value={formAnamnese.alergias}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="historico_familiar">Histórico Familiar</label>
            <textarea
              id="historico_familiar"
              name="historico_familiar"
              value={formAnamnese.historico_familiar}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="habitos_de_vida">Hábitos de Vida</label>
            <textarea
              id="habitos_de_vida"
              name="habitos_de_vida"
              value={formAnamnese.habitos_de_vida}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sintomas_rev_sistemas">Sintomas e Revisão de Sistemas</label>
            <textarea
              id="sintomas_rev_sistemas"
              name="sintomas_rev_sistemas"
              value={formAnamnese.sintomas_rev_sistemas}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="outras_informacoes">Outras Informações</label>
            <textarea
              id="outras_informacoes"
              name="outras_informacoes"
              value={formAnamnese.outras_informacoes}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={savingAnamnese}>
            {savingAnamnese ? 'Salvando...' : existingAnamnese ? 'Atualizar Anamnese' : 'Criar Anamnese'}
          </button>
        </form>
      </div>
    </div>
  );
} 