import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { motion } from 'framer-motion';
import '../styles/CreateUser.css';

export default function CreateUser() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('user');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/users', { login, senha, role });
      setIsError(false);
      setMsg('Usuário criado com sucesso! Redirecionando para login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setIsError(true);
      setMsg('Erro ao criar usuário');
    }
  };

  return (
    <motion.div
      className="create-box"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
      <h2>Criar Usuário</h2>
      {msg && <p className={`message ${isError ? 'error' : 'success'}`}>{msg}</p>}
      <form onSubmit={handleSubmit} className="create-form">
        <input
          type="text"
          placeholder="Login"
          value={login}
          onChange={e => setLogin(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          required
        />
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="user">Usuário</option>
          <option value="admin">Admin</option>
          <option value="doctor">Médico</option>
        </select>
        <div className="buttons">
          <button type="submit" className="submit-btn">Criar</button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate('/login')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </motion.div>
  );
}