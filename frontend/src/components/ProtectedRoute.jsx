import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import authService from '../services/authService';

export const ProtectedRoute = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verifica se o token é válido
        const isValid = await authService.checkAndRenewToken();
        setIsAuthenticated(isValid);
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [location]);

  if (isLoading) {
    // Exibe um spinner de carregamento enquanto verifica a autenticação
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  // Se o usuário não estiver autenticado, redireciona para a página de login
  if (!isAuthenticated) {
    // Salva a rota atual para redirecionar após o login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado, renderiza a rota protegida
  return <Outlet />;
};

export default ProtectedRoute;
