import axios from 'axios';

const api = axios.create({
  // ALTERAÇÃO PRINCIPAL: A URL base agora é lida da variável de ambiente.
  // Em produção, será o endereço do seu backend no Render.
  // Em desenvolvimento, usará o valor do seu arquivo .env local.
  baseURL: process.env.REACT_APP_API_BASE_URL
  //baseURL: 'http://localhost:3001/api' 
});

// Seu interceptor para erros 401 (mantido, está correto)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Limpa dados de sessão do localStorage
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      localStorage.removeItem('token');
      // Redireciona para a tela de login ("/")
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;