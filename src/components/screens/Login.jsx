import React, { useState, useContext, useEffect } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import '../styles/Login.css';
import logo from '../../assets/logo.png';

export default function Login({ onCreate, onSuccess }) {
  const { user, login } = useContext(AuthContext);
  const [loginField, setLoginField] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');

  // Se já existir user no contexto, aciona onSuccess automaticamente
  useEffect(() => {
    if (user) {
      onSuccess(user);
    }
  }, [user, onSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { login: loginField, senha });
      // Esperamos retornar { user_id, role }
      const { user_id, role } = res.data;
      // Se o servidor retornar token, coloque em userData (por ex: res.data.token)
      login({ user_id, role, token: res.data.token });
      // onSuccess será chamado pelo useEffect acima, pois user no contexto foi atualizado
    } catch {
      setError('Login ou senha inválidos');
    }
  };

  return (
    <div className="container">
      <div className="login-box">
        <img src={logo} className="logo" alt="Logo da Fila Inteligente" />
        <h1>Fila Inteligente</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Usuário ou E-mail"
            value={loginField}
            onChange={e => setLoginField(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
          />
          <button type="submit">Entrar</button>
        </form>
        <p className="link" onClick={onCreate}>
          Criar uma conta
        </p>
      </div>
    </div>
  );
}