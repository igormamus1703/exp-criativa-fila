import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { IMaskInput } from 'react-imask';
import api from '../../services/api';
import { motion } from 'framer-motion';
import { AuthContext } from '../../context/AuthContext';
import '../styles/RegisterPatient.css';

export default function RegisterPatient({ adminMode = false, onRegistered }) {
  // Importamos 'login' para atualizar a sessão localmente após o cadastro
  const { user, logout, login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    cpf: '',
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    insurance_provider: '',
    insurance_number: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!user) {
      setError("Você precisa estar logado para realizar esta ação.");
      setIsLoading(false);
      return;
    }

    try {
      // Remove pontos e traços do CPF para enviar apenas números (VARCHAR(11))
      const cleanCpf = form.cpf.replace(/\D/g, ''); 

      const payload = { 
        ...form,
        cpf: cleanCpf,
        user_id: user.user_id 
      };
      
      const config = {
        headers: { Authorization: `Bearer ${user.token}` }
      };

      if (adminMode) {
        // Modo Admin: Apenas cadastra e (opcionalmente) notifica o pai
        await api.post('/patients/admin', payload, config);
        if (onRegistered) onRegistered();
        // Limpar formulário ou fechar modal pode ser feito aqui se desejar
        setSuccess('Paciente cadastrado e enfileirado com sucesso!');
        setForm({
            cpf: '', name: '', email: '', phone: '', birth_date: '', insurance_provider: '', insurance_number: ''
        });
      } else {
        // Modo Usuário: Cadastra e atualiza a sessão
        const response = await api.post('/patients', payload, config);
        
        // ATUALIZAÇÃO IMPORTANTE:
        // Injetamos o novo patient_id na sessão atual do usuário.
        // Assim, o App.js sabe que ele já tem cadastro e libera o acesso à fila.
        const updatedUser = { 
          ...user, 
          patient_id: response.data.id 
        };
        login(updatedUser);

        setSuccess('Cadastro realizado com sucesso! Redirecionando...');
        setTimeout(() => window.location.href = '/fila', 2000); 
      }
    } catch (err) {
      console.error('Erro ao cadastrar paciente:', err);
      setError(err.response?.data?.error || 'Erro ao cadastrar paciente');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.div
      className="register-box"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
      <h2>
        {adminMode ? 'Cadastro Presencial e Enfileirar' : 'Complete seu Cadastro'}
      </h2>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      <form className="form" onSubmit={handleSubmit}>
        <IMaskInput
          mask="000.000.000-00"
          name="cpf"
          placeholder="CPF"
          value={form.cpf}
          onAccept={(value) => handleChange({ target: { name: 'cpf', value } })}
          required
        />
        <input
          name="name"
          type="text"
          placeholder="Nome completo"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          name="email"
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="phone"
          type="text"
          placeholder="Telefone"
          value={form.phone}
          onChange={handleChange}
          required
        />
        <input
          name="birth_date"
          type="date"
          value={form.birth_date}
          onChange={handleChange}
          required
        />
        <input
          name="insurance_provider"
          type="text"
          placeholder="Convênio (opcional)"
          value={form.insurance_provider}
          onChange={handleChange}
        />
        <input
          name="insurance_number"
          type="text"
          placeholder="Número do convênio (opcional)"
          value={form.insurance_number}
          onChange={handleChange}
        />
        <div className="buttons-row">
            <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? 'Aguarde...' : (adminMode ? 'Cadastrar e Enfileirar' : 'Finalizar Cadastro')}
            </button>
            {!adminMode && (
                <button type="button" className="back-btn" onClick={handleBackToLogin}>
                    Voltar
                </button>
            )}
        </div>
      </form>
    </motion.div>
  );
}