import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './DoctorsModal.css'; 

const DoctorsModal = ({ isOpen, onClose }) => {
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Apenas busca os dados se o modal estiver aberto e a lista de médicos vazia
    if (isOpen && doctors.length === 0) {
      setIsLoading(true);
      api.get('/doctors')
        .then(response => {
          setDoctors(response.data);
        })
        .catch(error => {
          console.error("Erro ao carregar a lista de médicos:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, doctors.length]); // Dependências do useEffect

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Nossos Médicos</h2>
        <div className="doctors-grid">
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            doctors.map(doctor => (
              <div key={doctor.id} className="doctor-card">
                <div className="doctor-avatar">🩺</div>
                <h3>{doctor.name}</h3>
                <p>Clínico Geral</p> {/* Você pode adicionar especialidades no futuro */}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorsModal;