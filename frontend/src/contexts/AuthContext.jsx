import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import authService from '../services/authService';
import { useNavigate } from 'react-router-dom';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Auth provider component
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // Inicia como true para carregar a autenticação
  const [error, setError] = useState('');

  // Verifica se o usuário está autenticado
  const isAuthenticated = useMemo(() => {
    const isAuth = !!currentUser;
    console.log('isAuthenticated:', isAuth, 'currentUser:', currentUser);
    return isAuth;
  }, [currentUser]);

  // Carrega o usuário no carregamento inicial
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      // Se já temos um usuário autenticado, não precisamos verificar novamente
      if (currentUser) {
        setLoading(false);
        return;
      }
      
      // Define um tempo máximo de espera para evitar loops infinitos
      const authCheckTimeout = setTimeout(() => {
        if (isMounted) {
          console.error('Tempo excedido ao verificar autenticação');
          setLoading(false);
        }
      }, 10000); // 10 segundos
      
      try {
        console.log('Verificando autenticação...');
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.log('Nenhum token encontrado, usuário não autenticado');
          if (isMounted) {
            setCurrentUser(null);
            setLoading(false);
          }
          return;
        }
        
        try {
          console.log('Verificando validade do token...');
          const isValid = await authService.checkAndRenewToken();
          console.log('Token válido?', isValid);
          
          if (isValid) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              console.log('Payload do token:', payload);
              
              if (isMounted) {
                setCurrentUser({ email: payload.sub });
                setLoading(false);
              }
              return; // Sai da função se o token for válido
            } catch (parseError) {
              console.error('Erro ao decodificar token:', parseError);
              if (isMounted) {
                setCurrentUser(null);
                setLoading(false);
              }
              localStorage.removeItem('token');
              return;
            }
          }
          
          // Se chegou aqui, o token é inválido ou expirado
          console.log('Token inválido ou expirado');
          if (isMounted) {
            setCurrentUser(null);
            setLoading(false);
          }
          localStorage.removeItem('token');
        } catch (tokenError) {
          console.error('Erro ao verificar token:', tokenError);
          if (isMounted) {
            setCurrentUser(null);
            setLoading(false);
          }
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Erro inesperado ao verificar autenticação:', error);
        if (isMounted) {
          setCurrentUser(null);
          setLoading(false);
        }
        localStorage.removeItem('token');
      } finally {
        clearTimeout(authCheckTimeout);
      }
    };

    // Adiciona um pequeno atraso para evitar piscar a tela de login
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentUser]); // Dependência adicionada para evitar loops

  // Função de login
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Iniciando processo de login...');
      const result = await authService.login(email, password);
      console.log('Resposta do login:', result);
      
      if (!result.success) {
        const errorMsg = result.message || 'Falha no login. Verifique suas credenciais.';
        console.error('Erro no login:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const token = localStorage.getItem('token');
      console.log('Token armazenado após login:', !!token);
      
      if (!token) {
        const errorMsg = 'Token não encontrado após login.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Decodifica o token para obter as informações do usuário
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Payload do token após login:', payload);
      
      // Atualiza o estado do usuário
      setCurrentUser({ email: payload.sub });
      
      // Redireciona para a página inicial ou para a rota de origem
      const from = new URLSearchParams(window.location.search).get('redirect') || '/';
      console.log('Redirecionando para:', from);
      navigate(from, { replace: true });
      
      return { success: true };
    } catch (error) {
      console.error('Erro no login:', error);
      const errorMsg = error.message || 'Erro ao fazer login. Tente novamente.';
      setError(errorMsg);
      return { 
        success: false, 
        error: errorMsg
      };
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Função de logout
  const logout = useCallback(() => {
    try {
      authService.logout();
      setCurrentUser(null);
      navigate('/login', { 
        state: { 
          message: 'Você foi desconectado com sucesso.',
          type: 'success'
        },
        replace: true 
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo em caso de erro, limpa o estado do usuário
      setCurrentUser(null);
      navigate('/login', { 
        state: { 
          message: 'Sessão encerrada. Por favor, faça login novamente.',
          type: 'info'
        },
        replace: true 
      });
    }
  }, [navigate]);

  // Atualiza os dados do usuário
  const updateUser = useCallback((userData) => {
    setCurrentUser(prev => ({
      ...prev,
      ...userData
    }));
  }, []);

  // Log temporário para depuração
  useEffect(() => {
    console.log('Auth State:', {
      currentUser,
      isAuthenticated,
      loading,
      error,
      hasToken: !!localStorage.getItem('token')
    });
  }, [currentUser, isAuthenticated, loading, error]);

  // The value that will be passed to the context consumers
  const value = useMemo(() => ({
    currentUser,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    updateUser,
    setError
  }), [currentUser, isAuthenticated, loading, error, login, logout, updateUser]);

  // Retorna o provider com ou sem o estado de carregamento
  // Não mostramos mais um spinner aqui para evitar problemas de renderização
  // O estado de carregamento é tratado individualmente nos componentes que precisam
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext;
