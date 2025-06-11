import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import AdminDashboard from './components/AdminDashboard';
import CreateUser from './components/CreateUser';
import DoctorDashboard from './components/DoctorDashboard';
import Login from './components/Login';
import RegisterPatient from './components/RegisterPatient';
import UserQueue from './components/UserQueue';
import api from './services/api';
import './App.css';
import logo from './assets/logo.png'; // Supondo que você queira o logo no header

// Componente de Header foi movido para dentro do App.js para ter acesso ao logo
function Header({ onLogout, role }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <span className="header-role">Logado como: <strong>{role}</strong></span>
      </div>
      <div className="header-center">
        <img src={logo} alt="Logo" className="header-logo" />
        <h1 className="header-title">Fila Inteligente</h1>
      </div>
      <div className="header-right">
        <button className="logout-btn" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const { user, logout } = useContext(AuthContext);
  const [screen, setScreen] = useState('login');

  useEffect(() => {
    if (!user) {
      setScreen('login');
      return;
    }

    if (user.role === 'admin') {
      setScreen('admin');
      return;
    }

    if (user.role === 'doctor') {
      setScreen('doctor');
      return;
    }

    api
      .get('/patients/byuser', { params: { user_id: user.user_id } })
      .then(res => {
        setScreen(res.data.exists ? 'user-queue' : 'register-patient');
      })
      .catch(() => setScreen('register-patient'));
  }, [user]);

  const handleRegistered = () => {
    setScreen('user-queue');
  };

  const handleLoginSuccess = () => {
    // O useEffect acima já redireciona a tela com base no 'user' do contexto.
  };

  const handleLogout = () => {
    logout();
    setScreen('login');
  };

  // **A CORREÇÃO PRINCIPAL ESTÁ AQUI**
  // Adicionamos dinamicamente a classe correta ao container
  const containerClassName = user ? "container header-active" : "container no-header-active";

  return (
    <div className={containerClassName}> {/* Usando a classe dinâmica */}
      {/* O Header é renderizado apenas se houver um usuário logado */}
      {user && <Header onLogout={handleLogout} role={user.role} />}

      {screen === 'login' && (
        <Login
          onCreate={() => setScreen('create-user')}
          onSuccess={handleLoginSuccess}
        />
      )}

      {screen === 'create-user' && (
        <CreateUser 
          onCancel={() => setScreen('login')}
          onSuccess={() => setScreen('login')} // <-- ADICIONE ESTA LINHA
        />
      )}

      {screen === 'register-patient' && user && (
        <RegisterPatient userId={user.user_id} onRegistered={handleRegistered} />
      )}

      {screen === 'user-queue' && user && <UserQueue userId={user.user_id} />}

      {screen === 'admin' && user && <AdminDashboard userId={user.user_id} />}

      {screen === 'doctor' && user && <DoctorDashboard userId={user.user_id} />}
    </div>
  );
}