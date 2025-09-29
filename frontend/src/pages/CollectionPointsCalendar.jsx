import React, { useState, useEffect } from 'react';
import { Card, Table, Alert, Spinner, Button, Badge, Form, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaCalendarAlt, FaList, FaArrowLeft, FaSyncAlt, FaRoute } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import collectionPointService from '../services/collectionPointService';
import { toast } from 'react-toastify';

const CollectionPointsCalendar = () => {
  console.log('Componente CollectionPointsCalendar montado');
  
  // Função para obter a data atual no formato YYYY-MM-DD
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Estados do componente
  const auth = useAuth();
  const [selectedDate, setSelectedDate] = useState(getCurrentDate()); // Data atual por padrão
  const [collectionPoints, setCollectionPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState(new Set());
  const navigate = useNavigate();
  

  console.log('Data selecionada:', selectedDate);

  // Formatar a data para exibição
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    
    try {
      // Cria a data ajustando para o fuso horário local
      // Extrai os componentes da data diretamente da string para evitar problemas de fuso horário
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Cria uma data local com os componentes extraídos
      const date = new Date(year, month - 1, day);
      
      // Verifica se a data é válida
      if (isNaN(date.getTime())) {
        console.error('Data inválida:', dateStr);
        return dateStr; // Retorna a string original se não for uma data válida
      }
      
      // Formata a data para 'dia/mês/ano' usando os valores já extraídos
      const dayFormatted = String(day).padStart(2, '0');
      const monthFormatted = String(month).padStart(2, '0');
      
      return `${dayFormatted}/${monthFormatted}/${year}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dateStr; // Retorna a string original em caso de erro
    }
  };

  // Obter variante do badge com base na frequência
  const getFrequencyVariant = (frequency) => {
    if (!frequency) return 'secondary';
    
    const freq = typeof frequency === 'string' ? frequency.toLowerCase() : '';
    
    switch (freq) {
      case 'diário':
      case 'daily':
        return 'primary';
      case 'semanal':
      case 'weekly':
        return 'success';
      case 'quinzenal':
      case 'biweekly':
        return 'info';
      case 'mensal':
      case 'monthly':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  // Carregar pontos de coleta
  const loadCollectionPoints = async (dateStr) => {
    try {
      setLoading(true);
      setError(null);
      
      // Garante que a data está no formato YYYY-MM-DD
      const formattedDate = dateStr.split('T')[0];
      
      console.log('Carregando pontos para a data:', formattedDate);
      
      // Atualiza o título da página com a data selecionada
      document.title = `Coletas Programadas - ${formattedDate}`;
      
      // Limpa os pontos de coleta atuais para evitar mostrar dados antigos
      setCollectionPoints([]);
      
      // Usa compatibilidade para obter um array simples
      const response = await collectionPointService.getAll({ 
        date: formattedDate,
        active_only: true, // Apenas pontos ativos
        compatibilidade: true // Garante que retorna um array simples
      });
      
      console.log('Dados recebidos da API para', formattedDate, ':', response);
      
      // Extrai os itens da resposta, seja de um array direto ou de um objeto com propriedade items
      const items = Array.isArray(response) ? response : (response.items || []);
      
      // Atualiza o estado com os novos dados
      setCollectionPoints(items);
      
    } catch (err) {
      console.error('Erro ao carregar pontos de coleta:', err);
      setError('Erro ao carregar pontos de coleta. Tente novamente mais tarde.');
      toast.error('Erro ao carregar pontos de coleta');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando o componente montar ou quando a data mudar
  useEffect(() => {
    let isMounted = true;
    
    console.log('useEffect - Iniciando carregamento para a data:', selectedDate);
    
    // Evita chamadas desnecessárias se a data for a mesma
    const loadData = async () => {
      if (selectedDate) {
        console.log('Iniciando carregamento dos dados...');
        try {
          await loadCollectionPoints(selectedDate);
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
          if (isMounted) {
            setError('Erro ao carregar os dados. Tente novamente.');
          }
        }
      }
    };
    
    loadData();
    
    // Limpa o título quando o componente for desmontado
    return () => {
      isMounted = false;
      document.title = 'Sistema de Rotas';
    };
  }, [selectedDate]); // Executa quando selectedDate mudar

  // Estado para controlar seleção de todos os itens
  const [selectAll, setSelectAll] = useState(false);

  // Atualizar seleção quando a lista de pontos mudar
  useEffect(() => {
    // Limpar seleção quando os pontos forem carregados
    setSelectedPoints(new Set());
    setSelectAll(false);
  }, [collectionPoints]);

  // Toggle para selecionar/desselecionar um ponto
  const togglePointSelection = (pointId) => {
    console.log('togglePointSelection chamado para pointId:', pointId);
    setSelectedPoints(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(pointId)) {
        newSelected.delete(pointId);
      } else {
        newSelected.add(pointId);
      }
      console.log('Novo estado de selectedPoints:', Array.from(newSelected));
      return newSelected;
    });
  };

  // Alternar seleção de todos os pontos
  const toggleSelectAll = () => {
    console.log('toggleSelectAll chamado');
    const newSelectedPoints = new Set();
    if (selectAll) {
      setSelectedPoints(new Set());
    } else {
      setSelectedPoints(new Set(collectionPoints.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  };

  // Navegar para a página de upload com os pontos selecionados
  const navigateToRoutes = () => {
    console.log('Botão Rotear clicado. selectedPoints:', selectedPoints);
    
    if (selectedPoints.size === 0) {
      console.log('Nenhum ponto selecionado para rotear');
      return;
    }
    
    // Obter os detalhes completos dos pontos selecionados
    const selectedPointsData = collectionPoints.filter(p => selectedPoints.has(p.id));
    
    console.log('Navegando para /upload com pontos selecionados:', selectedPointsData);
    
    // Verificar autenticação antes de navegar
    console.log('Verificando autenticação...');
    const token = localStorage.getItem('token');
    console.log('Token no localStorage:', token ? 'Presente' : 'Ausente');
    
    console.log('Estado do auth:', {
      isAuthenticated: auth.isAuthenticated,
      currentUser: auth.currentUser,
      loading: auth.loading
    });
    
    // Navegar para a página de upload com os pontos selecionados
    console.log('Iniciando navegação para /upload');
    
    // Forçar um pequeno atraso para garantir que os logs sejam exibidos
    setTimeout(() => {
      navigate('/upload', { 
        state: { 
          selectedPoints: selectedPointsData.map(p => ({
            id: p.id,
            name: p.name || `Ponto ${p.id}`,
            address: [
              p.address,
              p.neighborhood,
              p.city,
              p.state
            ].filter(Boolean).join(', '),
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
            quantity: 1, // Valor padrão
            weight: 0, // Valor padrão
            volume: 0.1, // Valor padrão
            timeWindow: {
              start: '08:00', // Valor padrão
              end: '18:00'   // Valor padrão
            },
            frequency: p.frequency,
            days_of_week: p.days_of_week,
            weeks_of_month: p.weeks_of_month
          }))
        } 
      });
    }, 100);
  };

  // Função para formatar o dia da semana com base na data selecionada
  const formatDaysOfWeek = (days) => {
    if (!days) return '-';
    
    try {
      // Obtém o dia da semana da data selecionada (0 = Domingo, 1 = Segunda, etc.)
      const date = new Date(selectedDate + 'T12:00:00');
      const dayOfWeek = date.getDay(); // 0-6 (Domingo-Sábado)
      
      // Mapeia o número do dia para o nome abreviado
      const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return daysMap[dayOfWeek] || '-';
    } catch (error) {
      console.error('Erro ao formatar dia da semana:', error, 'Data:', selectedDate);
      return '-';
    }
  };

  // Função para formatar a data como "1ª Quinta do Mês"
  const formatWeekOfMonth = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      const day = date.getDate();
      const dayOfWeek = date.getDay();
      
      // Calcula a semana do mês (1ª, 2ª, 3ª, 4ª ou última)
      const weekOfMonth = Math.ceil(day / 7);
      
      // Mapeia o número do dia para o nome completo
      const daysMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const dayName = daysMap[dayOfWeek] || '';
      
      // Retorna no formato "1ª Quinta do Mês"
      return `${weekOfMonth}ª ${dayName} do Mês`;
    } catch (error) {
      console.error('Erro ao formatar semana do mês:', error);
      return '';
    }
  };

  console.log('Renderizando CollectionPointsCalendar com', collectionPoints.length, 'pontos de coleta');
  console.log('Dados dos pontos de coleta:', collectionPoints);
  
  console.log('Renderizando CollectionPointsCalendar - selectedDate:', selectedDate);
  console.log('collectionPoints:', collectionPoints);
  
  return (
    <PageLayout
      title={
        <div className="d-flex align-items-center">
          <Button 
            variant="link" 
            onClick={() => navigate(-1)} 
            className="p-0 me-2"
            title="Voltar"
          >
            <FaArrowLeft size={20} />
          </Button>
          <div>
            <h4 className="mb-0">Coletas Programadas</h4>
            <small className="text-muted">
              Visualização por data: {formatDateDisplay(selectedDate)}
              <span className="ms-2 text-muted">({selectedDate})</span>
            </small>
          </div>
        </div>
      }
      headerActions={
        <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <InputGroup style={{ width: 'auto' }}>
            <InputGroup.Text style={{ backgroundColor: '#f8f9fa', borderRight: 'none' }}>
              <FaCalendarAlt />
            </InputGroup.Text>
            <Form.Control
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newDateStr = e.target.value;
                console.log('Nova data selecionada:', newDateStr);
                if (newDateStr && newDateStr !== selectedDate) {
                  // Atualiza o estado com a nova data
                  setSelectedDate(newDateStr);
                  // O useEffect irá detectar a mudança e carregar os novos dados
                }
              }}
              style={{
                borderLeft: 'none',
                borderRight: '1px solid #ced4da',
                borderRadius: '0',
                minWidth: '150px'
              }}
            />
            <Button 
              variant="outline-secondary" 
              onClick={() => loadCollectionPoints(selectedDate)}
              disabled={loading}
              title="Atualizar"
            >
              <FaSyncAlt className={loading ? 'fa-spin' : ''} />
            </Button>
          </InputGroup>
            <Link to="/collection-points" className="btn btn-outline-primary">
              <FaList className="me-2" />
              Lista
            </Link>
          </div>
        </div>
      }
    >
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">
                Coletas Programadas
                <span className="ms-2 badge bg-primary">
                  {formatWeekOfMonth(selectedDate)}
                </span>
              </h5>
              <small className="text-muted">
                {formatDateDisplay(selectedDate)} - {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
              </small>
            </div>
            <div>
              <Button 
                variant="primary" 
                onClick={(e) => {
                  console.log('Botão Roteirizar clicado', { 
                    selectedPoints: Array.from(selectedPoints),
                    selectedPointsSize: selectedPoints.size,
                    event: e 
                  });
                  e.preventDefault();
                  e.stopPropagation();
                  navigateToRoutes();
                }}
                disabled={selectedPoints.size === 0}
                className="me-2"
                id="roteirizar-button"
              >
                <FaRoute className="me-2" />
                Roteirizar {selectedPoints.size > 0 ? `(${selectedPoints.size})` : ''}
              </Button>
            </div>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="text-muted">
              {collectionPoints.length} ponto{collectionPoints.length !== 1 ? 's' : ''} encontrado{collectionPoints.length !== 1 ? 's' : ''}
              {collectionPoints.length > 0 && ` (${selectedPoints.size} selecionado${selectedPoints.size !== 1 ? 's' : ''})`}
            </div>
          </div>

          {loading && collectionPoints.length === 0 ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </Spinner>
              <div className="mt-2">Carregando pontos para {formatDateDisplay(selectedDate)}...</div>
            </div>
          ) : collectionPoints.length === 0 ? (
            <Alert variant="info" className="text-center">
              Nenhum ponto de coleta encontrado para o dia {formatDateDisplay(selectedDate)}.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped hover className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '40px' }}>
                      <Form.Check 
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>ID Externo</th>
                    <th>Nome</th>
                    <th>Frequência</th>
                    <th>Contato</th>
                    <th>Endereço</th>
                    <th>Cidade/UF</th>
                    <th>Dias da Semana</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionPoints.map((point) => (
                    <tr key={point.id} className={!point.is_active ? 'text-muted' : ''}>
                      <td>
                        <Form.Check 
                          type="checkbox"
                          checked={selectedPoints.has(point.id)}
                          onChange={() => togglePointSelection(point.id)}
                        />
                      </td>
                      <td>
                        <span className="badge bg-light text-dark">
                          {point.external_id || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="fw-medium">{point.name || 'Não informado'}</div>
                        {point.email && (
                          <div className="text-muted small">{point.email}</div>
                        )}
                      </td>
                      <td>
                        <Badge bg={getFrequencyVariant(point.frequency)}>
                          {point.frequency || '-'}
                        </Badge>
                      </td>
                      <td>
                        {point.phone && (
                          <div>{point.phone}</div>
                        )}
                      </td>
                      <td>
                        <div>{point.address || 'Não informado'}</div>
                        {point.neighborhood && (
                          <div className="text-muted small">{point.neighborhood}</div>
                        )}
                        {point.zip_code && (
                          <div className="text-muted small">CEP: {point.zip_code}</div>
                        )}
                      </td>
                      <td>
                        {point.city || 'Não informada'}
                        {point.state && `/${point.state}`}
                      </td>
                      <td>
                        {formatDaysOfWeek(point.days_of_week)}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${point.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {point.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </PageLayout>
  );
};

export default CollectionPointsCalendar;
