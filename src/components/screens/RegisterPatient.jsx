import React, { useState, useContext } from 'react'; // Adicionado useContext
import api from '../../services/api';
import { motion } from 'framer-motion'; // Adicionado motion
import { AuthContext } from '../../context/AuthContext'; // Adicionado AuthContext
import '../styles/RegisterPatient.css';

export default function RegisterPatient({ adminMode = false, onRegistered }) {
  const { user } = useContext(AuthContext); // Obter usuário do contexto
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

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user) {
      setError("Você precisa estar logado para realizar esta ação.");
      return;
    }

    try {
      const payload = { ...form, user_id: user.user_id };
      const config = {
        headers: { Authorization: `Bearer ${user.token}` }
      };

      if (adminMode) {
        // Usa o novo endpoint /patients/admin
        await api.post('/patients/admin', payload, config);
        setSuccess('Paciente cadastrado e enfileirado com sucesso!');
        if (onRegistered) onRegistered();
      } else {
        // Modo normal (usuário comum): só cria paciente
        await api.post('/patients', payload, config);
        setSuccess('Cadastro realizado com sucesso!');
        if (onRegistered) onRegistered();
      }
    } catch (err) {
      console.error('Erro ao cadastrar paciente:', err);
      setError(err.response?.data?.error || 'Erro ao cadastrar paciente');
    }
  };

  return (
    // Removido o container duplicado e adicionada a animação
    <motion.div
      className="register-box"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
      <h2>
        {adminMode
          ? 'Cadastro Presencial e Enfileirar'
          : 'Cadastro Completo do Paciente'}
      </h2>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      <form className="form" onSubmit={handleSubmit}>
        <input
          name="cpf"
          type="text"
          placeholder="CPF (somente números)"
          value={form.cpf}
          onChange={handleChange}
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
        <button type="submit" className="submit-btn">
          {adminMode ? 'Cadastrar e Enfileirar' : 'Cadastrar Paciente'}
        </button>
      </form>
    </motion.div>
  );
}