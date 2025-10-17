import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Login.css';
import logo from '../../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useContext(AuthContext);
  const [loginField, setLoginField] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  
  const subtitles = ['Seja Bem Vindo', 'Be Welcome'];
  const [subtitle, setSubtitle] = useState(subtitles[0]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSubtitle(currentSubtitle => {
        return currentSubtitle === subtitles[0] ? subtitles[1] : subtitles[0];
      });
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    setTimeout(() => {
      let mockUser = { user_id: 1, token: 'fake-token-for-testing' };
      if (loginField.toLowerCase() === 'admin') {
        mockUser.role = 'admin';
      } else if (loginField.toLowerCase() === 'doctor') {
        mockUser.role = 'doctor';
      } else {
        mockUser.role = 'user';
      }
      login(mockUser);
    }, 500);
  };

  return (
    <motion.div
      className="login-box"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.5 }}
    >
      <img src={logo} className="logo" alt="Logo da Fila Inteligente" />
      <h1>Fila Inteligente</h1>
      
      <div className="subtitle-container">
        <AnimatePresence mode="wait">
          <motion.p
            key={subtitle}
            className="subtitle"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
          >
            {subtitle}
          </motion.p>
        </AnimatePresence>
      </div>
      
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
        />
        <button type="submit">Entrar</button>
      </form>
      <p className="link" onClick={() => navigate('/criar-conta')}>
        Criar uma conta
      </p>
    </motion.div>
  );
}