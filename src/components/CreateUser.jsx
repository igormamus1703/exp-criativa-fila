import React, { useState } from 'react';
import api from '../services/api';
import './CreateUser.css';

export default function CreateUser({ onCancel, onSuccess }) {
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
      // Atualiza a mensagem para avisar sobre o redirecionamento
      setMsg('Usuário criado com sucesso!');

      // 2. Chama a função 'onSuccess' (que muda a tela no App.js) após 1 segundo
      setTimeout(() => {
        onSuccess();
      }, 1000); 

    } catch (err) {
      // --- ALTERAÇÃO PRINCIPAL ESTÁ AQUI ---
      setIsError(true);
      // Verificamos se o erro tem uma resposta do servidor com uma mensagem específica
      if (err.response && err.response.data && err.response.data.error) {
        // Se tiver, usamos a mensagem vinda do backend (ex: "Login já existe")
        setMsg(err.response.data.error);
      } else {
        // Caso contrário, usamos uma mensagem genérica
        setMsg('Erro ao criar usuário');
      }
      // Logamos o erro completo no console para depuração
      console.error('Erro ao criar usuário:', err);
    }
  };

  return (
    <div className="container">
      <div className="create-box">
        <h2>Criar Usuário</h2>
        {msg && (
          <p className={`message ${isError ? 'error' : 'success'}`}>
            {msg}
          </p>
        )}
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
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
            <option value="doctor">Médico</option>
          </select>

          <div className="buttons">
            <button type="submit" className="submit-btn">
              Criar
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}