import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Alert, Row, Col, Spinner, Form } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaTrash, FaEye, FaArrowLeft, FaPlus } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import collectionPointService from '../services/collectionPointService';
import { toast } from 'react-toastify';

const CollectionPoints = () => {
  // Hooks devem estar no topo do componente
  const { id } = useParams();
  const location = window.location.pathname;
  const navigate = useNavigate();
  
  // Função para formatar a data para exibição
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    
    try {
      // Cria a data ajustando para o fuso horário local
      // Extrai os componentes da data diretamente da string para evitar problemas de fuso horário
      const date = new Date(dateStr);
      
      // Verifica se a data é válida
      if (isNaN(date.getTime())) {
        console.error('Data inválida:', dateStr);
        return dateStr; // Retorna a string original se não for uma data válida
      }
      
      // Obtém os componentes da data local
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dateStr; // Retorna a string original em caso de erro
    }
  };
  
  // Estados principais
  const [collectionPoints, setCollectionPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState({});
  
  // Determina se está em modo de criação ou edição
  const isNew = location.endsWith('/new');
  const isEditing = location.includes('/edit/') && id;
  const isViewing = id && !isEditing;
  
  // Estados para busca e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    external_id: '',
    name: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    notes: '',
    frequency: '',
    latitude: '',
    longitude: '',
    days_of_week: '',
    weeks_of_month: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  
  // Constantes derivadas - removidas pois agora são definidas acima

  // Função para carregar os pontos de coleta
  const loadCollectionPoints = async () => {
    try {
      console.log('Iniciando carregamento dos pontos de coleta...');
      setLoading(true);
      
      // Chama o serviço com compatibilidade para a estrutura antiga
      const response = await collectionPointService.getAll({ compatibilidade: true });
      
      // Verifica se a resposta tem a estrutura nova (com items) ou é um array direto
      const points = Array.isArray(response) ? response : (response.items || []);
      
      console.log('Dados recebidos da API:', response);
      setCollectionPoints(points);
      setError(null);
      console.log('Pontos de coleta definidos no estado:', points);
    } catch (err) {
      console.error('Erro ao carregar pontos de coleta:', err);
      setError(err.message || 'Erro ao carregar os pontos de coleta');
      setCollectionPoints([]); // Garante que collectionPoints seja um array vazio em caso de erro
    } finally {
      setLoading(false);
      console.log('Estado após carregamento - loading:', false, 'erro:', error);
    }
  };

  // Carrega os pontos de coleta quando o componente é montado
  useEffect(() => {
    console.log('Componente montado - Carregando pontos de coleta...');
    loadCollectionPoints();
    
    // Verifica se há um token de autenticação
    const token = localStorage.getItem('token');
    console.log('Token de autenticação:', token ? 'Encontrado' : 'Não encontrado');
    
    // Força uma nova tentativa de carregamento após 2 segundos se não houver dados
    const timer = setTimeout(() => {
      if (collectionPoints.length === 0 && !loading && !error) {
        console.log('Nenhum dado carregado após 2 segundos - Tentando novamente...');
        loadCollectionPoints();
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Carrega os dados do ponto de coleta quando estiver em modo de edição
  useEffect(() => {
    const loadCollectionPoint = async () => {
      if (!isEditing) return;
      
      try {
        setLoading(true);
        const data = await collectionPointService.getById(id);
        setFormData({
          external_id: data.external_id || '',
          name: data.name || '',
          address: data.address || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          phone: data.phone || '',
          email: data.email || '',
          notes: data.notes || '',
          frequency: data.frequency || '',
          latitude: data.latitude || '',
          longitude: data.longitude || '',
          days_of_week: data.days_of_week || '',
          weeks_of_month: data.weeks_of_month || '',
          is_active: data.is_active !== false
        });
      } catch (err) {
        console.error('Erro ao carregar ponto de coleta:', err);
        setError('Erro ao carregar os dados do ponto de coleta');
        toast.error('Erro ao carregar os dados do ponto de coleta');
      } finally {
        setLoading(false);
      }
    };
    
    loadCollectionPoint();
  }, [id, isEditing]);



  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Nome é obrigatório';
    if (!formData.address) errors.address = 'Endereço é obrigatório';
    if (!formData.neighborhood) errors.neighborhood = 'Bairro é obrigatório';
    if (!formData.city) errors.city = 'Cidade é obrigatória';
    if (!formData.state) errors.state = 'Estado é obrigatório';
    
    // Validação para days_of_week
    if (formData.days_of_week && !/^([1-7])(,[1-7])*$/.test(formData.days_of_week)) {
      errors.days_of_week = 'Formato inválido. Use números de 1 a 7 separados por vírgula (ex: 1,2,3,4,5)';
    }
    
    // Validação para weeks_of_month
    if (formData.weeks_of_month && !/^([1-4])(,[1-4])*$/.test(formData.weeks_of_month)) {
      errors.weeks_of_month = 'Formato inválido. Use números de 1 a 4 separados por vírgula (ex: 1,2,3,4)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setFormSubmitting(true);
      
      // Preparar os dados para envio
      const dataToSend = { ...formData };
      
      console.log('Dados do formulário antes do processamento:', JSON.stringify(dataToSend, null, 2));
      
      // Remover campos vazios ou com apenas espaços em branco
      Object.keys(dataToSend).forEach(key => {
        if (typeof dataToSend[key] === 'string') {
          dataToSend[key] = dataToSend[key].trim();
          if (dataToSend[key] === '') {
            dataToSend[key] = null;
          }
        }
      });
      
      // Garantir que days_of_week e weeks_of_month estejam no formato correto
      if (dataToSend.days_of_week) {
        dataToSend.days_of_week = dataToSend.days_of_week.replace(/\s+/g, ''); // Remove espaços
      }
      
      if (dataToSend.weeks_of_month) {
        dataToSend.weeks_of_month = dataToSend.weeks_of_month.replace(/\s+/g, ''); // Remove espaços
      }
      
      console.log('Dados a serem enviados para a API:', JSON.stringify(dataToSend, null, 2));
      
      if (isEditing) {
        console.log('Atualizando ponto de coleta...');
        const response = await collectionPointService.update(id, dataToSend);
        console.log('Resposta da API após atualização:', JSON.stringify(response, null, 2));
        toast.success('Ponto de coleta atualizado com sucesso!');
        
        // Recarrega a lista de pontos de coleta
        await loadCollectionPoints();
        
        // Navega de volta para a lista
        navigate('/collection-points');
        console.log('Redirecionamento concluído');
      } else {
        const newPoint = await collectionPointService.create(dataToSend);
        toast.success('Ponto de coleta criado com sucesso!');
        navigate(`/collection-points/${newPoint.id}`);
      }
    } catch (err) {
      console.error('Erro ao salvar ponto de coleta:', err);
      
      // Mensagem de erro mais descritiva
      let errorMessage = 'Erro ao salvar o ponto de coleta';
      
      if (err.response) {
        // Erro da API
        if (err.response.status === 422) {
          // Erro de validação
          errorMessage = 'Erro de validação: ';
          if (err.response.data && err.response.data.detail) {
            // Se o backend retornar detalhes do erro
            if (Array.isArray(err.response.data.detail)) {
              errorMessage += err.response.data.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
            } else if (typeof err.response.data.detail === 'string') {
              errorMessage += err.response.data.detail;
            } else {
              errorMessage += JSON.stringify(err.response.data.detail);
            }
          } else {
            errorMessage += 'Verifique os dados informados';
          }
        } else if (err.response.status === 400) {
          // Bad Request
          errorMessage = err.response.data.detail || 'Dados inválidos fornecidos';
        } else if (err.response.status === 401) {
          // Não autorizado
          errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
          // Redireciona para a página de login
          navigate('/login');
        } else if (err.response.status === 403) {
          // Acesso negado
          errorMessage = 'Você não tem permissão para realizar esta ação';
        } else if (err.response.status === 404) {
          // Não encontrado
          errorMessage = 'Recurso não encontrado';
        } else if (err.response.status >= 500) {
          // Erro do servidor
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        }
      } else if (err.request) {
        // A requisição foi feita mas não houve resposta
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
      } else if (err.message) {
        // Outros erros
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Renderiza a visualização de um ponto específico
  if (isViewing) {
    const point = collectionPoints.find(p => p.id === parseInt(id));
    
    if (!point) {
      return (
        <PageLayout title="Ponto de Coleta">
          <Alert variant="warning">Ponto de coleta não encontrado.</Alert>
          <Button variant="secondary" onClick={() => navigate('/collection-points')}>
            Voltar para a lista
          </Button>
        </PageLayout>
      );
    }

    return (
      <PageLayout title={`Visualizar Ponto de Coleta - ${point.name || 'Sem Nome'}`}>
        <Button 
          variant="link" 
          onClick={() => navigate('/collection-points')}
          className="mb-3 p-0 d-flex align-items-center"
        >
          <FaArrowLeft className="me-2" /> Voltar para a lista
        </Button>
        
        <Card>
          <Card.Body>
            <Row>
              <Col md={6}>
                <h5>Informações do Ponto de Coleta</h5>
                <hr />
                <p><strong>Nome:</strong> {point.name || 'Não informado'}</p>
                <p><strong>ID Externo:</strong> {point.external_id || 'Não informado'}</p>
                <p><strong>Endereço:</strong> {point.address || 'Não informado'}</p>
                <p><strong>Bairro:</strong> {point.neighborhood || 'Não informado'}</p>
                <p><strong>Cidade/UF:</strong> {point.city || 'Não informada'}{point.state ? `/${point.state}` : ''}</p>
                <p><strong>CEP:</strong> {point.zip_code || 'Não informado'}</p>
              </Col>
              <Col md={6}>
                <h5>Contato</h5>
                <hr />
                <p><strong>Telefone:</strong> {point.phone || 'Não informado'}</p>
                <p><strong>E-mail:</strong> {point.email || 'Não informado'}</p>
                <p><strong>Frequência:</strong> {point.frequency || 'Não informada'}</p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`badge ${point.is_active ? 'bg-success' : 'bg-secondary'}`}>
                    {point.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </p>
                {point.latitude && point.longitude && (
                  <p>
                    <strong>Localização:</strong> {point.latitude}, {point.longitude}
                  </p>
                )}
                {point.days_of_week && (
                  <p>
                    <strong>Dias da Semana:</strong>{' '}
                    {point.days_of_week.split(',').map(day => {
                      const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                      return days[parseInt(day) - 1] || day;
                    }).join(', ')}
                  </p>
                )}
                {point.weeks_of_month && (
                  <p>
                    <strong>Semanas do Mês:</strong>{' '}
                    {point.weeks_of_month.split(',').map(week => `Semana ${week}`).join(', ')}
                  </p>
                )}
              </Col>
            </Row>
            {point.notes && (
              <div className="mt-3">
                <h5>Observações</h5>
                <hr />
                <p>{point.notes}</p>
              </div>
            )}
            <div className="mt-4">
              <Button 
                variant="primary" 
                onClick={() => navigate(`/collection-points/edit/${id}`)}
                className="me-2"
              >
                <FaEdit className="me-1" /> Editar
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => navigate('/collection-points')}
              >
                Voltar
              </Button>
            </div>
          </Card.Body>
        </Card>
      </PageLayout>
    );
  }

  // Renderiza o formulário se estiver criando ou editando
  if (isNew || isEditing) {
    return (
      <PageLayout title={isEditing ? 'Editar Ponto de Coleta' : 'Novo Ponto de Coleta'}>
        <Card>
          <Card.Body>
            <Button 
              variant="link" 
              onClick={() => navigate(-1)}
              className="mb-3 p-0"
            >
              <FaArrowLeft className="me-2" /> Voltar
            </Button>
            
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>ID Externo</Form.Label>
                    <Form.Control
                      type="text"
                      name="external_id"
                      value={formData.external_id}
                      onChange={handleInputChange}
                      placeholder="ID único externo (opcional)"
                    />
                    <Form.Text className="text-muted">
                      Identificador único externo para evitar duplicações
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome *</Form.Label>
                    <Form.Control
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.name}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.name}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Endereço *</Form.Label>
                    <Form.Control
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.address}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.address}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bairro *</Form.Label>
                    <Form.Control
                      type="text"
                      name="neighborhood"
                      value={formData.neighborhood}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.neighborhood}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.neighborhood}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cidade *</Form.Label>
                    <Form.Control
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.city}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.city}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                
                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>UF *</Form.Label>
                    <Form.Select
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.state}
                    >
                      <option value="">Selecione</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {formErrors.state}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>CEP</Form.Label>
                    <Form.Control
                      type="text"
                      name="zip_code"
                      value={formData.zip_code}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Telefone</Form.Label>
                    <Form.Control
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>E-mail</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Frequência</Form.Label>
                    <Form.Control
                      type="text"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      placeholder="Ex: Semanal, Quinzenal, Mensal"
                    />
                    <Form.Text className="text-muted">
                      Frequência de coleta (opcional)
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Latitude</Form.Label>
                    <Form.Control
                      type="text"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Longitude</Form.Label>
                    <Form.Control
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Dias da Semana</Form.Label>
                    <Form.Control
                      type="text"
                      name="days_of_week"
                      value={formData.days_of_week}
                      onChange={handleInputChange}
                      placeholder="Ex: 1,2,3,4,5 (1=Segunda, 2=Terça, etc.)"
                    />
                    <Form.Text className="text-muted">
                      Separe os dias por vírgula (1-7, onde 1=Segunda, 7=Domingo)
                    </Form.Text>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Semanas do Mês</Form.Label>
                    <Form.Control
                      type="text"
                      name="weeks_of_month"
                      value={formData.weeks_of_month}
                      onChange={handleInputChange}
                      placeholder="Ex: 1,2,3,4 (todas as semanas)"
                    />
                    <Form.Text className="text-muted">
                      Separe as semanas por vírgula (1-4, onde 1=primeira semana, etc.)
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Observações</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={12}>
                  <Form.Check
                    type="switch"
                    id="is_active"
                    label="Ativo"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                  />
                </Col>
              </Row>
              
              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button 
                  variant="secondary" 
                  onClick={() => navigate('/collection-points')}
                  disabled={formSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Salvando...
                    </>
                  ) : 'Salvar'}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </PageLayout>
    );
  }



  // Atualiza a lista após criar, atualizar ou excluir um ponto
  const refreshList = () => {
    loadCollectionPoints();
  };

  // Função para lidar com a exclusão de um ponto de coleta
  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este ponto de coleta?')) {
      try {
        setDeleteLoading(prev => ({ ...prev, [id]: true }));
        await collectionPointService.delete(id);
        toast.success('Ponto de coleta excluído com sucesso!');
        refreshList(); // Atualiza a lista após a exclusão
      } catch (error) {
        console.error('Erro ao excluir ponto de coleta:', error);
        toast.error('Erro ao excluir o ponto de coleta. Tente novamente.');
      } finally {
        setDeleteLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  // Filtrar pontos de coleta com base no termo de busca
  const filteredPoints = collectionPoints.filter(point => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (point.external_id && point.external_id.toString().toLowerCase().includes(searchLower)) ||
      (point.name && point.name.toLowerCase().includes(searchLower)) ||
      (point.frequency && point.frequency.toLowerCase().includes(searchLower)) ||
      (point.address && point.address.toLowerCase().includes(searchLower)) ||
      (point.city && point.city.toLowerCase().includes(searchLower)) ||
      (point.phone && point.phone.toString().toLowerCase().includes(searchLower)) ||
      (point.neighborhood && point.neighborhood.toLowerCase().includes(searchLower))
    );
  });

  // Lógica de paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPoints.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPoints.length / itemsPerPage);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Resetar para a primeira página ao pesquisar
  };

  return (
    <PageLayout title="Pontos de Coleta">
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Body>
          <Row className="mb-4">
            <Col md={8}>
              <Form onSubmit={handleSearch} className="d-flex">
                <Form.Control
                  type="text"
                  placeholder="Buscar por ID, nome, frequência, endereço, cidade, bairro ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="me-2"
                />
                <Button variant="outline-secondary" type="submit">
                  Buscar
                </Button>
              </Form>
            </Col>
            <Col md={4} className="text-end">
              <Button as={Link} to="/collection-points/new" variant="primary">
                <FaPlus className="me-1" /> Adicionar Ponto
              </Button>
            </Col>
          </Row>

          {console.log('Renderizando componente - loading:', loading, 'erro:', error, 'pontos:', collectionPoints)}

          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Carregando pontos de coleta...</p>
            </div>
          ) : filteredPoints.length === 0 ? (
            <Alert variant="info">
              {searchTerm 
                ? 'Nenhum ponto de coleta encontrado para a busca realizada.'
                : 'Nenhum ponto de coleta cadastrado ainda.'}
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped hover className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>ID Externo</th>
                      <th>Nome</th>
                      <th>Frequência</th>
                      <th>Contato</th>
                      <th>Endereço</th>
                      <th>Cidade/UF</th>
                      <th>Dias da Semana</th>
                      <th>Semanas do Mês</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((point) => (
                      <tr key={point.id} className={!point.is_active ? 'text-muted' : ''}>
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
                          {point.frequency || '-'}
                        </td>
                        <td>
                          {point.phone && (
                            <div>{point.phone}</div>
                          )}
                        </td>
                        <td>
                          <div>{point.address || 'Não informado'}</div>
                          {point.zip_code && (
                            <div className="text-muted small">CEP: {point.zip_code}</div>
                          )}
                        </td>
                        <td>
                          {point.city || 'Não informada'}
                          {point.state && `/${point.state}`}
                        </td>
                        <td>
                          {point.days_of_week ? 
                            point.days_of_week.split(',').map(day => {
                              const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                              // Verifica se o valor é um número válido antes de acessar o array
                              const dayIndex = parseInt(day, 10);
                              return !isNaN(dayIndex) && dayIndex >= 0 && dayIndex < days.length 
                                ? days[dayIndex] 
                                : day;
                            }).filter(Boolean).join(', ') || '-' : '-'}
                        </td>
                        <td>
                          {point.weeks_of_month ? 
                            point.weeks_of_month.split(',')
                              .map(week => `Sem ${week}`)
                              .filter(Boolean)
                              .join(', ') || '-' : '-'}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${point.is_active ? 'bg-success' : 'bg-secondary'}`}>
                            {point.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="text-center">
                          <Button 
                            variant="link" 
                            size="sm" 
                            title="Visualizar"
                            onClick={() => navigate(`/collection-points/${point.id}`)}
                            className="text-primary p-1"
                          >
                            <FaEye />
                          </Button>
                          <Button 
                            variant="link" 
                            size="sm" 
                            title="Editar"
                            onClick={() => navigate(`/collection-points/edit/${point.id}`)}
                            className="text-warning p-1"
                          >
                            <FaEdit />
                          </Button>
                          <Button 
                            variant="link" 
                            size="sm" 
                            title="Excluir"
                            onClick={() => handleDelete(point.id)}
                            disabled={deleteLoading[point.id]}
                            className="text-danger p-1"
                          >
                            {deleteLoading[point.id] ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <FaTrash />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="text-muted small">
                    Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredPoints.length)} de {filteredPoints.length} itens
                  </div>
                  <nav>
                    <ul className="pagination mb-0">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          Anterior
                        </button>
                      </li>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Mostrar no máximo 5 páginas na navegação
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                            <button 
                              className="page-link" 
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          </li>
                        );
                      })}
                      
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          Próxima
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </PageLayout>
  );
};

export default CollectionPoints;
