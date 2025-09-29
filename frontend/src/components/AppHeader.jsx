import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Dropdown, Badge } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../contexts/ThemeContext';
import { FaUser, FaSignOutAlt, FaBell, FaCog, FaBars, FaChevronDown } from 'react-icons/fa';

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simular notificações (substituir por chamada à API real)
  useEffect(() => {
    const mockNotifications = [
      { id: 1, message: 'Nova rota otimizada disponível', read: false, time: '5 min atrás' },
      { id: 2, message: 'Atualização do sistema concluída', read: true, time: '2 horas atrás' },
      { id: 3, message: 'Novo ponto de coleta adicionado', read: false, time: '1 dia atrás' },
    ];
    
    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <header className="app-header">
      <Navbar expand="lg" className="app-navbar">
        <Container fluid>
          {/* Botão para alternar a sidebar em telas pequenas */}
          <button 
            className="btn btn-link d-lg-none me-2 p-2 sidebar-toggle" 
            onClick={onToggleSidebar}
            aria-label="Alternar menu"
          >
            <FaBars size={20} />
          </button>
          
          {/* Título da página atual */}
          <h1 className="page-title m-0 d-none d-lg-block">
            {getPageTitle(location.pathname)}
          </h1>
          
          <Navbar.Toggle aria-controls="main-navbar" className="ms-auto" />
          
          <Navbar.Collapse id="main-navbar" className="justify-content-end">
            <Nav className="align-items-center">
              {/* Seletor de Tema */}
              <Nav.Item className="me-3">
                <ThemeToggle className="theme-toggle" />
              </Nav.Item>
              
              {/* Notificações */}
              <Dropdown as={Nav.Item} className="me-3">
                <Dropdown.Toggle as={Nav.Link} className="position-relative p-2 notification-btn">
                  <FaBell />
                  {unreadCount > 0 && (
                    <Badge pill bg="danger" className="position-absolute top-0 end-0 notification-badge">
                      {unreadCount}
                    </Badge>
                  )}
                </Dropdown.Toggle>
                
                <Dropdown.Menu className="dropdown-menu-end" style={{ minWidth: '320px' }}>
                  <div className="px-3 py-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">Notificações</h6>
                      <Badge bg="primary">{unreadCount} não lidas</Badge>
                    </div>
                  </div>
                  
                  {notifications.length > 0 ? (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.map(notification => (
                        <Dropdown.Item 
                          key={notification.id} 
                          className={`py-3 px-3 ${!notification.read ? 'bg-light' : ''}`}
                        >
                          <div className="d-flex">
                            <div className="flex-grow-1">
                              <p className="mb-1">{notification.message}</p>
                              <small className="text-muted">{notification.time}</small>
                            </div>
                            {!notification.read && (
                              <Badge bg="primary" pill className="ms-2">Nova</Badge>
                            )}
                          </div>
                        </Dropdown.Item>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-muted">
                      Nenhuma notificação
                    </div>
                  )}
                  
                  <div className="p-2 border-top text-center">
                    <button className="btn btn-link btn-sm text-primary">
                      Ver todas as notificações
                    </button>
                  </div>
                </Dropdown.Menu>
              </Dropdown>
              
              {/* Perfil do Usuário */}
              <Dropdown as={Nav.Item}>
                <Dropdown.Toggle as={Nav.Link} className="user-menu p-0">
                  <div className="d-flex align-items-center">
                    <div className="user-avatar me-2">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="user-info d-none d-lg-block">
                      <div className="user-name">{user?.name || 'Usuário'}</div>
                      <div className="user-role small text-muted">
                        {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </div>
                    </div>
                    <FaChevronDown size={12} className="d-none d-lg-block ms-2" />
                  </div>
                </Dropdown.Toggle>
                
                <Dropdown.Menu className="dropdown-menu-end">
                  <Dropdown.Header className="text-center py-2">
                    <div className="user-avatar mx-auto mb-2" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="fw-bold">{user?.name || 'Usuário'}</div>
                    <small className="text-muted">{user?.email || ''}</small>
                  </Dropdown.Header>
                  <Dropdown.Divider />
                  <Dropdown.Item as={Link} to="/profile">
                    <FaUser className="me-2" /> Meu Perfil
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/settings">
                    <FaCog className="me-2" /> Configurações
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout} className="text-danger">
                    <FaSignOutAlt className="me-2" /> Sair
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  );
};

// Helper function to get page title based on path
const getPageTitle = (pathname) => {
  const path = pathname.split('/')[1];
  const titles = {
    '': 'Dashboard',
    'upload': 'Carregar Dados',
    'geocode-upload': 'Geocodificar Dados',
    'routes': 'Visualizar Rotas',
    'vehicles': 'Veículos',
    'cubage-profiles': 'Perfis de Cubagem',
    'collection-points': 'Pontos de Coleta',
    'reports': 'Relatórios',
    'export': 'Exportar Dados',
    'settings': 'Configurações',
    'about': 'Sobre',
    'profile': 'Meu Perfil'
  };

  return titles[path] || 'Dashboard';
};

export default Header;
