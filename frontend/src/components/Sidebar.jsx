import { Link, useLocation } from 'react-router-dom';
import { useState, useContext } from 'react';
import { 
  FaHome, 
  FaUpload, 
  FaRoute, 
  FaTruck, 
  FaBoxes,
  FaMapMarkerAlt,
  FaPlus,
  FaListUl,
  FaChartLine,
  FaFileExport,
  FaCog,
  FaInfoCircle,
  FaSearchLocation,
  FaCalendarAlt,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronRight
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import '../styles/sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState(null);
  const { logout } = useAuth();

  const menuItems = [
    {
      icon: <FaHome className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Início',
      path: '/',
    },
    {
      icon: <FaUpload className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Carregar Dados',
      path: '/upload',
    },
    {
      icon: <FaSearchLocation className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Geocodificar Endereços',
      path: '/geocode-upload',
    },
    {
      icon: <FaRoute className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Visualizar Rotas',
      path: '/routes',
    },
    {
      icon: <FaTruck className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Veículos',
      dropdown: true,
      items: [
        {
          icon: <FaListUl className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Listar Veículos',
          path: '/vehicles',
        },
        {
          icon: <FaPlus className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Novo Veículo',
          path: '/vehicles/new',
        }
      ]
    },
    {
      icon: <FaBoxes className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Perfis de Cubagem',
      dropdown: true,
      items: [
        {
          icon: <FaListUl className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Listar Perfis',
          path: '/cubage-profiles',
        },
        {
          icon: <FaPlus className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Novo Perfil',
          path: '/cubage-profiles/new',
        }
      ]
    },
    {
      icon: <FaMapMarkerAlt className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Pontos de Coleta',
      dropdown: true,
      items: [
        {
          icon: <FaListUl className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Listar Pontos',
          path: '/collection-points',
        },
        {
          icon: <FaCalendarAlt className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Calendário',
          path: '/collection-points/calendar',
        },
        {
          icon: <FaMapMarkerAlt className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Mapa de Pontos',
          path: '/collection-points/map',
        },
        {
          icon: <FaPlus className="me-3" style={{ fontSize: '1.2rem' }} />,
          text: 'Adicionar Ponto',
          path: '/collection-points/new',
        },
      ]
    },
    {
      icon: <FaChartLine className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Relatórios',
      path: '/reports',
    },
    {
      icon: <FaFileExport className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Exportar Dados',
      path: '/export',
    },
    {
      icon: <FaCog className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Configurações',
      path: '/settings',
    },
    {
      icon: <FaInfoCircle className="me-3" style={{ fontSize: '1.2rem' }} />,
      text: 'Sobre',
      path: '/about',
    }
  ];

  const handleDropdownToggle = (dropdownName, e) => {
    e.preventDefault();
    setOpenDropdown(openDropdown === dropdownName ? null : dropdownName);
  };

  const isDropdownActive = (paths) => {
    return paths.some(path => location.pathname.startsWith(path));
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você saiu do sistema com sucesso!');
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Ocorreu um erro ao sair do sistema. Por favor, tente novamente.');
    }
  };

  return (
    <div className="sidebar d-flex flex-column">
      <div className="sidebar-header p-3">
        <h3 className="m-0">Sistema de Roteirização</h3>
      </div>
      <nav className="sidebar-nav flex-grow-1 overflow-auto">
        <ul className="nav flex-column">
          {menuItems.map((item, index) => (
            <li key={index} className="nav-item">
              {item.dropdown ? (
                <div className="dropdown-container">
                  <div 
                    className={`d-flex align-items-center px-3 py-2 sidebar-dropdown ${isDropdownActive(item.items.map(i => i.path)) ? 'active' : ''}`}
                    onClick={(e) => handleDropdownToggle(item.text, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="me-2">{item.icon}</span>
                    <span className="flex-grow-1">{item.text}</span>
                    <span className="dropdown-arrow ms-2">
                      {openDropdown === item.text ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                    </span>
                  </div>
                  <div className={`sidebar-dropdown-content ${openDropdown === item.text ? 'show' : ''}`}>
                    {item.items.map((subItem, subIndex) => (
                      <Link 
                        key={subIndex} 
                        to={subItem.path}
                        className={`d-flex align-items-center px-4 py-2 sidebar-link ${location.pathname === subItem.path ? 'active' : ''}`}
                        onClick={() => setOpenDropdown(null)}
                      >
                        <span className="me-2">{subItem.icon}</span>
                        <span>{subItem.text}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link 
                  to={item.path}
                  className={`d-flex align-items-center px-3 py-2 sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="me-2">{item.icon}</span>
                  <span>{item.text}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer p-3 border-top">
        <button 
          className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center"
          onClick={handleLogout}
        >
          <FaSignOutAlt className="me-2" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
