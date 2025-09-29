import { useState, useEffect } from 'react';
import { Card, Button, Form, Table, Modal, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { FaPlus, FaEdit, FaTrash, FaSync } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import cubageProfileService from '../services/cubageProfileService';

const CubageProfiles = ({ isNew: propIsNew = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isNewMode = propIsNew || location.pathname.endsWith('/new');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    weight: '',
    dimensions: {
      length: '',
      width: '',
      height: ''
    },
    volume: 0,
    density: 0,
    isActive: true // Status padrão como ativo
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Verifica se deve abrir o modal de novo perfil
  useEffect(() => {
    if (isNewMode) {
      handleShowModal();
    }
  }, [isNewMode]);

  // Carrega os perfis ao iniciar
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      console.log('[CubageProfiles] Iniciando busca por perfis...');
      setLoading(true);
      setError('');
      
      console.log('[CubageProfiles] Chamando cubageProfileService.getAll()');
      const data = await cubageProfileService.getAll();
      console.log('[CubageProfiles] Dados recebidos do serviço:', data);
      
      if (!data || !Array.isArray(data)) {
        console.error('[CubageProfiles] Dados inválidos recebidos:', data);
        throw new Error('Formato de dados inválido');
      }
      
      // Converte os dados do formato da API para o formato esperado pelo componente
      const formattedProfiles = data.map(profile => ({
        ...profile,
        dimensions: {
          length: profile.length,
          width: profile.width,
          height: profile.height
        },
        isActive: profile.is_active !== false,
        // Garante que todos os campos necessários existam
        name: profile.name || 'Sem nome',
        description: profile.description || '',
        weight: profile.weight || 0,
        volume: profile.volume || 0,
        density: profile.density || 0
      }));
      
      console.log('[CubageProfiles] Perfis formatados:', formattedProfiles);
      setProfiles(formattedProfiles);
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
      setError('Erro ao carregar perfis. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para recarregar os perfis
  const handleRefresh = () => {
    fetchProfiles();
  };

  const calculateVolumeAndDensity = (weight, dimensions) => {
    // Garante que os valores sejam números
    const length = parseFloat(dimensions.length) || 0;
    const width = parseFloat(dimensions.width) || 0;
    const height = parseFloat(dimensions.height) || 0;
    const weightValue = parseFloat(weight) || 0;
    
    // Calcula o volume em metros cúbicos
    const volume = length * width * height;
    
    // Calcula a densidade (kg/m³), evitando divisão por zero
    const density = volume > 0 ? weightValue / volume : 0;
    
    return { 
      volume: parseFloat(volume.toFixed(3)), 
      density: parseFloat(density.toFixed(2)) 
    };
  };

  // Função para formatar valores numéricos
  const formatNumericValue = (value, decimalPlaces = 3) => {
    // Se o valor estiver vazio, retorna vazio para permitir que o usuário apague o campo
    if (value === '') return '';
    
    // Remove caracteres não numéricos, exceto ponto e vírgula
    let formatted = value.replace(/[^0-9,.]/g, '');
    
    // Se não houver mais nada, retorna vazio
    if (!formatted) return '';
    
    // Substitui vírgula por ponto para garantir o formato decimal correto
    formatted = formatted.replace(',', '.');
    
    // Se houver mais de um ponto, mantém apenas o primeiro
    const parts = formatted.split('.');
    if (parts.length > 2) {
      formatted = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Remove zeros à esquerda, mas mantém pelo menos um zero antes do ponto
    if (formatted.startsWith('0') && formatted.length > 1 && !formatted.startsWith('0.')) {
      formatted = formatted.replace(/^0+/, '');
    } else if (formatted.startsWith('.')) {
      formatted = '0' + formatted;
    }
    
    // Limita o número de casas decimais
    if (decimalPlaces > 0) {
      const decimalIndex = formatted.indexOf('.');
      if (decimalIndex !== -1) {
        const integerPart = formatted.substring(0, decimalIndex);
        let decimalPart = formatted.substring(decimalIndex + 1);
        if (decimalPart.length > decimalPlaces) {
          decimalPart = decimalPart.substring(0, decimalPlaces);
        }
        formatted = decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
      }
    }
    
    // Garante que o valor não seja negativo
    if (formatted.startsWith('-')) {
      formatted = formatted.substring(1);
    }
    
    return formatted;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      // Formata o valor numérico
      const numericValue = formatNumericValue(value, 3);
      const floatValue = parseFloat(numericValue) || 0;
      
      // Atualiza o valor da dimensão alterada
      const updatedDimensions = {
        ...formData.dimensions,
        [child]: numericValue // Mantém o valor formatado como string para o input
      };
      
      // Calcula o novo volume e densidade
      const weight = parent === 'dimensions' ? formData.weight : floatValue;
      const { volume, density } = calculateVolumeAndDensity(
        weight,
        {
          ...(parent === 'dimensions' ? updatedDimensions : formData.dimensions),
          // Garante que estamos usando valores numéricos para o cálculo
          length: parseFloat(updatedDimensions.length) || 0,
          width: parseFloat(updatedDimensions.width) || 0,
          height: parseFloat(updatedDimensions.height) || 0
        }
      );
      
      // Atualiza o estado com os novos valores
      setFormData(prev => ({
        ...prev,
        [parent]: parent === 'dimensions' ? updatedDimensions : numericValue,
        volume,
        density
      }));
      
      // Atualiza o valor do input para refletir a formatação
      e.target.value = numericValue;
      
    } else if (name === 'weight') {
      // Formata o valor do peso
      const numericValue = formatNumericValue(value, 2);
      const floatValue = parseFloat(numericValue) || 0;
      
      // Calcula volume e densidade
      const { volume, density } = calculateVolumeAndDensity(floatValue, {
        length: parseFloat(formData.dimensions.length) || 0,
        width: parseFloat(formData.dimensions.width) || 0,
        height: parseFloat(formData.dimensions.height) || 0
      });
      
      setFormData(prev => ({
        ...prev,
        weight: numericValue, // Mantém o valor formatado como string para o input
        volume,
        density
      }));
      
      // Atualiza o valor do input para refletir a formatação
      e.target.value = numericValue;
      
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Converte os valores para números e formata corretamente
      const weight = parseFloat(formData.weight.toString().replace(',', '.')) || 0;
      const length = parseFloat(formData.dimensions.length.toString().replace(',', '.')) || 0;
      const width = parseFloat(formData.dimensions.width.toString().replace(',', '.')) || 0;
      const height = parseFloat(formData.dimensions.height.toString().replace(',', '.')) || 0;
      
      // Calcula volume e densidade
      const volume = length * width * height;
      const density = volume > 0 ? weight / volume : 0;
      
      // Prepara os dados para envio no formato esperado pelo backend
      const profileData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        weight: weight,
        length: length,
        width: width,
        height: height,
        is_active: formData.isActive !== false,
        // O backend irá calcular volume e densidade automaticamente
      };
      
      console.log('Enviando dados do perfil para o backend:', profileData);
      
      if (editingId) {
        // Atualizar perfil existente
        const updatedProfile = await cubageProfileService.update(editingId, profileData);
        console.log('Perfil atualizado com sucesso:', updatedProfile);
        setSuccess('Perfil atualizado com sucesso!');
      } else {
        // Criar novo perfil
        const newProfile = await cubageProfileService.create(profileData);
        console.log('Novo perfil criado com sucesso:', newProfile);
        setSuccess('Perfil cadastrado com sucesso!');
      }
      
      // Recarrega a lista de perfis
      await fetchProfiles();
      setShowModal(false);
      resetForm();
      
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      const errorMessage = err.response?.data?.detail || 'Erro ao salvar perfil. Tente novamente.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (profile) => {
    console.log('Editando perfil:', profile);
    
    // Formata os dados para o formulário
    const formData = {
      ...profile,
      // Garante que o status seja definido corretamente
      isActive: profile.is_active !== undefined ? profile.is_active : (profile.isActive !== false),
      // Garante que os valores numéricos sejam strings para o input
      weight: profile.weight?.toString() || '0',
      dimensions: {
        length: (profile.dimensions?.length || profile.length || '0').toString(),
        width: (profile.dimensions?.width || profile.width || '0').toString(),
        height: (profile.dimensions?.height || profile.height || '0').toString()
      },
      // Inicializa volume e densidade se não existirem
      volume: profile.volume || 0,
      density: profile.density || 0
    };
    
    // Calcula o volume e densidade com os valores iniciais
    const { volume, density } = calculateVolumeAndDensity(
      parseFloat(formData.weight) || 0,
      {
        length: parseFloat(formData.dimensions.length) || 0,
        width: parseFloat(formData.dimensions.width) || 0,
        height: parseFloat(formData.dimensions.height) || 0
      }
    );
    
    // Atualiza o estado com os valores calculados
    setFormData({
      ...formData,
      volume,
      density
    });
    
    setEditingId(profile.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      weight: '0',
      dimensions: { 
        length: '0', 
        width: '0', 
        height: '0' 
      },
      volume: 0,
      density: 0,
      isActive: true // Status padrão como ativo
    });
    setEditingId(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
    // Se estiver no modo de criação (acessado pela rota /new), navega de volta para a lista
    if (location.pathname.endsWith('/new')) {
      navigate('/cubage-profiles');
    }
  };

  const handleShowModal = () => {
    setEditingId(null);
    resetForm();
    
    // Calcula volume e densidade iniciais
    const { volume, density } = calculateVolumeAndDensity(
      0, // peso inicial
      {
        length: 0,
        width: 0,
        height: 0
      }
    );
    
    setFormData(prev => ({
      ...prev,
      volume,
      density
    }));
    
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este perfil?')) {
      try {
        setLoading(true);
        setError('');
        setSuccess('');
        
        await cubageProfileService.delete(id);
        setSuccess('Perfil excluído com sucesso!');
        
        // Recarrega a lista de perfis
        await fetchProfiles();
      } catch (err) {
        console.error('Erro ao excluir perfil:', err);
        const errorMessage = err.response?.data?.detail || 'Erro ao excluir perfil. Tente novamente.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Perfis de Cubagem</h2>
        <div>
          <Button 
            variant="primary" 
            onClick={handleShowModal}
            className="me-2"
          >
            <FaPlus className="me-1" /> Novo Perfil
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={handleRefresh}
            disabled={loading}
            title="Atualizar lista"
          >
            <FaSync className={loading ? 'fa-spin' : ''} />
          </Button>
        </div>
    </div>
    
    {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
    {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}
    
    <Card>
      <Card.Body>
        {loading && profiles.length === 0 ? (
          <div className="text-center my-4">
            <Spinner animation="border" />
            <p className="mt-2">Carregando perfis...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center my-4">
            <p>Nenhum perfil cadastrado.</p>
            <Button variant="primary" onClick={() => setShowModal(true)}>
              <FaPlus className="me-2" /> Adicionar Perfil
            </Button>
          </div>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Peso (kg)</th>
                  <th>Dimensões (C x L x A)</th>
                  <th>Volume (m³)</th>
                  <th>Densidade (kg/m³)</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(profile => {
                  // Garante que os valores numéricos sejam exibidos corretamente
                  const length = parseFloat(profile.length || 0).toFixed(2);
                  const width = parseFloat(profile.width || 0).toFixed(2);
                  const height = parseFloat(profile.height || 0).toFixed(2);
                  const weight = parseFloat(profile.weight || 0).toFixed(2);
                  const volume = parseFloat(profile.volume || 0).toFixed(3);
                  const density = parseFloat(profile.density || 0).toFixed(2);
                  const isActive = profile.isActive !== false; // Garante que é booleano
                  
                  return (
                    <tr key={profile.id}>
                      <td>{profile.name || '-'}</td>
                      <td>{profile.description || '-'}</td>
                      <td>{weight} kg</td>
                      <td>
                        {length}m x {width}m x {height}m
                      </td>
                      <td>{volume} m³</td>
                      <td>{density} kg/m³</td>
                      <td>
                        <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                          {isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleEdit(profile)}
                          disabled={loading}
                        >
                          <FaEdit />
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => handleDelete(profile.id)}
                          disabled={loading}
                        >
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>

    {/* Modal de Adicionar/Editar Perfil */}
    <Modal show={showModal} onHide={handleCloseModal} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{editingId ? 'Editar Perfil' : 'Adicionar Perfil'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Nome do Perfil</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group controlId="formWeight" className="mb-3">
                <Form.Label>Peso (kg)</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    step="0.1"
                    min="0"
                    required
                  />
                  <InputGroup.Text>kg</InputGroup.Text>
                </InputGroup>
              </Form.Group>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-9">
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
            </div>
            <div className="col-md-3">
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <div className="d-flex align-items-center">
                  <Form.Check
                    type="switch"
                    id="isActive"
                    label={formData.isActive ? 'Ativo' : 'Inativo'}
                    checked={formData.isActive}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        isActive: e.target.checked
                      }));
                    }}
                    className="me-2"
                  />
                </div>
              </Form.Group>
            </div>
          </div>
          
          <h5>Dimensões (metros)</h5>
          <div className="row">
            <div className="col-md-4">
                <Form.Group controlId="formLength" className="mb-3">
                  <Form.Label>Comprimento (m)</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      name="dimensions.length"
                      value={formData.dimensions.length}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                    />
                    <InputGroup.Text>m</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
            </div>
            <div className="col-md-4">
                <Form.Group controlId="formWidth" className="mb-3">
                  <Form.Label>Largura (m)</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      name="dimensions.width"
                      value={formData.dimensions.width}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                    />
                    <InputGroup.Text>m</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
            </div>
            <div className="col-md-4">
                <Form.Group controlId="formHeight" className="mb-3">
                  <Form.Label>Altura (m)</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      name="dimensions.height"
                      value={formData.dimensions.height}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      required
                    />
                    <InputGroup.Text>m</InputGroup.Text>
                  </InputGroup>
                </Form.Group>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6">
              <Form.Group controlId="formVolume" className="mb-3">
                <Form.Label>Volume (m³)</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={formData.volume.toFixed(3)}
                    readOnly
                    plaintext
                  />
                  <InputGroup.Text>m³</InputGroup.Text>
                </InputGroup>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group controlId="formDensity" className="mb-3">
                <Form.Label>Densidade (kg/m³)</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={formData.density.toFixed(2)}
                    readOnly
                    plaintext
                  />
                  <InputGroup.Text>kg/m³</InputGroup.Text>
                </InputGroup>
              </Form.Group>
            </div>
          </div>
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
  </div>
);
};

export default CubageProfiles;
