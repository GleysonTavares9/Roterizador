import axios from 'axios';
import api from './api';
import { getToken, setToken, clearToken, setOnTokenRefreshed } from './tokenService';

const authService = {
  // Registra um novo usuário
  async register(userData) {
    try {
      const response = await api.post('/auth/register', {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        password_confirm: userData.confirmPassword,
        is_active: true,
        is_admin: false
      });
      
      if (response.data) {
        return { success: true, message: 'Conta criada com sucesso! Faça login para continuar.' };
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
      let message = 'Erro ao criar conta. Tente novamente.';
      
      if (error.response) {
        if (error.response.status === 400) {
          message = error.response.data?.detail || 'Dados inválidos';
        } else if (error.response.data?.detail) {
          message = error.response.data.detail;
        } else if (error.response.data?.message) {
          message = error.response.data.message;
        }
      } else if (error.message) {
        message = error.message;
      }
      
      return { success: false, message };
    }
  },
  
  // Realiza o login do usuário
  async login(email, password) {
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      
      // Usa o axios diretamente para evitar problemas com o interceptor
      const response = await axios.post(
 'http://localhost:8000/auth/token',
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      if (!response.data || !response.data.access_token) {
        throw new Error('Resposta inválida do servidor');
      }
      
      const { access_token: accessToken } = response.data;
      this.setAuthToken(accessToken);
      
      // Armazena informações do usuário no localStorage
      const user = this.getDecodedToken();
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      let message = 'Erro ao fazer login. Tente novamente.';
      
      if (error.response) {
        if (error.response.status === 401) {
          message = 'Email ou senha incorretos';
        } else if (error.response.data?.detail) {
          message = error.response.data.detail;
        } else if (error.response.data?.message) {
          message = error.response.data.message;
        }
      } else if (error.message) {
        message = error.message;
      }
      
      return { success: false, message };
    }
  },
  
  // Define o token de autenticação
  setAuthToken(token) {
    if (token) {
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      this.clearAuthToken();
    }
  },
  
  // Limpa o token de autenticação
  clearAuthToken() {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  },
  
  // Realiza o logout do usuário
  logout() {
    this.clearAuthToken();
  },
  
  // Verifica se o usuário está autenticado
  isAuthenticated() {
    return !!this.getToken() && !this.isTokenExpired();
  },
  
  // Obtém o token de autenticação
  getToken() {
    return getToken();
  },
  
  // Obtém os dados do token decodificado
  getDecodedToken() {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      console.error('Erro ao decodificar token:', error);
      return null;
    }
  },
  
  // Verifica se o token está expirado
  isTokenExpired(token = this.getToken()) {
    if (!token) return true;
    
    try {
      const payload = this.getDecodedToken();
      if (!payload?.exp) return true;
      
      const expiresAt = payload.exp * 1000; // Converte para milissegundos
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutos de buffer
      
      return now >= (expiresAt - bufferTime);
    } catch (error) {
      console.error('Erro ao verificar token expirado:', error);
      return true;
    }
  },
  
  // Verifica e renova o token se necessário
  async checkAndRenewToken() {
    const token = this.getToken();
    console.log('Verificando token para renovação...');
    
    // Se não tem token, retorna falso
    if (!token) {
      console.log('Nenhum token encontrado para renovação');
      return false;
    }
    
    // Verifica se o token está expirado
    const isExpired = this.isTokenExpired(token);
    console.log('Token expirado?', isExpired);
    
    // Se o token não está expirado, retorna verdadeiro
    if (!isExpired) {
      console.log('Token válido, não é necessário renovar');
      return true;
    }
    
    // Se o token está expirado, tenta renovar
    console.log('Token expirado, tentando renovar...');
    try {
      const response = await api.post('/auth/refresh');
      console.log('Resposta da renovação de token:', response);
      
      if (response.data?.access_token) {
        console.log('Token renovado com sucesso');
        this.setAuthToken(response.data.access_token);
        return true;
      } else {
        console.error('Resposta de renovação de token inválida:', response);
        this.clearAuthToken();
        return false;
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      this.clearAuthToken();
      return false;
    }
  }
};

// Configura o callback para quando o token for atualizado
setOnTokenRefreshed((newToken) => {
  authService.setAuthToken(newToken);
});

export default authService;
