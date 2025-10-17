import React, { useContext } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthContext } from './context/AuthContext';
import AdminDashboard from './components/screens/AdminDashboard';
import CreateUser from './components/screens/CreateUser';
import DoctorDashboard from './components/screens/DoctorDashboard';
import Login from './components/screens/Login';
import RegisterPatient from './components/screens/RegisterPatient';
import UserQueue from './components/screens/UserQueue';
import './App.css';
import logo from './assets/logo.png';

function Header() {
  const { user, logout } = useContext(AuthContext);
  if (!user) return null;
  return (
    <header className="app-header">
      <div className="header-left">
        <span className="header-role">Logado como: <strong>{user.role}</strong></span>
      </div>
      <div className="header-center">
        <img src={logo} alt="Logo" className="header-logo" />
        <h1 className="header-title">Fila Inteligente</h1>
      </div>
      <div className="header-right">
        <button className="logout-btn" onClick={logout}>Sair</button>
      </div>
    </header>
  );
}

const ProtectedRoute = () => {
  const { user } = useContext(AuthContext);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default function App() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const containerClassName = user ? "container header-active" : "container no-header-active";

  function DashboardRedirect() {
    if (!user) return <Navigate to="/login" replace />;
    switch (user.role) {
      case 'admin': return <Navigate to="/painel-admin" replace />;
      case 'doctor': return <Navigate to="/painel-medico" replace />;
      default: return <Navigate to="/fila" replace />;
    }
  }

  return (
    <div className={containerClassName}>
      <Header />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<DashboardRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/criar-conta" element={<CreateUser />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/painel-admin" element={<AdminDashboard />} />
            <Route path="/painel-medico" element={<DoctorDashboard />} />
            <Route path="/fila" element={<UserQueue />} />
            <Route path="/cadastrar-paciente" element={<RegisterPatient />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}