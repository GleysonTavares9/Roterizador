import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export const PublicRoute = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verifica se há um token no localStorage
        const token = localStorage.getItem('token');
        setIsAuthenticated(!!token);
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

  // Se o usuário estiver autenticado, redireciona para a página inicial
  if (isAuthenticated) {
    // Redireciona para a página de origem ou para a página inicial
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  // Se não estiver autenticado, renderiza a rota pública
  return <Outlet />;
};

export default PublicRoute;
