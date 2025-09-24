// src/components/RegisterPatient.jsx
import React, { useState } from 'react';
import api from '../../services/api';
import '../styles/RegisterPatient.css';

export default function RegisterPatient({ userId, adminMode = false, onRegistered }) {
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

    try {
      if (adminMode) {
        // Usa o novo endpoint /patients/admin
        const res = await api.post('/patients/admin', {
          ...form,
          user_id: userId
        });
        // res.data = { patient, queueEntry }
        setSuccess('Paciente cadastrado e enfileirado com sucesso!');
        onRegistered(); // dispara recarregar fila no AdminDashboard
      } else {
        // Modo normal (usuário comum): só cria paciente
        await api.post('/patients', { ...form, user_id: userId });
        setSuccess('Cadastro realizado com sucesso!');
        onRegistered(); // volta para fila de usuário
      }
    } catch (err) {
      console.error('Erro ao cadastrar paciente:', err);
      setError(err.response?.data?.error || 'Erro ao cadastrar paciente');
    }
  };

  return (
    <div className="container">
      <div className="register-box">
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
      </div>
    </div>
  );
}
