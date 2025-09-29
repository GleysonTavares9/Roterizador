import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaRoute, FaTruck, FaMapMarkedAlt, FaChartLine } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/public-layout.css';

const PublicLayout = ({ children }) => {
  // Reset any scroll position when the layout mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="public-layout min-vh-100 d-flex flex-column">
      {/* Header */}
      <header className="bg-primary text-white py-3 shadow-sm">
        <Container>
          <div className="d-flex justify-content-between align-items-center">
            <Link to="/" className="text-white text-decoration-none">
              <h1 className="h4 mb-0 fw-bold">Sistema de Roteirização</h1>
            </Link>
            <div>
              <Link to="/login" className="btn btn-outline-light btn-sm ms-2">
                Entrar
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* Main Content */}
      <main className="flex-grow-1 d-flex align-items-center py-5">
        <Container className="py-4">
          <div className="row justify-content-center">
            <div className="col-lg-8 col-xl-6">
              {children}
            </div>
          </div>
        </Container>
      </main>

      {/* Footer */}
      <footer className="bg-light py-4 border-top">
        <Container>
          <div className="row">
            <div className="col-md-4 mb-4 mb-md-0">
              <h5 className="h6 mb-3">Sistema de Roteirização</h5>
              <p className="small text-muted mb-0">
                Solução inteligente para otimização de rotas e gestão de frotas.
              </p>
            </div>
            <div className="col-md-4 mb-4 mb-md-0">
              <h6 className="text-uppercase mb-3">Recursos</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-1">
                  <FaRoute className="me-2 text-primary" />
                  <span>Otimização de Rotas</span>
                </li>
                <li className="mb-1">
                  <FaTruck className="me-2 text-primary" />
                  <span>Gestão de Frotas</span>
                </li>
                <li className="mb-1">
                  <FaMapMarkedAlt className="me-2 text-primary" />
                  <span>Visualização em Mapa</span>
                </li>
                <li>
                  <FaChartLine className="me-2 text-primary" />
                  <span>Relatórios Avançados</span>
                </li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="text-uppercase mb-3">Suporte</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-1">
                  <a href="#" className="text-decoration-none text-muted small">Documentação</a>
                </li>
                <li className="mb-1">
                  <a href="#" className="text-decoration-none text-muted small">Central de Ajuda</a>
                </li>
                <li>
                  <a href="#" className="text-decoration-none text-muted small">Contato</a>
                </li>
              </ul>
            </div>
          </div>
          <hr className="my-4" />
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center">
            <p className="small text-muted mb-2 mb-md-0">
              &copy; {new Date().getFullYear()} Sistema de Roteirização. Todos os direitos reservados.
            </p>
            <div>
              <a href="#" className="text-decoration-none text-muted small me-3">Termos de Uso</a>
              <a href="#" className="text-decoration-none text-muted small">Política de Privacidade</a>
            </div>
          </div>
        </Container>
      </footer>

      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default PublicLayout;
