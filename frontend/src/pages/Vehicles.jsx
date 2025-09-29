import { useState, useEffect } from 'react';
import { Card, Button, Form, Table, Modal, Alert, Spinner, Container } from 'react-bootstrap';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import vehicleService from '../services/vehicleService';
import cubageProfileService from '../services/cubageProfileService';

const Vehicles = ({ isNew: propIsNew = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isNewMode = propIsNew || location.pathname.endsWith('/new');
  const [vehicles, setVehicles] = useState([]);
  const [cubageProfiles, setCubageProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    plate: '',
    description: '',
    capacity: '',
    maxWeight: '',
    length: '',
    width: '',
    height: '',
    cubicMeters: 0, // Adicionando campo para metragem cúbica
    isActive: true,
    cubageProfileId: ''
  });
  
  // Atualiza a metragem cúbica sempre que as dimensões forem alteradas
  useEffect(() => {
    const { length, width, height } = formData;
    if (length && width && height) {
      const cubicMeters = (parseFloat(length) * parseFloat(width) * parseFloat(height)).toFixed(2);
      setFormData(prev => ({
        ...prev,
        cubicMeters: parseFloat(cubicMeters) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cubicMeters: 0
      }));
    }
  }, [formData.length, formData.width, formData.height]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Verifica se deve abrir o modal de novo veículo
  useEffect(() => {
    if (isNewMode) {
      setShowModal(true);
    }
  }, [isNewMode]);

  // Carrega os veículos e perfis de cubagem ao iniciar
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setLoadingProfiles(true);
          setError('');
          setSuccess('');
        }
        
        // Carrega veículos e perfis em paralelo
        const [vehiclesData, profilesData] = await Promise.all([
          vehicleService.getAll(),
          cubageProfileService.getAll()
        ]);
        
        if (isMounted) {
          // Mapeia os veículos para incluir os perfis de cubagem
          const vehiclesWithProfiles = vehiclesData.map(vehicle => {
            const profileId = vehicle.cubage_profile_id || vehicle.cubageProfileId;
            const profile = profilesData.find(p => p.id === profileId);
            
            return {
              ...vehicle,
              id: vehicle.id,
              plate: vehicle.plate || vehicle.name || '',
              name: vehicle.plate || vehicle.name || '',
              description: vehicle.description || '',
              capacity: parseFloat(vehicle.capacity) || 0,
              max_weight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
              maxWeight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
              length: parseFloat(vehicle.length) || 0,
              width: parseFloat(vehicle.width) || 0,
              height: parseFloat(vehicle.height) || 0,
              cubic_meters: parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 0,
              cubicMeters: parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 0,
              cubage_profile_id: profileId,
              cubage_profile: profile || null,
              is_active: vehicle.is_active !== false,
              isActive: vehicle.is_active !== false,
              created_at: vehicle.created_at,
              updated_at: vehicle.updated_at
            };
          });
          
          setVehicles(vehiclesWithProfiles);
          setCubageProfiles(profilesData || []);
          
          console.log('Veículos carregados com perfis:', vehiclesWithProfiles);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        if (isMounted) {
          setError('Erro ao carregar dados. Tente novamente mais tarde.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingProfiles(false);
        }
      }
    };
    
    loadData();
    
    // Função de limpeza
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchVehicles = async () => {
    try {
      console.log('Iniciando busca por veículos...');
      setLoading(true);
      
      // Limpa mensagens de erro/sucesso anteriores
      setError('');
      setSuccess('');
      
      const data = await vehicleService.getAll();
      console.log('Dados recebidos da API:', data);
      
      if (!Array.isArray(data)) {
        throw new Error('Formato de dados inválido retornado pela API');
      }
      
      // Formata os veículos com os dados básicos
      let formattedVehicles = data.map(vehicle => ({
        ...vehicle,
        id: vehicle.id,
        plate: vehicle.plate || vehicle.name || '',
        name: vehicle.plate || vehicle.name || '',
        description: vehicle.description || '',
        capacity: parseFloat(vehicle.capacity) || 0,
        max_weight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
        maxWeight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
        length: parseFloat(vehicle.length) || 0,
        width: parseFloat(vehicle.width) || 0,
        height: parseFloat(vehicle.height) || 0,
        cubic_meters: parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 0,
        cubicMeters: parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 0,
        cubage_profile_id: vehicle.cubage_profile_id || vehicle.cubageProfileId || null,
        cubage_profile: vehicle.cubage_profile || null,
        is_active: vehicle.is_active !== false,
        isActive: vehicle.is_active !== false,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at
      }));
      
      console.log('Veículos formatados:', formattedVehicles);
      setVehicles(formattedVehicles);
      
    } catch (error) {
      console.error('Erro ao carregar veículos:', error);
      setError(error.message || 'Erro ao carregar veículos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : parseFloat(value)) : value)
    }));
  };

  // Preenche automaticamente os campos do veículo quando um perfil é selecionado
  const handleProfileChange = async (e) => {
    const { name, value } = e.target;
    
    // Atualiza o ID do perfil de cubagem
    setFormData(prev => ({
      ...prev,
      [name]: value || null,
      cubage_profile_id: value || null
    }));
    
    // Se um perfil foi selecionado, carrega seus dados
    if (value) {
      try {
        const profile = await cubageProfileService.getById(value);
        if (profile) {
          setFormData(prev => ({
            ...prev,
            cubage_profile: profile,
            // Atualiza as dimensões apenas se não estiverem preenchidas
            length: prev.length || profile.length || '',
            width: prev.width || profile.width || '',
            height: prev.height || profile.height || '',
            capacity: prev.capacity || profile.capacity || profile.weight || '',
            maxWeight: prev.maxWeight || profile.maxWeight || profile.weight || '',
            cubicMeters: prev.cubicMeters || profile.volume || (profile.length && profile.width && profile.height ? 
              (parseFloat(profile.length) * parseFloat(profile.width) * parseFloat(profile.height)).toFixed(2) : 0)
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar perfil de cubagem:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Iniciando submissão do formulário...');
    
    // Validação dos campos obrigatórios
    const requiredFields = [
      { field: 'plate', label: 'Placa do Veículo' },
      { field: 'capacity', label: 'Capacidade' },
      { field: 'maxWeight', label: 'Peso Máx. por Eixo' },
      { field: 'length', label: 'Comprimento' },
      { field: 'width', label: 'Largura' },
      { field: 'height', label: 'Altura' }
    ];
    
    console.log('Campos do formulário:', formData);
    
    // Garante que o cubage_profile_id seja definido corretamente
    const cubageProfileId = formData.cubageProfileId || formData.cubage_profile_id || null;
    
    const missingFields = requiredFields.filter(field => !formData[field.field]);
    
    if (missingFields.length > 0) {
      const fieldsList = missingFields.map(f => f.label).join(', ');
      setError(`Por favor, preencha os seguintes campos obrigatórios: ${fieldsList}`);
      return;
    }
    
    // Validação dos valores numéricos
    const numericFields = ['capacity', 'maxWeight', 'length', 'width', 'height'];
    const invalidFields = numericFields.filter(field => {
      const value = parseFloat(formData[field]);
      return isNaN(value) || value <= 0;
    });
    
    if (invalidFields.length > 0) {
      const fieldsList = invalidFields.map(field => {
        const fieldLabel = requiredFields.find(f => f.field === field)?.label || field;
        return fieldLabel;
      }).join(', ');
      
      setError(`Os seguintes campos devem conter valores numéricos maiores que zero: ${fieldsList}`);
      return;
    }
    
    try {
      console.log('Iniciando envio do formulário com dados:', JSON.stringify(formData, null, 2));
      setLoading(true);
      
      // Prepara os dados para envio no formato esperado pelo backend
      console.log('Preparando dados para envio...');
      const dataToSend = {
        name: formData.plate || formData.name || '', // O backend espera 'name' como identificador
        description: formData.description || '',
        capacity: parseFloat(formData.capacity) || 0,
        max_weight: parseFloat(formData.maxWeight) || 0,
        length: parseFloat(formData.length) || 0,
        width: parseFloat(formData.width) || 0,
        height: parseFloat(formData.height) || 0,
        cubage_profile_id: cubageProfileId,
        is_active: formData.isActive !== false
      };
      
      // Remove campos vazios ou nulos
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key] === null || dataToSend[key] === undefined || dataToSend[key] === '') {
          delete dataToSend[key];
        }
      });
      
      console.log('Dados a serem enviados para a API:', dataToSend);
      
      console.log('Dados a serem enviados para a API:', JSON.stringify(dataToSend, null, 2));
      
      // Se tiver um perfil de cubagem, busca os dados completos para garantir consistência
      if (formData.cubageProfileId) {
        try {
          const profile = await cubageProfileService.getById(formData.cubageProfileId);
          if (profile) {
            // Atualiza os campos com os dados do perfil, se necessário
            dataToSend.capacity = dataToSend.capacity || profile.capacity || profile.weight || 0;
            dataToSend.maxWeight = dataToSend.maxWeight || profile.maxWeight || profile.weight || 0;
            dataToSend.length = dataToSend.length || profile.length || 0;
            dataToSend.width = dataToSend.width || profile.width || 0;
            dataToSend.height = dataToSend.height || profile.height || 0;
            
            // Calcula a metragem cúbica se não estiver definida
            if (!dataToSend.cubicMeters) {
              if (profile.volume) {
                dataToSend.cubicMeters = profile.volume;
              } else if (profile.length && profile.width && profile.height) {
                dataToSend.cubicMeters = (profile.length * profile.width * profile.height).toFixed(2);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar perfil de cubagem:', error);
          // Continua mesmo com erro, pois os dados já podem estar preenchidos
        }
      }
      
      try {
        let result;
        
        // Verifica se já existe um veículo com a mesma placa
        const existingVehicle = vehicles.find(v => 
          v.plate?.toLowerCase() === dataToSend.name?.toLowerCase() ||
          v.name?.toLowerCase() === dataToSend.name?.toLowerCase()
        );
        
        if (editingId || existingVehicle) {
          // Atualizar veículo existente
          const vehicleId = editingId || existingVehicle.id;
          console.log('Atualizando veículo existente com ID:', vehicleId);
          
          // Se estivermos em modo de edição ou se encontramos um veículo existente com a mesma placa
          result = await vehicleService.update(vehicleId, dataToSend);
          console.log('Resposta da atualização:', result);
          
          // Atualiza o estado local com o veículo atualizado
          setVehicles(prevVehicles => 
            prevVehicles.map(vehicle => 
              vehicle.id === vehicleId ? result : vehicle
            )
          );
          
          setSuccess(editingId ? 'Veículo atualizado com sucesso!' : 'Veículo atualizado com sucesso! (Já existia um veículo com esta placa)');
        } else {
          // Criar novo veículo (apenas se não existir um com a mesma placa)
          console.log('Iniciando criação de novo veículo com dados:', dataToSend);
          result = await vehicleService.create(dataToSend);
          console.log('Novo veículo criado:', result);
          
          // Atualiza o estado local com o novo veículo
          setVehicles(prevVehicles => [...prevVehicles, result]);
          setSuccess('Veículo criado com sucesso!');
        }
        
        // Fecha o modal e limpa o formulário
        handleCloseModal();
        
        // Força uma nova busca para garantir que todos os dados estejam atualizados
        await fetchVehicles();
        
      } catch (error) {
        console.error('Erro ao salvar veículo:', error);
        setError(error.message || 'Erro ao salvar veículo. Tente novamente.');
      }
      
    } catch (error) {
      console.error('Erro ao salvar veículo:', error);
      
      // Mensagem de erro mais amigável
      let errorMessage = 'Erro ao salvar veículo. ';
      
      if (error.response) {
        // Erro da API
        const { data } = error.response;
        if (data && data.detail) {
          errorMessage += data.detail;
        } else if (data && typeof data === 'object') {
          // Se houver erros de validação, mostre o primeiro erro
          const firstError = Object.values(data)[0];
          if (Array.isArray(firstError)) {
            errorMessage += firstError[0];
          } else if (typeof firstError === 'string') {
            errorMessage += firstError;
          }
        }
      } else if (error.request) {
        // Sem resposta do servidor
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
      } else if (error.message) {
        // Outros erros
        errorMessage += error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (vehicle) => {
    try {
      console.log('Iniciando edição do veículo...');
      console.log('ID do veículo para edição:', vehicle.id);
      console.log('Dados iniciais do veículo para edição:', JSON.stringify(vehicle, null, 2));
      
      // Busca os dados completos do veículo pelo ID para garantir que temos todos os campos
      console.log('Buscando dados completos do veículo na API...');
      const fullVehicle = await vehicleService.getById(vehicle.id);
      console.log('Dados completos do veículo da API:', JSON.stringify(fullVehicle, null, 2));
      
      if (!fullVehicle) {
        throw new Error('Nenhum dado retornado da API');
      }
      
      // Busca o perfil de cubagem se existir
      let cubageProfile = null;
      let profileId = fullVehicle.cubage_profile_id || fullVehicle.cubageProfileId || null;
      
      // Se tiver o objeto de perfil completo, usa ele
      if (fullVehicle.cubage_profile) {
        cubageProfile = fullVehicle.cubage_profile;
        profileId = cubageProfile.id || profileId;
      }
      
      // Se tiver ID mas não tiver o perfil completo, busca os detalhes
      if (profileId && !cubageProfile) {
        try {
          cubageProfile = await cubageProfileService.getById(profileId);
          console.log('Perfil de cubagem carregado:', cubageProfile);
        } catch (error) {
          console.error('Erro ao carregar perfil de cubagem:', error);
        }
      }
      
      if (profileId) {
        try {
          cubageProfile = await cubageProfileService.getById(profileId);
          console.log('Perfil de cubagem encontrado:', cubageProfile);
        } catch (error) {
          console.error('Erro ao buscar perfil de cubagem:', error);
        }
      }
      
      // Prepara os dados do veículo para o formulário
      const vehicleData = {
        plate: fullVehicle.plate || fullVehicle.name || '',
        description: fullVehicle.description || '',
        length: fullVehicle.length || '',
        width: fullVehicle.width || '',
        height: fullVehicle.height || '',
        capacity: fullVehicle.capacity || '',
        maxWeight: fullVehicle.max_weight || fullVehicle.maxWeight || '',
        cubicMeters: fullVehicle.cubic_meters || fullVehicle.cubicMeters || 0,
        cubageProfileId: profileId || '',
        cubage_profile_id: profileId || null,
        cubage_profile: cubageProfile || null,
        isActive: fullVehicle.is_active !== undefined ? fullVehicle.is_active : (fullVehicle.isActive !== false)
      };
      
      // Se encontrou o perfil de cubagem, preenche os campos automaticamente
      if (cubageProfile) {
        // Atualiza a metragem cúbica se não estiver definida
        if (!vehicleData.cubicMeters && cubageProfile.volume) {
          vehicleData.cubicMeters = cubageProfile.volume;
        } else if (!vehicleData.cubicMeters && cubageProfile.length && cubageProfile.width && cubageProfile.height) {
          // Calcula a metragem cúbica com base nas dimensões do perfil
          const length = parseFloat(cubageProfile.length) || 0;
          const width = parseFloat(cubageProfile.width) || 0;
          const height = parseFloat(cubageProfile.height) || 0;
          vehicleData.cubicMeters = (length * width * height).toFixed(2);
        }
      }
      
      console.log('Dados formatados para o formulário:', vehicleData);
      
      // Atualiza o estado do formulário
      setFormData(prev => ({
        ...prev,
        ...vehicleData
      }));
      
      setEditingId(fullVehicle.id);
      setShowModal(true);
    } catch (error) {
      console.error('Erro ao carregar dados do veículo para edição:', error);
      setError('Não foi possível carregar os dados do veículo. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este veículo?')) {
      try {
        setLoading(true);
        await vehicleService.delete(id);
        
        // Atualiza a lista de veículos após a exclusão
        await fetchVehicles();
        
        setSuccess('Veículo excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir veículo:', error);
        setError('Erro ao excluir veículo. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
    // Se estiver no modo de criação (acessado pela rota /new), navega de volta para a lista
    if (location.pathname.endsWith('/new')) {
      navigate('/vehicles');
    }
  };

  const resetForm = () => {
    setFormData({
      // Dados básicos
      plate: '',
      description: '',
      
      // Dimensões
      length: '',
      width: '',
      height: '',
      
      // Capacidade e pesos
      capacity: '',
      maxWeight: '',
      
      // Cubagem
      cubicMeters: 0,
      cubageProfileId: '',
      
      // Status
      isActive: true
    });
    setEditingId(null);
  };


  if (loading && vehicles.length === 0) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <Spinner animation="border" variant="primary" />
        <span className="ms-2">Carregando veículos...</span>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Gerenciar Veículos</h1>
        <Button 
          variant="primary" 
          onClick={() => navigate('/vehicles/new')}
          disabled={loading}
          className="d-flex align-items-center"
        >
          <FaPlus className="me-2" /> Adicionar Veículo
        </Button>
      </div>
      
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible className="mb-4">{success}</Alert>}
      
      <Card className="shadow-sm">
        <Card.Body>
          {vehicles.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted mb-4">Nenhum veículo cadastrado.</p>
              <Button 
                variant="primary" 
                onClick={() => navigate('/vehicles/new')}
                disabled={loading}
                className="d-flex align-items-center mx-auto"
              >
                <FaPlus className="me-2" /> Adicionar Primeiro Veículo
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover responsive>
                <thead className="table-light">
                  <tr>
                    <th>Placa</th>
                    <th>Descrição</th>
                    <th>Capacidade (kg)</th>
                    <th>Dimensões (m)</th>
                    <th>Peso Máx. (kg)</th>
                    <th>Perfil de Cubagem</th>
                    <th>Status</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(vehicle => (
                    <tr key={vehicle.id}>
                      <td className="text-uppercase">{vehicle.plate || vehicle.name || '-'}</td>
                      <td>{vehicle.description || '-'}</td>
                      <td>{vehicle.capacity ? Number(vehicle.capacity).toLocaleString('pt-BR') : '0'}</td>
                      <td>
                        {vehicle.length || '0'}m x {vehicle.width || '0'}m x {vehicle.height || '0'}m
                      </td>
                      <td>{(vehicle.max_weight || vehicle.maxWeight) ? Number(vehicle.max_weight || vehicle.maxWeight).toLocaleString('pt-BR') : '0'}</td>
                      <td>
                        {vehicle.cubage_profile ? (
                          <>
                            {vehicle.cubage_profile.name || 'Sem nome'}
                            {vehicle.cubage_profile.description && (
                              <small className="d-block text-muted">
                                {vehicle.cubage_profile.description}
                              </small>
                            )}
                          </>
                        ) : vehicle.cubage_profile_id ? (
                          `ID: ${vehicle.cubage_profile_id}`
                        ) : (
                          'Nenhum'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${(vehicle.is_active !== undefined ? vehicle.is_active : vehicle.isActive) ? 'bg-success' : 'bg-secondary'}`}>
                          {(vehicle.is_active !== undefined ? vehicle.is_active : vehicle.isActive) ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="text-nowrap">
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleEdit(vehicle)}
                          disabled={loading}
                          title="Editar"
                        >
                          <FaEdit />
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => handleDelete(vehicle.id)}
                          disabled={loading}
                          title="Excluir"
                        >
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Adicionar/Editar Veículo */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Editar Veículo' : 'Adicionar Veículo'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Placa do Veículo <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="plate"
                value={formData.plate}
                onChange={handleInputChange}
                placeholder="Ex: ABC1234 ou ABC1D23"
                className="text-uppercase"
                maxLength="7"
                required
              />
              <Form.Text className="text-muted">
                Formato: 3 letras seguidas de 1 número, 1 letra e 2 números (Mercosul) ou 3 letras e 4 números
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Perfil de Cubagem</Form.Label>
              <Form.Select
                name="cubageProfileId"
                value={formData.cubageProfileId || formData.cubage_profile_id || ''}
                onChange={handleProfileChange}
                disabled={loadingProfiles}
              >
                <option value="">Selecione um perfil para preencher automaticamente</option>
                {cubageProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.length}m x {profile.width}m x {profile.height}m - {profile.capacity}kg)
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Ao selecionar um perfil, os campos de capacidade e dimensões serão preenchidos automaticamente.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </Form.Group>
            
            <h5 className="mt-3">Informações de Carga</h5>
            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Capacidade Máxima (kg)</Form.Label>
                  <Form.Control
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                  <Form.Text className="text-muted">
                    Peso máximo que o veículo pode transportar
                  </Form.Text>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Metragem Cúbica (m³)</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.cubicMeters ? Number(formData.cubicMeters).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    readOnly
                    className="bg-light fw-bold"
                  />
                  <Form.Text className="text-muted">
                    Volume disponível: {formData.cubicMeters ? Number(formData.cubicMeters).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} m³
                  </Form.Text>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Peso Máx. por Eixo (kg)</Form.Label>
                  <Form.Control
                    type="number"
                    name="maxWeight"
                    value={formData.maxWeight}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                  <Form.Text className="text-muted">
                    Peso máximo permitido por eixo
                  </Form.Text>
                </Form.Group>
              </div>
            </div>
            
            <h5 className="mt-3">Dimensões (metros)</h5>
            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Comprimento</Form.Label>
                  <Form.Control
                    type="number"
                    name="length"
                    value={formData.length}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Largura</Form.Label>
                  <Form.Control
                    type="number"
                    name="width"
                    value={formData.width}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Altura</Form.Label>
                  <Form.Control
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </Form.Group>
              </div>
            </div>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Ativo"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Vehicles;
