import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card, Button, Form, Alert, Spinner, Row, Col, Table, Modal, Badge,
  InputGroup, FormControl, Tabs, Tab, Container
} from 'react-bootstrap';
import * as FaIcons from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../services/api';
import vehicleService from '../services/vehicleService';
import PointImporter from '../components/PointImporter';
import { generateTemplate } from '../utils/generateTemplate';
import { validateOptimizationData, formatValidationErrors } from '../utils/validation';
import './Upload.css';

// Desestrutura os ícones necessários
const {
  FaUpload, FaCheckCircle, FaTimesCircle, FaTrash, FaMapMarkerAlt,
  FaExternalLinkAlt, FaDirections, FaFileImport, FaPlus, FaFileDownload, FaCar,
  FaExclamationTriangle, FaSearch
} = FaIcons;

// Configuração base do axios
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// TODO: Esta configuração agora está no arquivo api.js
// Configuração de interceptors agora está no arquivo api.js

// Corrige o problema com os ícones no Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LocationMarker = ({ position, setPosition, isStartPoint = false }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker 
      position={position} 
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          setPosition(e.target.getLatLng());
        },
      }}
      icon={L.icon({
        ...L.Icon.Default.prototype.options,
        iconUrl: isStartPoint ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png' : markerIcon,
      })}
    >
      <Popup>{isStartPoint ? 'Ponto de Partida' : 'Local de Coleta'}</Popup>
    </Marker>
  );
};

const Upload = () => {
  // Navegação
  const navigate = useNavigate();
  
  // Estados para controle da interface
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ 
    type: '', 
    title: '',
    text: '',
    show: false 
  });
  
  // Estados para abas e arquivos
  const [activeTab, setActiveTab] = useState('manual');
  const [file, setFile] = useState(null);
  const [showPointImporter, setShowPointImporter] = useState(false);
  
  // Estados para pontos de rota e coleta
  const [uploadedPoints, setUploadedPoints] = useState([]);
  const [startPoint, setStartPoint] = useState({
    address: '',
    lat: null,
    lng: null,
    isCurrentLocation: false
  });
  const [currentLocation, setCurrentLocation] = useState({
    address: '',
    lat: null,
    lng: null,
    isCurrentLocation: false
  });
  const [endPoint, setEndPoint] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Estados para dados
  const [collectionPoints, setCollectionPoints] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  
  // Estados para controle de carregamento
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // Estados para o modal do mapa
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenter] = useState([-23.5505, -46.6333]); // Centro de São Paulo como padrão
  
  // Referências
  const fileInputRef = useRef(null);
  
  // Estados para rotas
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeStartTime, setRouteStartTime] = useState('08:00');
  const [routeEndTime, setRouteEndTime] = useState('18:00');
  const [maxRadiusKm, setMaxRadiusKm] = useState(50); // Raio máximo em km
  const [maxPointsPerOptimization, setMaxPointsPerOptimization] = useState(100); // Número máximo de pontos por otimização
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({
    status: 'idle', // 'idle' | 'processing' | 'completed' | 'error'
    message: '',
    progress: 0,
    requestId: '',
    error: null
  });

  // Obtém o estado e o caminho da navegação
  const { state: locationState, pathname } = useLocation();

  // Processa pontos selecionados da navegação (vindos do calendário)
  useEffect(() => {
    if (locationState?.selectedPoints?.length > 0) {
      console.log('Pontos selecionados recebidos:', locationState.selectedPoints);
      
      // Adiciona um ID único para cada ponto se não tiver
      const pointsWithIds = locationState.selectedPoints.map(point => ({
        ...point,
        id: point.id || `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      
      setUploadedPoints(pointsWithIds);
      
      // Limpa o estado de navegação para evitar adicionar os mesmos pontos novamente
      navigate(pathname, { replace: true, state: {} });
    }
  }, [locationState, navigate]);

  // Carrega veículos e pontos de coleta ao iniciar
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        if (!isMounted) return;
        
        console.log('Iniciando carregamento de dados...');
        setLoading(true);
        setMessage({ type: 'info', text: 'Conectando ao servidor...' });
        setLoadError(null);
        
        // Limpa os dados existentes
        setVehicles([]);
        setCollectionPoints([]);
        setSelectedVehicles([]);
        
        // Testa a conexão com o servidor primeiro
        try {
          console.log('Testando conexão com o servidor...');
          
          // Tenta acessar o endpoint de health check
          const testConnection = await api.get('/health/health');
          console.log('Resposta do servidor (health):', testConnection.status, testConnection.statusText);
          
          if (testConnection.status !== 200) {
            throw new Error(`Resposta inesperada do servidor: ${testConnection.status}`);
          }
          
          console.log('Conexão com o servidor estabelecida com sucesso');
        } catch (testError) {
          console.error('Erro ao conectar ao servidor:', testError);
          
          // Tenta obter mais detalhes do erro
          const errorDetails = testError.response?.data || testError.message;
          console.error('Detalhes do erro:', errorDetails);
          
          // Verifica se o erro é 404 (endpoint não encontrado)
          if (testError.response?.status === 404) {
            console.warn('Endpoint de health check não encontrado, tentando continuar...');
          } else {
            throw new Error(`Não foi possível conectar ao servidor (${testError.response?.status || 'sem resposta'}). Verifique se o servidor backend está em execução.`);
          }
        }
        
        // Carrega pontos de coleta existentes
        setMessage({ type: 'info', text: 'Carregando pontos de coleta...' });
        try {
          // Usa o endpoint correto para listar pontos de coleta
          const response = await api.get('/collection-points', {
            params: {
              skip: 0,
              limit: 1000,  // Aumenta o limite para garantir que todos os pontos sejam carregados
              active_only: false  // Inclui pontos inativos também
            }
          });
          
          console.log('Resposta de /collection-points:', response);
          
          if (response.data && Array.isArray(response.data)) {
            console.log('Pontos de coleta carregados:', {
              total: response.data.length,
              comGeolocalizacao: response.data.filter(p => p.latitude && p.longitude).length,
              semGeolocalizacao: response.data.filter(p => !p.latitude || !p.longitude).length
            });
            
            // Atualiza os pontos de coleta com suas geolocalizações
            const pointsWithGeo = response.data.map(point => ({
              ...point,
              lat: point.latitude,
              lng: point.longitude,
              address: point.address,
              name: point.name,
              external_id: point.external_id,
              status: point.latitude && point.longitude ? 'com_coordenadas' : 'pendente_coordenadas'
            }));

            // Filtra apenas os pontos pendentes de coordenadas
            const pendingPoints = pointsWithGeo.filter(p => p.status === 'pendente_coordenadas');
            
            // Atualiza o estado com os pontos pendentes
            setCollectionPoints(pendingPoints);
            
            // Mostra mensagem informativa sobre os pontos carregados
            setMessage({
              type: 'info',
              text: `Carregados ${response.data.length} pontos de coleta. ${pendingPoints.length} precisam de geolocalização.`,
              showClose: true
            });
          }
        } catch (pointsError) {
          console.error('Erro ao carregar pontos de coleta:', pointsError);
          setMessage({ 
            type: 'warning', 
            text: 'Não foi possível carregar os pontos de coleta. Tente novamente mais tarde.' 
          });
        }
        
        // Carrega veículos usando o vehicleService
        setMessage({ type: 'info', text: 'Carregando veículos...' });
        console.log('Iniciando carregamento de veículos...');
        setIsLoadingVehicles(true);
        
        try {
          // Usa o serviço de veículos que já tem a lógica de formatação
          const vehiclesData = await vehicleService.getAll();
          console.log('Veículos carregados:', vehiclesData);
          
          // Formata os veículos para o formato esperado pelo componente
          const formattedVehicles = vehiclesData.map(vehicle => ({
            id: vehicle.id,
            name: vehicle.name || vehicle.plate || `Veículo ${vehicle.id}`,
            plate: vehicle.plate || vehicle.name || `Veículo ${vehicle.id}`,
            description: vehicle.description || '',
            capacity: vehicle.capacity || 0,
            max_weight: vehicle.max_weight || vehicle.maxWeight || 0,
            length: vehicle.length || 0,
            width: vehicle.width || 0,
            height: vehicle.height || 0,
            cubage_profile_id: vehicle.cubage_profile_id || null,
            cubage_profile: vehicle.cubage_profile || null,
            is_active: vehicle.is_active !== false,
            created_at: vehicle.created_at,
            updated_at: vehicle.updated_at
          }));
          
          setVehicles(formattedVehicles);
          
          if (formattedVehicles.length === 0) {
            setMessage({ 
              type: 'warning', 
              text: 'Nenhum veículo encontrado. Por favor, adicione veículos primeiro.' 
            });
          } else {
            console.log(`${formattedVehicles.length} veículos carregados com sucesso`);
            setMessage({ type: 'success', text: 'Dados carregados com sucesso!' });
          }
        } catch (err) {
          console.error('Erro ao carregar veículos:', err);
          console.error('Detalhes do erro:', {
            message: err.message,
            response: err.response,
            request: err.request
          });
          setMessage({ 
            type: 'warning', 
            text: 'Não foi possível carregar a lista de veículos. Tente novamente mais tarde.'
          });
        } finally {
          console.log('Finalizado carregamento de veículos');
          setIsLoadingVehicles(false);
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        setLoading(false);
        setMessage({ 
          type: 'danger', 
          text: `Erro ao carregar dados iniciais: ${error.message || 'Erro desconhecido'}` 
        });
        setLoadError(error.message || 'Erro desconhecido');
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Manipula a seleção de veículos
  const handleVehicleSelect = (vehicleId, isChecked) => {
    console.log('handleVehicleSelect chamado:', { vehicleId, isChecked });
    if (isChecked) {
      setSelectedVehicles(prev => {
        // Evita duplicação de IDs
        if (!prev.includes(vehicleId)) {
          const newSelected = [...prev, vehicleId];
          console.log('Novos veículos selecionados:', newSelected);
          return newSelected;
        }
        console.log('Veículo já selecionado, ignorando duplicação');
        return prev;
      });
    } else {
      setSelectedVehicles(prev => {
        const newSelected = prev.filter(id => id !== vehicleId);
        console.log('Veículos após remoção:', newSelected);
        return newSelected;
      });
    }
  };

  // Verifica se um veículo está selecionado
  const isVehicleSelected = (vehicleId) => {
    return selectedVehicles.includes(vehicleId);
  };

  // Manipula a mudança de arquivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      setShowPointImporter(true);
    }
  };

  // Manipula a importação de pontos do componente PointImporter
  const handlePointsImported = useCallback((points) => {
    setCollectionPoints(points);
    setUploadedPoints(points);
    setMessage({ type: 'success', text: `${points.length} pontos importados com sucesso!` });
  }, []);

  // Adiciona um ponto manualmente
  const handleAddManualPoint = () => {
    const newPoint = {
      id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Ponto ${uploadedPoints.length + 1}`,
      address: '',
      lat: -23.5505,
      lng: -46.6333,
      quantity: 1,
      weight: 1,
      volume: 0.1,
      timeWindow: {
        start: '08:00',
        end: '18:00'
      }
    };
    
    setUploadedPoints(prev => [...prev, newPoint]);
    setMessage({ type: 'success', text: 'Ponto adicionado com sucesso!' });
  };

  // Atualiza um ponto existente
  const handleUpdatePoint = (id, field, value) => {
    setUploadedPoints(prev => 
      prev.map(point => 
        point.id === id ? { ...point, [field]: value } : point
      )
    );
  };

  // Remove um ponto
  const handleRemovePoint = (id) => {
    setUploadedPoints(prev => prev.filter(point => point.id !== id));
  };
  
  // Obtém o endereço a partir das coordenadas (geocodificação reversa)
  const getAddressFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&accept-language=pt-BR`
      );
      const data = await response.json();
      
      if (data.display_name) {
        return data.display_name;
      }
      return `Localização: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Erro ao obter endereço:', error);
      return `Localização: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };
  
  // Obtém as coordenadas a partir do endereço (geocodificação direta)
  const getCoordsFromAddress = async (address) => {
    if (!address.trim()) return null;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=pt-BR`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao geocodificar endereço:', error);
      return null;
    }
  };
  
  // Manipula a mudança para entrada manual de endereço
  const handleManualAddressChange = (e) => {
    const newAddress = e.target.value;
    setStartPoint(prev => ({
      ...prev,
      address: newAddress,
      isCurrentLocation: false
    }));
  };
  
  // Busca as coordenadas para o endereço manual
  const handleManualAddressSubmit = async (e) => {
    e.preventDefault();
    if (!startPoint.address || !startPoint.address.trim()) {
      setMessage({ 
        type: 'warning', 
        text: 'Por favor, digite um endereço para buscar.',
        showClose: true
      });
      return;
    }
    
    setMessage({ type: 'info', text: 'Buscando localização...', showClose: true });
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startPoint.address)}&limit=1&accept-language=pt-BR`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newLocation = {
          address: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          isCurrentLocation: false
        };
        
        setStartPoint(newLocation);
        setMessage({ 
          type: 'success', 
          text: 'Localização encontrada com sucesso!',
          showClose: true
        });
        
        return newLocation;
      } else {
        setMessage({ 
          type: 'warning', 
          text: 'Endereço não encontrado. Por favor, verifique o endereço e tente novamente.',
          showClose: true
        });
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      setMessage({ 
        type: 'danger', 
        text: 'Erro ao buscar o endereço. Por favor, tente novamente mais tarde.',
        showClose: true
      });
      return null;
    }
  };

  // Obtém a localização atual do usuário
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setMessage({ 
        type: 'warning', 
        text: 'Geolocalização não é suportada pelo seu navegador.'
      });
      return null;
    }
    
    setIsLocating(true);
    setMessage({ type: 'info', text: 'Obtendo sua localização atual...', showClose: true });
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });
      
      // Arredonda as coordenadas para 6 casas decimais (precisão de ~11cm)
      const lat = parseFloat(position.coords.latitude.toFixed(6));
      const lng = parseFloat(position.coords.longitude.toFixed(6));
      
      const endereco = await getAddressFromCoords(lat, lng);
      
      const location = {
        address: endereco,
        lat: lat,
        lng: lng,
        isCurrentLocation: true
      };
      
      console.log('Localização obtida:', { lat, lng, endereco });
      
      // Atualiza tanto o currentLocation quanto o startPoint
      setCurrentLocation(location);
      setStartPoint({
        ...location,
        isCurrentLocation: true
      });
      
      setMessage({ 
        type: 'success', 
        text: 'Localização atual definida com sucesso como ponto de partida!',
        showClose: true
      });
      
      return location;
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      let errorMessage = 'Não foi possível acessar sua localização';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada. Por favor, habilite a localização nas configurações do seu navegador.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'As informações de localização não estão disponíveis no momento.';
          break;
        case error.TIMEOUT:
          errorMessage = 'A solicitação de localização expirou. Por favor, tente novamente.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setMessage({ 
        type: 'danger',
        text: `Erro ao obter localização: ${errorMessage}`,
        showClose: true
      });
      
      return null;
    } finally {
      setIsLocating(false);
    }
}, []);

  // Manipula o envio do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Limpa mensagens anteriores
    setMessage({ type: '', text: '' });
    
    // Validação básica
    if (!file) {
      setMessage({ type: 'warning', text: 'Selecione um arquivo para enviar.' });
      return;
    }
    
    if (selectedVehicles.length === 0) {
      setMessage({ type: 'warning', text: 'Selecione pelo menos um veículo.' });
      return;
    }
    
    // Prepara os dados para validação
    const optimizationData = {
      points: uploadedPoints,
      vehicles: selectedVehicles,
      startPoint,
      endPoint: endPoint || null
    };
    
    // Valida os dados antes de enviar para o backend
    const { isValid, errors, warnings } = validateOptimizationData(optimizationData);
    
    // Exibe avisos, mas não bloqueia a otimização
    if (warnings && warnings.length > 0) {
      console.warn('Avisos de validação encontrados:', warnings);
      
      // Formata os avisos para exibição
      const formattedWarnings = warnings.join('\n\n');
      
      setMessage({
        type: 'warning',
        title: 'Atenção',
        text: `AVISOS:\n${formattedWarnings}\n\nA otimização continuará, mas alguns pontos podem estar fora do raio ideal.`,
        showClose: true
      });
    }
    
    // Se houver erros críticos, não permite continuar
    if (!isValid) {
      setMessage({
        type: 'danger',
        title: 'Erro de Validação',
        text: formatValidationErrors(errors)
      });
      return;
    }

    // Obtém os detalhes dos veículos selecionados
    const selectedVehicleDetails = vehicles.filter(v => selectedVehicles.includes(v.id));
    
    // Verifica se pelo menos um veículo com perfil de cubagem foi selecionado
    const hasValidProfile = selectedVehicleDetails.some(vehicle => vehicle.cubage_profile_id);
    
    if (!hasValidProfile) {
      setMessage({ 
        type: 'warning', 
        text: 'Nenhum veículo com perfil de cubagem válido selecionado. Por favor, selecione pelo menos um veículo com perfil de cubagem configurado.' 
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Processando arquivo...' });
      
      // Lê o conteúdo do arquivo CSV
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const csvData = event.target.result;
          const lines = csvData.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          // Processa as linhas do CSV (ignorando o cabeçalho)
          const points = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Pula linhas vazias
            
            const values = lines[i].split(',').map(v => v.trim());
            const point = {};
            
            // Mapeia os valores para as colunas corretas
            headers.forEach((header, index) => {
              // Remove espaços extras e converte para minúsculas para facilitar a comparação
              const cleanHeader = header.trim().toLowerCase();
              
              // Mapeia nomes comuns de colunas para os nomes de campo esperados
              if (cleanHeader.includes('lat') || cleanHeader === 'latitude') {
                point.lat = values[index] || '';
              } else if (cleanHeader.includes('lng') || cleanHeader.includes('long') || cleanHeader === 'longitude') {
                point.lng = values[index] || '';
              } else if (cleanHeader.includes('nome') || cleanHeader === 'name') {
                point.name = values[index] || '';
              } else if (cleanHeader.includes('endereço') || cleanHeader === 'address') {
                point.address = values[index] || '';
              } else if (cleanHeader.includes('quantidade') || cleanHeader === 'quantity') {
                point.quantity = values[index] || 1;
              } else if (cleanHeader.includes('peso') || cleanHeader === 'weight') {
                point.weight = values[index] || 0;
              } else if (cleanHeader.includes('volume') || cleanHeader === 'volume') {
                point.volume = values[index] || 0.1;
              } else {
                // Se não for um campo mapeado, adiciona como está
                point[header] = values[index] || '';
              }
            });
            
            // Adiciona dados adicionais necessários
            point.id = `point-${Date.now()}-${i}`;
            point.quantity = parseInt(point.quantity) || 1;
            point.weight = parseFloat(point.weight) || 0;
            point.volume = parseFloat(point.volume) || 0.1; // Valor padrão
            
            // Função auxiliar para converter coordenadas no formato da planilha para o formato decimal
            const parseCoordinate = (coord, isLatitude = false) => {
              try {
                if (coord === undefined || coord === null || coord === '') {
                  console.log('Coordenada vazia ou indefinida');
                  return null;
                }
                
                // Converte para string e remove espaços
                const coordStr = String(coord).trim();
                
                // Se já estiver no formato correto (ex: -19.776652), retorna direto
                if (/^-?\d{1,2}\.\d+$/.test(coordStr)) {
                  const num = parseFloat(coordStr);
                  return isLatitude 
                    ? Math.max(-90, Math.min(90, num)) 
                    : Math.max(-180, Math.min(180, num));
                }
                
                // Remove caracteres não numéricos, exceto o sinal negativo
                let cleanValue = coordStr.replace(/[^0-9\-]/g, '');
                
                // Se não tiver sinal negativo, adiciona
                if (!cleanValue.startsWith('-') && cleanValue.length > 0) {
                  cleanValue = '-' + cleanValue;
                }
                
                // Converte para número
                let numValue = parseFloat(cleanValue);
                
                // Se for inválido, retorna null
                if (isNaN(numValue)) {
                  console.log('Valor não é um número:', coord);
                  return null;
                }
                
                // Converte o formato da planilha para o formato decimal
                // Exemplo: -1991415 -> -19.91415
                // Pegamos os 2 primeiros dígitos para a parte inteira
                // e o restante para as casas decimais
                const strValue = Math.abs(numValue).toString();
                
                if (strValue.length >= 2) {
                  const integerPart = strValue.substring(0, 2);
                  const decimalPart = strValue.substring(2);
                  const formattedValue = `${integerPart}.${decimalPart}`;
                  numValue = parseFloat(formattedValue) * (numValue < 0 ? -1 : 1);
                  
                  console.log(`Coordenada convertida: ${numValue} (valor original: ${coord})`);
                }
                
                // Garante que está dentro dos limites
                const limit = isLatitude ? 90 : 180;
                const result = parseFloat(Math.max(-limit, Math.min(limit, numValue)).toFixed(6));
                
                console.log(`Coordenada final: ${result} (${isLatitude ? 'latitude' : 'longitude'})`);
                return result;
                
              } catch (error) {
                console.error('Erro ao processar coordenada:', { coord, error });
                return null;
              }
            };
            
            // Processa latitude e longitude
            point.lat = parseCoordinate(point.lat, true);  // true para latitude
            point.lng = parseCoordinate(point.lng, false); // false para longitude
            
            // Se alguma coordenada for inválida, adiciona mensagem de aviso
            if (point.lat === null || point.lng === null) {
              console.warn(`Ponto ${point.name || i}: Coordenadas inválidas (${point.lat}, ${point.lng})`);
            }
            
            // Se não houver janela de tempo definida, usa valores padrão
            if (!point.timeWindow) {
              point.timeWindow = { start: '08:00', end: '17:00' };
            } else if (typeof point.timeWindow === 'string') {
              // Se for uma string, tenta converter para objeto
              try {
                point.timeWindow = JSON.parse(point.timeWindow);
              } catch (e) {
                point.timeWindow = { start: '08:00', end: '17:00' };
              }
            }

            points.push(point);
          }
          
          setUploadedPoints(points);
          setMessage({ 
            type: 'success', 
            text: `Arquivo processado com sucesso! ${points.length} pontos de coleta encontrados.` 
          });
          setLoading(false);
          
        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          setMessage({ 
            type: 'danger', 
            text: 'Erro ao processar o arquivo. Verifique o formato e tente novamente.' 
          });
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setMessage({ 
          type: 'danger', 
          text: 'Erro ao ler o arquivo. Tente novamente.' 
        });
        setLoading(false);
      };
      
      // Lê o arquivo como texto
      reader.readAsText(file);
      
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setMessage({ 
        type: 'danger', 
        text: 'Erro ao processar o arquivo. Verifique o formato e tente novamente.' 
      });
      setLoading(false);
    }
  };
  
  // Função para calcular distância em km entre duas coordenadas usando a fórmula de Haversine
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distância em km
  };

  // Função para validar coordenadas
  const validateCoordinates = (lat, lng) => {
    try {
      // Converte para número se for string
      const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
      const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
      
      // Verifica se são números válidos
      if (isNaN(latNum) || isNaN(lngNum)) {
        return { valid: false, error: 'As coordenadas devem ser números válidos' };
      }
      
      // Verifica os intervalos
      if (latNum < -90 || latNum > 90) {
        return { valid: false, error: `Latitude inválida (${latNum}). Deve estar entre -90 e 90 graus.` };
      }
      
      if (lngNum < -180 || lngNum > 180) {
        return { valid: false, error: `Longitude inválida (${lngNum}). Deve estar entre -180 e 180 graus.` };
      }
      
      return { 
        valid: true, 
        coordinates: { 
          lat: parseFloat(latNum.toFixed(6)), 
          lng: parseFloat(lngNum.toFixed(6)) 
        } 
      };
      
    } catch (error) {
      console.error('Erro ao validar coordenadas:', error);
      return { 
        valid: false, 
        error: `Erro ao validar coordenadas: ${error.message}` 
      };
    }
  };

  // Função para gerar rotas otimizadas
  const generateOptimizedRoutes = async () => {
    // Verifica se há veículos selecionados
    if (selectedVehicles.length === 0) {
      setMessage({ type: 'warning', text: 'Selecione pelo menos um veículo para gerar as rotas.' });
      return;
    }

    // Obtém os detalhes dos veículos selecionados
    const selectedVehicleDetails = vehicles.filter(v => selectedVehicles.includes(v.id));
    
    // Verifica se pelo menos um veículo com perfil de cubagem foi selecionado
    const hasValidProfile = selectedVehicleDetails.some(vehicle => vehicle.cubage_profile_id);
    
    if (!hasValidProfile) {
      setMessage({ 
        type: 'warning', 
        text: 'Nenhum veículo com perfil de cubagem válido selecionado. Por favor, selecione pelo menos um veículo com perfil de cubagem configurado.' 
      });
      setLoading(false);
      return;
    }
    
    // Valida as coordenadas do ponto de partida
    if (!startPoint.lat || !startPoint.lng) {
      setMessage({ 
        type: 'danger', 
        text: 'Por favor, defina um ponto de partida no mapa.' 
      });
      return;
    }
    
    const startPointValidation = validateCoordinates(startPoint.lat, startPoint.lng);
    if (!startPointValidation.valid) {
      setMessage({ 
        type: 'danger', 
        text: `Coordenadas do ponto de partida inválidas: ${startPointValidation.error}` 
      });
      return;
    }
    
    // Valida as coordenadas dos pontos de coleta
    const invalidPoints = [];
    
    const validatedPoints = uploadedPoints.map((point, index) => {
      const validation = validateCoordinates(point.lat, point.lng);
      if (!validation.valid) {
        invalidPoints.push({
          index: index + 1,
          name: point.name || `Ponto ${index + 1}`,
          error: validation.error
        });
      }
      return {
        ...point,
        ...(validation.valid ? validation.coordinates : { lat: 0, lng: 0 })
      };
    });
    
    // Se houver pontos inválidos, exibe mensagem de erro
    if (invalidPoints.length > 0) {
      const errorMessage = `Os seguintes pontos possuem coordenadas inválidas:\n${
        invalidPoints.map(p => `- ${p.name}: ${p.error}`).join('\n')
      }`;
      
      console.error('Pontos com coordenadas inválidas:', invalidPoints);
      
      setMessage({ 
        type: 'danger', 
        text: errorMessage
      });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Gerando rotas otimizadas...' });
      
      // Mostra o modal de progresso
      setShowProgressModal(true);
      setOptimizationProgress({
        status: 'processing',
        message: 'Iniciando otimização...',
        progress: 0,
        requestId: '',
        error: null
      });
      
      // Calcula o peso total e volume total dos pontos
      const totalWeight = validatedPoints.reduce((sum, point) => {
        return sum + ((point.weight || 0) * (point.quantity || 1));
      }, 0);
      
      const totalVolume = validatedPoints.reduce((sum, point) => {
        return sum + ((point.volume || 0.1) * (point.quantity || 1));
      }, 0);
      
      // Calcula a capacidade total dos veículos selecionados
      const totalCapacity = selectedVehicleDetails.reduce((sum, vehicle) => {
        return sum + (parseFloat(vehicle.capacity) || 0);
      }, 0);
      
      // Calcula o volume total suportado pelos veículos (comprimento x largura x altura)
      const totalVolumeCapacity = selectedVehicleDetails.reduce((sum, vehicle) => {
        const volume = vehicle.length && vehicle.width && vehicle.height ? 
          vehicle.length * vehicle.width * vehicle.height : 0;
        return sum + volume;
      }, 0);
      
      // Verifica se a capacidade total é suficiente
      if (totalWeight > totalCapacity) {
        setMessage({ 
          type: 'warning', 
          text: `A capacidade total dos veículos selecionados (${totalCapacity}kg) é menor que o peso total dos pontos (${totalWeight.toFixed(2)}kg). Adicione mais veículos ou reduza a carga.` 
        });
        setLoading(false);
        return;
      }
      
      // Verifica se o volume total é suportado
      if (totalVolume > totalVolumeCapacity) {
        setMessage({ 
          type: 'warning', 
          text: `A capacidade de volume dos veículos selecionados (${totalVolumeCapacity.toFixed(2)}m³) é menor que o volume total dos pontos (${totalVolume.toFixed(2)}m³). Adicione mais veículos ou reduza a carga.` 
        });
        setLoading(false);
        return;
      }

      // Prepara os dados para envio no formato esperado pelo backend
      const requestData = {
        name: `Rota ${new Date().toLocaleString()}`,
        description: 'Rota gerada automaticamente considerando cubagem e capacidade',
        options: {
          max_radius_km: maxRadiusKm // Adiciona o raio máximo em km
        },
        vehicles: selectedVehicleDetails.map(vehicle => {
          // Calculate volume capacity from dimensions if not provided
          const volumeCapacity = parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 
                              (parseFloat(vehicle.length || 0) * 
                               parseFloat(vehicle.width || 0) * 
                               parseFloat(vehicle.height || 0));
          
          return {
            id: vehicle.id.toString(),
            name: vehicle.name,
            capacity: parseFloat(vehicle.capacity) || 0,
            max_weight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
            volume_capacity: volumeCapacity,
            length: parseFloat(vehicle.length) || 0,
            width: parseFloat(vehicle.width) || 0,
            height: parseFloat(vehicle.height) || 0,
            start_time: '08:00',
            end_time: '18:00',
            speed: 30.0
          };
        }),
        points: [
          // Ponto de partida
          {
            id: 'start-point',
            type: 'start',
            name: startPoint.name || 'Ponto de partida',
            address: startPoint.address || 'Endereço não informado',
            lat: parseFloat(startPoint.lat.toFixed(6)),
            lng: parseFloat(startPoint.lng.toFixed(6)),
            order: 0,
            quantity: 0,
            weight: 0,
            volume: 0,
            time_window_start: '08:00',
            time_window_end: '18:00',
            service_time: 0,
            priority: 0
          },
          // Pontos de coleta
          ...uploadedPoints.map((point, index) => {
            // Corrige a inversão de latitude e longitude se necessário
            let lat = parseFloat(point.lat);
            let lng = parseFloat(point.lng);
            
            // Se a latitude estiver fora do intervalo válido, inverte com a longitude
            if (lat < -90 || lat > 90) {
              console.log(`Corrigindo inversão de coordenadas para o ponto ${index}:`);
              console.log(`  Antes - lat: ${lat}, lng: ${lng}`);
              [lat, lng] = [lng, lat]; // Inverte os valores
              console.log(`  Depois - lat: ${lat}, lng: ${lng}`);
            }
            
            const timeWindow = point.timeWindow || { start: '08:00', end: '18:00' };
            
            return {
              id: String(point.id) || `point-${index}`,
              type: 'pickup',
              name: point.name || `Ponto ${index + 1}`,
              address: point.address || 'Endereço não informado',
              lat: parseFloat(lat.toFixed(6)),
              lng: parseFloat(lng.toFixed(6)),
              order: index + 1, // Garante que cada ponto tenha um order único
              quantity: point.quantity || 1,
              weight: parseFloat(point.weight || 0),
              volume: parseFloat(point.volume || 0.1),
              time_window_start: timeWindow.start,
              time_window_end: timeWindow.end,
              service_time: parseInt(point.service_time || 5),
              priority: parseInt(point.priority || 1)
            };
          })
        ]
      };
      
      console.log('Dados formatados para envio:', JSON.stringify(requestData, null, 2));
      
      try {
        // Chama a função de otimização com callback de progresso
        const response = await api.optimizeRoutes(requestData, (status) => {
          // Atualiza o estado de progresso com os dados recebidos
          setOptimizationProgress(prev => ({
            ...prev,
            ...status,
            progress: status.progress || prev.progress,
            message: status.message || prev.message
          }));
        });

        console.log('Resposta da API:', response);

        // Se a resposta for bem-sucedida
        if (response && response.status === 200 && response.data) {
          setOptimizationProgress({
            status: 'completed',
            message: 'Otimização concluída com sucesso!',
            progress: 100,
            requestId: response.data.request_id || '',
            error: null
          });

          // Navega para a página de visualização da rota
          if (response.data.route_id) {
            setTimeout(() => {
              navigate(`/routes/${response.data.route_id}`);
            }, 1500);
            return response;
          }

          // Se não tiver route_id, redireciona para a página de rotas com os dados
          navigate('/routes', { 
            state: { 
              optimizedRoute: response.data,
              startPoint: startPoint,
              points: uploadedPoints,
              vehicles: selectedVehicleDetails,
              cubageProfile: selectedVehicleDetails[0]?.cubage_profile || {}
            } 
          });
          
          return response;
        }
        
        throw new Error('Resposta inválida do servidor');
        
      } catch (error) {
        console.error('Erro na requisição:', error);
        
        // Atualiza o estado de erro no modal de progresso
        setOptimizationProgress(prev => ({
          ...prev,
          status: 'error',
          error: error.message || 'Erro ao processar a requisição',
          message: 'Falha ao processar a otimização'
        }));
        
        throw error; // O erro será capturado pelo bloco catch externo
      }
      
    } catch (error) {
      console.error('Erro ao gerar rotas:', error);
      setMessage({ 
        type: 'danger', 
        text: `Erro ao gerar rotas: ${error.response?.data?.detail || error.message || 'Verifique sua conexão e tente novamente'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  // Verifica se há pelo menos um veículo com perfil de cubagem selecionado
  const hasValidVehicleProfile = useCallback(() => {
    return selectedVehicles.some(vehicleId => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      return vehicle && vehicle.cubage_profile_id;
    });
  }, [selectedVehicles, vehicles]);

  // Valida se um endereço já existe na lista de pontos
  const isDuplicateAddress = (address, currentIndex) => {
    if (!address) return false;
    return uploadedPoints.some((point, index) => 
      index !== currentIndex && 
      point.address && 
      point.address.toLowerCase() === address.toLowerCase()
    );
  };

  // Valida se as coordenadas estão dentro dos limites do Brasil
  const isValidBrazilianCoordinate = (lat, lng) => {
    // Limites aproximados do Brasil
    const BRAZIL_BOUNDS = {
      minLat: -33.75,
      maxLat: 5.27,
      minLng: -73.98,
      maxLng: -32.39
    };
    
    return (
      lat >= BRAZIL_BOUNDS.minLat &&
      lat <= BRAZIL_BOUNDS.maxLat &&
      lng >= BRAZIL_BOUNDS.minLng &&
      lng <= BRAZIL_BOUNDS.maxLng
    );
  };

  // Função para exibir o modal de confirmação
  const showConfirmationModal = (options) => {
    return new Promise((resolve) => {
      const { title, message, confirmText = 'Confirmar', cancelText = 'Cancelar' } = options;
      
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
      modal.style.zIndex = '2000';
      
      modal.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 8px; width: 90%; max-width: 500px;">
          <h5 style="margin-top: 0; color: #333;">${title}</h5>
          <div style="margin: 15px 0 25px; line-height: 1.5;">
            ${message}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #6c757d; background: white; border-radius: 4px; cursor: pointer;">
              ${cancelText}
            </button>
            <button id="confirmBtn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
              ${confirmText}
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const cleanup = () => {
        document.body.removeChild(modal);
      };
      
      const confirmBtn = modal.querySelector('#confirmBtn');
      const cancelBtn = modal.querySelector('#cancelBtn');
      
      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      
      const onClickOutside = (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      };
      
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onClickOutside);
    });
  };

  // Manipulador de envio do formulário
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Iniciando geração de rotas...');
    
    try {
      // Validação básica dos campos obrigatórios
      const validationChecks = [
        {
          condition: !startPoint.address || !startPoint.lat || !startPoint.lng,
          message: 'Por favor, defina o endereço de partida.'
        },
        {
          condition: uploadedPoints.length === 0,
          message: 'Adicione pelo menos um ponto de coleta.'
        },
        {
          condition: uploadedPoints.length > maxPointsPerOptimization,
          message: `O número máximo de pontos por otimização é ${maxPointsPerOptimization}. Por favor, divida sua rota em partes menores ou aumente o limite nas configurações.`
        },
        {
          condition: selectedVehicles.length === 0,
          message: 'Selecione pelo menos um veículo.'
        },
        {
          condition: !hasValidVehicleProfile(),
          message: 'Selecione pelo menos um veículo com perfil de cubagem configurado para prosseguir com a roteirização.'
        },
        // Validação de coordenadas do ponto de partida
        {
          condition: startPoint.lat && startPoint.lng && 
                   !isValidBrazilianCoordinate(parseFloat(startPoint.lat), parseFloat(startPoint.lng)),
          message: 'As coordenadas do ponto de partida estão fora dos limites do Brasil.'
        }
      ];

      // Executa todas as validações básicas
      const failedCheck = validationChecks.find(check => check.condition);
      if (failedCheck) {
        console.warn('Validação falhou:', failedCheck.message);
        setMessage({
          type: 'warning',
          title: 'Atenção',
          text: failedCheck.message,
          showClose: true
        });
        return;
      }

      // Verificação de pontos com problemas
      const validationWarnings = [];
      const farPoints = [];
      
      // Verifica pontos fora do raio máximo a partir do ponto de partida
      if (startPoint.lat && startPoint.lng) {
        uploadedPoints.forEach((point, index) => {
          if (point.lat && point.lng) {
            const distance = calculateDistance(
              startPoint.lat,
              startPoint.lng,
              point.lat,
              point.lng
            );
            
            if (distance > maxRadiusKm) {
              farPoints.push({
                name: point.name || `Ponto ${index + 1}`,
                distance: distance.toFixed(1)
              });
            }
          }
        });
      }
      
      // Adiciona os pontos distantes aos avisos
      if (farPoints.length > 0) {
        validationWarnings.push(
          `📍 PONTO DE PARTIDA (${farPoints.length} ponto${farPoints.length > 1 ? 's' : ''} fora do raio máximo de ${maxRadiusKm}km)\n` +
          '------------------\n' +
          farPoints.slice(0, 5).map(p => `• ${p.name} (${p.distance}km)`).join('\n') +
          `${farPoints.length > 5 ? '\n• ...' : ''}`
        );
      }
      
      // Validação de pontos próximos e duplicados removida conforme solicitado
      
      // Mostra os avisos se houver, mas não impede a otimização
      if (validationWarnings.length > 0) {
        console.warn('Atenção aos seguintes pontos:', validationWarnings);
        
        // Cria uma mensagem de aviso informativa
        const warningMessage = [
          'Atenção:\n' +
          'Os seguintes pontos estão além do raio máximo configurado, mas a otimização continuará:\n',
          ...validationWarnings,
          '\n💡 DICAS:\n' +
          '----------\n' +
          '• Você pode ajustar o raio máximo se necessário\n' +
          '• Ou prosseguir com a otimização atual'
        ].join('\n');
        
        setMessage({
          type: 'warning',
          title: 'Aviso de Validação',
          text: warningMessage,
          showClose: true
        });
      }

      // Prepara os dados para validação detalhada
      const validationData = {
        points: uploadedPoints.map((point, index) => {
          // Garante que as coordenadas sejam números válidos
          const lat = parseFloat(point.lat);
          const lng = parseFloat(point.lng);
          const weight = parseFloat(point.weight || 0);
          const volume = parseFloat(point.volume || 0.1);
          const quantity = parseInt(point.quantity || 1, 10);
          
          // Validação de coordenadas
          if (isNaN(lat) || isNaN(lng) || isNaN(weight) || isNaN(volume) || isNaN(quantity)) {
            console.warn(`Ponto ${index + 1} possui valores inválidos:`, point);
          }
          
          // Valida se as coordenadas estão dentro do Brasil
          if (!isValidBrazilianCoordinate(lat, lng)) {
            console.warn(`Ponto ${index + 1} está fora dos limites do Brasil:`, point);
          }
          
          // Valida se o volume é razoável (menos de 100m³ por ponto)
          if (volume > 100) {
            console.warn(`Ponto ${index + 1} tem volume muito alto:`, volume, 'm³');
          }
          
          // Valida se o peso é razoável (menos de 10 toneladas por ponto)
          if (weight > 10000) {
            console.warn(`Ponto ${index + 1} tem peso muito alto:`, weight, 'kg');
          }
          
          return {
            lat,
            lng,
            weight,
            volume,
            quantity,
            id: point.id || `point-${index}`,
            name: point.name || `Ponto ${index + 1}`,
            address: point.address || '',
            time_window_start: point.time_window_start,
            time_window_end: point.time_window_end
          };
        }),
        vehicles: vehicles
          .filter(v => selectedVehicles.includes(v.id))
          .map(vehicle => {
          const capacity = parseFloat(vehicle.capacity) || 0;
          const maxWeight = parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0;
          const volumeCapacity = parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 
            (parseFloat(vehicle.length || 0) * 
             parseFloat(vehicle.width || 0) * 
             parseFloat(vehicle.height || 0));
          
          return {
            id: vehicle.id,
            name: vehicle.name,
            capacity,
            max_weight: maxWeight,
            volume_capacity: volumeCapacity
          };
        }),
        startPoint: {
          lat: parseFloat(startPoint.lat),
          lng: parseFloat(startPoint.lng),
          address: startPoint.address
        }
      };

      console.log('Dados para validação:', validationData);

      // Valida os dados antes de enviar para o backend
      const { isValid, errors, warnings } = validateOptimizationData(validationData);
      
      // Exibe avisos, mas não bloqueia a otimização
      if (warnings && warnings.length > 0) {
        console.warn('Avisos de validação encontrados:', warnings);
        
        // Formata os avisos para exibição
        const formattedWarnings = formatValidationErrors(warnings, true);
        
        setMessage({
          type: 'warning',
          title: 'Atenção',
          text: `${formattedWarnings}\n\nA otimização continuará, mas alguns pontos podem estar fora do raio ideal.`,
          showClose: true
        });
      }
      
      // Se houver erros críticos, não permite continuar
      if (!isValid) {
        console.warn('Erros de validação encontrados:', errors);
        
        // Formata os erros para exibição
        const formattedErrors = formatValidationErrors(errors);
        console.log('Mensagens de erro formatadas:', formattedErrors);
        
        // Adiciona dicas adicionais baseadas nos erros encontrados
        let additionalTips = '';
        
        // Verifica tipos de erros para adicionar dicas específicas
        const hasTimeWindowErrors = errors.some(err => 
          err.includes('janela de tempo') || 
          err.includes('horário')
        );
        
        const hasCapacityErrors = errors.some(err => 
          err.includes('capacidade') || 
          err.includes('peso') || 
          err.includes('volume')
        );
        
        const hasCoordinateErrors = errors.some(err => 
          err.includes('coordenadas') || 
          err.includes('localização')
        );
        
        // Constrói mensagem de dicas adicionais
        if (hasTimeWindowErrors || hasCapacityErrors || hasCoordinateErrors) {
          additionalTips += '\n\n💡 DICAS ADICIONAIS:\n';
          additionalTips += '------------------------\n';
          
          if (hasTimeWindowErrors) {
            additionalTips += '• Verifique se as janelas de tempo são realistas e estão no formato HH:MM\n';
            additionalTips += '• Certifique-se de que o horário de término é posterior ao de início\n';
          }
          
          if (hasCapacityErrors) {
            additionalTips += '• Verifique se a capacidade dos veículos atende à demanda total\n';
            additionalTips += '• Considere adicionar mais veículos ou reduzir a quantidade de itens\n';
          }
          
          if (hasCoordinateErrors) {
            additionalTips += '• Verifique se as coordenadas estão dentro do território brasileiro\n';
            additionalTips += '• Confirme se os endereços foram corretamente geocodificados\n';
          }
        }
        
        // Exibe mensagem de erro detalhada com dicas adicionais
        setMessage({
          type: 'warning',
          title: 'Ajuste necessário',
          text: `Encontramos alguns problemas que precisam ser resolvidos antes de continuar.\n\n${formattedErrors}${additionalTips}`,
          showClose: true,
          autoHide: false,
          scrollToTop: true
        });
        
        // Rola para o topo da página para mostrar os erros
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Log adicional para depuração
        console.log('Dados de validação que causaram erros:', validationData);
        return;
      }
      
      // Obtém os detalhes dos veículos selecionados
      const selectedVehicleDetails = vehicles.filter(v => selectedVehicles.includes(v.id));
      
      // Verifica a capacidade total dos veículos selecionados
      const totalCapacity = selectedVehicleDetails.reduce((sum, vehicle) => {
        return sum + (parseFloat(vehicle.capacity) || 0);
      }, 0);
      
      const totalWeight = uploadedPoints.reduce((sum, point) => {
        return sum + (parseFloat(point.weight) || 0);
      }, 0);
      
      // Verifica a relação entre capacidade e peso total
      if (totalCapacity < totalWeight * 0.8) {
        // Cria um elemento de diálogo personalizado mais amigável
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';
        
        // Conteúdo do modal
        modal.innerHTML = `
          <div style="background: white; padding: 25px; border-radius: 8px; width: 90%; max-width: 500px;">
            <h5 style="color: #d39e00; margin-top: 0;">⚠️ Atenção: Capacidade Insuficiente</h5>
            <p>Os veículos selecionados podem não ter capacidade suficiente para atender todos os pontos de coleta:</p>
            <ul>
              <li>Capacidade total dos veículos: <strong>${totalCapacity.toFixed(2)} kg</strong></li>
              <li>Peso total dos pontos: <strong>${totalWeight.toFixed(2)} kg</strong></li>
              <li>Déficit: <strong style="color: #dc3545;">${(totalWeight - totalCapacity).toFixed(2)} kg</strong></li>
            </ul>
            <p>Recomendações:</p>
            <ul>
              <li>Adicione mais veículos à frota</li>
              <li>Reduza a quantidade de itens a serem coletados</li>
              <li>Verifique se os pesos estão corretos</li>
            </ul>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #6c757d; background: white; border-radius: 4px; cursor: pointer;">
                Cancelar e Ajustar
              </button>
              <button id="proceedBtn" style="padding: 8px 16px; background: #ffc107; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                Continuar Mesmo Assim
              </button>
            </div>
          </div>
        `;
        
        // Adiciona o modal ao documento
        document.body.appendChild(modal);
        
        // Retorna uma promessa que resolve quando o usuário tomar uma decisão
        const userConfirmed = await new Promise((resolve) => {
          // Configura os event listeners
          const proceedBtn = modal.querySelector('#proceedBtn');
          const cancelBtn = modal.querySelector('#cancelBtn');
          
          const cleanup = () => {
            proceedBtn.removeEventListener('click', onProceed);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onClickOutside);
            document.body.removeChild(modal);
          };
          
          const onProceed = () => {
            cleanup();
            console.log('Usuário optou por continuar apesar da capacidade insuficiente');
            resolve(true);
          };
          
          const onCancel = () => {
            cleanup();
            console.log('Usuário cancelou a operação devido à capacidade insuficiente');
            setMessage({
              type: 'info',
              title: 'Operação Cancelada',
              text: 'Por favor, ajuste a capacidade dos veículos ou a quantidade de itens e tente novamente.',
              showClose: true
            });
            resolve(false);
          };
          
          const onClickOutside = (e) => {
            if (e.target === modal) {
              cleanup();
              resolve(false);
            }
          };
          
          proceedBtn.addEventListener('click', onProceed);
          cancelBtn.addEventListener('click', onCancel);
          modal.addEventListener('click', onClickOutside);
        });
        
        // Se o usuário cancelou, interrompe o processo
        if (!userConfirmed) {
          return;
        }
      }
      
      console.log('Validação concluída com sucesso. Iniciando otimização...');
      
      // Exibe feedback visual para o usuário
      setMessage({
        type: 'info',
        title: 'Processando',
        text: 'Estamos otimizando sua rota. Isso pode levar alguns instantes...',
        showClose: false
      });
      
      // Chama a função de geração de rotas
      await generateOptimizedRoutes();
      
    } catch (error) {
      console.error('Erro durante a geração de rotas:', error);
      
      // Mensagens de erro mais amigáveis
      let errorMessage = 'Ocorreu um erro ao processar a rota. Por favor, tente novamente.';
      
      if (error.response) {
        // Erro da API
        if (error.response.status === 400) {
          errorMessage = 'Dados inválidos fornecidos. Verifique as informações e tente novamente.';
        } else if (error.response.status === 500) {
          errorMessage = 'Erro interno do servidor. Por favor, tente novamente mais tarde.';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({
        type: 'danger',
        title: 'Erro',
        text: errorMessage,
        showClose: true
      });
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Otimização de Rotas</h2>
      
      {message.text && (
        <Alert 
          variant={message.type} 
          onClose={() => setMessage({ type: '', title: '', text: '' })} 
          dismissible
          className="mt-3"
        >
          {message.title && <Alert.Heading>{message.title}</Alert.Heading>}
          {message.text.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </Alert>
      )}

      {/* Configurações da Rota */}
      <Card className="mb-4">
        <Card.Header>
          <h5>Configurações da Rota</h5>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <h5>Ponto de Partida</h5>
            <Row className="mb-3">
              <Col md={7}>
                <Form.Group>
                  <Form.Label>Endereço de Partida</Form.Label>
                  <InputGroup className="mb-2">
                    <FormControl
                      type="text"
                      placeholder="Digite o endereço de partida"
                      value={startPoint.address}
                      onChange={handleManualAddressChange}
                      onKeyPress={(e) => e.key === 'Enter' && handleManualAddressSubmit(e)}
                    />
                    <Button 
                      variant="secondary"
                      onClick={handleManualAddressSubmit}
                      title="Buscar endereço"
                    >
                      <FaIcons.FaSearch />
                    </Button>
                  </InputGroup>
                  
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="text-muted small">
                      {startPoint.lat && startPoint.lng ? (
                        `Localização: ${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`
                      ) : 'Nenhuma localização definida'}
                    </div>
                    
                    <div className="text-end">
                      <span className="mx-2 text-muted">ou</span>
                      <Button 
                        variant={startPoint.isCurrentLocation ? 'primary' : 'outline-secondary'}
                        onClick={getCurrentLocation}
                        disabled={isLocating}
                        size="sm"
                      >
                        {isLocating ? (
                          <>
                            <Spinner as="span" size="sm" animation="border" role="status" aria-hidden="true" />
                            <span className="visually-hidden">Localizando...</span>
                          </>
                        ) : (
                          <FaMapMarkerAlt className="me-1" />
                        )}
                        {startPoint.isCurrentLocation ? 'Usando Localização Atual' : 'Usar Minha Localização'}
                      </Button>
                    </div>
                  </div>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Horário</Form.Label>
                  <Form.Control
                    type="time"
                    value={routeStartTime}
                    onChange={(e) => setRouteStartTime(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Raio (km)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="1000"
                    step="10"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(parseInt(e.target.value, 10))}
                  />
                  <Form.Text className="text-muted">
                    Distância máxima permitida do ponto de partida
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Máx. Pontos</Form.Label>
                  <Form.Control
                    type="number"
                    min="10"
                    max="1000"
                    step="10"
                    value={maxPointsPerOptimization}
                    onChange={(e) => setMaxPointsPerOptimization(parseInt(e.target.value, 10))}
                  />
                  <Form.Text className="text-muted">
                    Número máximo de pontos processados por vez
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            {startPoint.lat && startPoint.lng && (
              <div className="mt-2 text-muted small">
                <FaMapMarkerAlt className="text-danger me-1" />
                Localização definida: {startPoint.lat.toFixed(6)}, {startPoint.lng.toFixed(6)}
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Importação de Pontos */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Passo 1: Importar Pontos de Coleta</h5>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <Button 
              variant="primary" 
              onClick={() => setShowPointImporter(true)}
              className="me-3"
            >
              <FaFileImport className="me-2" /> Importar de Arquivo
            </Button>
            
            <Button 
              variant="outline-primary" 
              onClick={handleAddManualPoint}
              className="me-3"
            >
              <FaPlus className="me-2" /> Adicionar Ponto Manualmente
            </Button>
            
            <Button 
              variant="outline-secondary" 
              onClick={generateTemplate}
              className="float-end"
            >
              <FaFileDownload className="me-2" /> Baixar Modelo
            </Button>
          </div>
          
          {uploadedPoints.length > 0 && (
            <div className="mt-4">
              <h6>Pontos Carregados: {uploadedPoints.length}</h6>
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table striped bordered hover size="sm">
                  <thead className="sticky-top bg-white">
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>Endereço</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedPoints.map((point, index) => (
                      <tr key={point.id}>
                        <td>{index + 1}</td>
                        <td>
                          <Form.Control
                            type="text"
                            value={point.name}
                            onChange={(e) => handleUpdatePoint(point.id, 'name', e.target.value)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="text"
                            value={point.address || ''}
                            onChange={(e) => handleUpdatePoint(point.id, 'address', e.target.value)}
                            placeholder="Opcional"
                            size="sm"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            step="0.000001"
                            value={point.lat}
                            onChange={(e) => handleUpdatePoint(point.id, 'lat', parseFloat(e.target.value) || 0)}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            step="0.000001"
                            value={point.lng}
                            onChange={(e) => handleUpdatePoint(point.id, 'lng', parseFloat(e.target.value) || 0)}
                            size="sm"
                          />
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleRemovePoint(point.id)}
                            title="Remover ponto"
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
      
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Passo 2: Configurações de Roteamento</h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleFormSubmit}>
            <Row className="mb-4">
              <Col md={12}>
                <h6>Selecionar Veículos</h6>
                {vehicles.length === 0 ? (
                  <Alert variant="info">
                    Nenhum veículo disponível. Por favor, adicione veículos primeiro.
                  </Alert>
                ) : (
                  <div className="d-flex flex-wrap gap-3">
                    {vehicles.map(vehicle => {
                      // Verifica se o veículo tem um perfil de cubagem
                      const hasCubageProfile = Boolean(vehicle.cubage_profile_id || vehicle.cubage_profile);
                      
                      // Obtém o nome do perfil de cubagem
                      let cubageProfileName = 'Sem perfil';
                      
                      // Verifica se o perfil está aninhado em um objeto 'data' ou é uma string direta
                      let cubageProfile = vehicle.cubage_profile;
                      
                      // Se for uma string, já é o nome do perfil
                      if (typeof cubageProfile === 'string') {
                        cubageProfileName = cubageProfile;
                      } 
                      // Se for um objeto, tenta extrair o nome
                      else if (cubageProfile) {
                        cubageProfile = cubageProfile.data || cubageProfile;
                        cubageProfileName = cubageProfile.name || 
                                         cubageProfile.nome || 
                                         cubageProfile.description ||
                                         `ID: ${cubageProfile.id || vehicle.cubage_profile_id}`;
                      } 
                      // Se tiver apenas o ID, mostra o ID
                      else if (vehicle.cubage_profile_id) {
                        cubageProfileName = `ID: ${vehicle.cubage_profile_id}`;
                      }
                      
                      console.log('Verificando veículo:', {
                        id: vehicle.id,
                        name: vehicle.name,
                        cubage_profile_id: vehicle.cubage_profile_id,
                        cubage_profile: vehicle.cubage_profile,
                        cubageProfileName,
                        hasCubageProfile,
                        vehicle_data: vehicle // Mostra todos os dados do veículo para depuração
                      });
                      const volumeCapacity = vehicle.length && vehicle.width && vehicle.height ? 
                        (vehicle.length * vehicle.width * vehicle.height).toFixed(2) : null;
                      
                      return (
                        <Card 
                          key={vehicle.id}
                          className={`vehicle-card ${isVehicleSelected(vehicle.id) ? 'border-primary' : ''} ${!hasCubageProfile ? 'border-warning' : ''}`}
                          style={{ 
                            width: '320px', 
                            cursor: 'pointer',
                            borderLeft: hasCubageProfile ? '4px solid #0d6efd' : '4px solid #ffc107',
                            opacity: !hasCubageProfile ? 0.8 : 1
                          }}
                          onClick={() => handleVehicleSelect(vehicle.id, !isVehicleSelected(vehicle.id))}
                        >
                          <Card.Body>
                            <Form.Check 
                              type="checkbox"
                              id={`vehicle-${vehicle.id}`}
                              label={
                                <div>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="fw-bold">{vehicle.name}</span>
                                    {!hasCubageProfile ? (
                                      <Badge bg="warning" text="dark" className="ms-2">
                                        Sem perfil
                                      </Badge>
                                    ) : (
                                      <Badge bg="success" className="ms-2">
                                        Com perfil
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-muted small mt-2">
                                    <div>Capacidade: {vehicle.capacity || '0'} kg</div>
                                    {hasCubageProfile ? (
                                      <div>Perfil: {cubageProfileName}</div>
                                    ) : (
                                      <div className="text-warning small">Sem perfil de cubagem</div>
                                    )}
                                    <div className="mt-1">
                                      <small className="text-muted">
                                        {volumeCapacity ? `${volumeCapacity} m³` : 'Dimensões não configuradas'}
                                      </small>
                                    </div>
                                  </div>
                                </div>
                              }
                              checked={isVehicleSelected(vehicle.id)}
                              onChange={(e) => handleVehicleSelect(vehicle.id, e.target.checked)}
                              className="mb-0"
                            />
                          </Card.Body>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Col>
            </Row>
            
            {/* Informações dos veículos */}
            <Row className="mb-4">
              <Col md={12}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6>Veículos Disponíveis</h6>
                  <div className="small text-muted">
                    {vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''} disponível{vehicles.length !== 1 ? 's' : ''}
                  </div>
                </div>
                
                {isLoadingVehicles ? (
                  <div className="text-center my-4">
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Carregando veículos...</span>
                    </Spinner>
                    <div className="mt-2">Carregando veículos...</div>
                  </div>
                ) : vehicles.length === 0 ? (
                  <Alert variant="warning" className="mb-0">
                    <FaExclamationTriangle className="me-2" />
                    Nenhum veículo cadastrado. Por favor, cadastre veículos antes de continuar.
                  </Alert>
                ) : (
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {vehicles.map(vehicle => {
                      const isSelected = selectedVehicles.includes(vehicle.id);
                      const hasCubageProfile = Boolean(vehicle.cubage_profile_id || (vehicle.cubage_profile && vehicle.cubage_profile.id));
                      
                      return (
                        <Button
                          key={vehicle.id}
                          variant={isSelected ? 'primary' : 'outline-secondary'}
                          className="d-flex align-items-center"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedVehicles(prev => prev.filter(id => id !== vehicle.id));
                            } else {
                              setSelectedVehicles(prev => [...prev, vehicle.id]);
                            }
                          }}
                        >
                          {vehicle.name || vehicle.plate || `Veículo ${vehicle.id}`}
                          {!hasCubageProfile && (
                            <Badge bg="warning" className="ms-2">
                              Sem cubagem
                            </Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
                
                {/* Veículos selecionados */}
                {selectedVehicles.length > 0 && (
                  <div className="mt-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6>Veículos Selecionados</h6>
                      <div className="small text-muted">
                        {selectedVehicles.length} veículo{selectedVehicles.length !== 1 ? 's' : ''} selecionado{selectedVehicles.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {vehicles
                        .filter(vehicle => selectedVehicles.includes(vehicle.id))
                        .map(vehicle => {
                          const hasCubageProfile = Boolean(vehicle.cubage_profile_id || (vehicle.cubage_profile && vehicle.cubage_profile.id));
                          return (
                            <Badge 
                              key={vehicle.id} 
                              bg={hasCubageProfile ? 'primary' : 'warning'} 
                              className="d-flex align-items-center py-2"
                            >
                              {vehicle.name || vehicle.plate || `Veículo ${vehicle.id}`}
                              <Button 
                                variant="link" 
                                className="text-white p-0 ms-2"
                                style={{ lineHeight: 1 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVehicles(prev => prev.filter(id => id !== vehicle.id));
                                }}
                              >
                                <FaTimesCircle />
                              </Button>
                            </Badge>
                          );
                        })}
                    </div>
                    
                    {selectedVehicles.some(id => {
                      const vehicle = vehicles.find(v => v.id === id);
                      return !vehicle?.cubage_profile_id;
                    }) && (
                      <Alert variant="warning" className="mt-2 mb-0">
                        <FaExclamationTriangle className="me-2" />
                        Alguns veículos selecionados não possuem um perfil de cubagem configurado.
                        Eles não serão considerados nos cálculos de roteirização.
                      </Alert>
                    )}
                  </div>
                )}
              </Col>
            </Row>
            
            {/* Resumo da Carga */}
            {uploadedPoints.length > 0 && (
              <Row className="mb-4">
                <Col md={12}>
                  <h6>Resumo da Carga</h6>
                  <Card>
                    <Card.Body>
                      <Row>
                        <Col md={4}>
                          <div className="text-center">
                            <div className="h4 mb-1">
                              {uploadedPoints.reduce((sum, point) => sum + (point.quantity || 1), 0)}
                            </div>
                            <div className="text-muted small">Itens</div>
                          </div>
                        </Col>
                        <Col md={4}>
                          <div className="text-center">
                            <div className="h4 mb-1">
                              {uploadedPoints.reduce((sum, point) => sum + ((point.weight || 0) * (point.quantity || 1)), 0).toFixed(2)} kg
                            </div>
                            <div className="text-muted small">Peso Total</div>
                          </div>
                        </Col>
                        <Col md={4}>
                          <div className="text-center">
                            <div className="h4 mb-1">
                              {uploadedPoints.reduce((sum, point) => sum + ((point.volume || 0.1) * (point.quantity || 1)), 0).toFixed(2)} m³
                            </div>
                            <div className="text-muted small">Volume Total</div>
                          </div>
                        </Col>
                      </Row>
                      
                      {selectedVehicles.length > 0 && (
                        <div className="mt-3">
                          <h6>Capacidade dos Veículos Selecionados</h6>
                          <div className="d-flex flex-wrap gap-3">
                            {vehicles
                              .filter(v => selectedVehicles.includes(v.id))
                              .map(vehicle => (
                                <div key={vehicle.id} className="border p-2 rounded">
                                  <div className="fw-bold">{vehicle.name}</div>
                                  <div className="small">
                                    <div>Capacidade: {vehicle.capacity} kg</div>
                                    <div>Volume: {vehicle.length && vehicle.width && vehicle.height ? 
                                      (vehicle.length * vehicle.width * vehicle.height).toFixed(2) + ' m³' : 'N/A'}</div>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
            
            <div className="d-flex justify-content-between align-items-center mt-4">
              <div>
                {uploadedPoints.length > 0 && (
                  <div className="text-muted small">
                    {uploadedPoints.length} pontos de coleta carregados
                  </div>
                )}
                {selectedVehicles.length > 0 && (
                  <div className="text-muted small">
                    {selectedVehicles.length} veículo{selectedVehicles.length !== 1 ? 's' : ''} selecionado{selectedVehicles.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              
              <Button 
                variant="primary" 
                type="submit"
                disabled={loading || uploadedPoints.length === 0 || selectedVehicles.length === 0}
                className="px-4"
                size="lg"
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="me-2" />
                    Gerar Rotas Otimizadas
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      
      {uploadedPoints.length > 0 && (
        <Card>
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <span>Pontos de Coleta Carregados ({uploadedPoints.length})</span>
              <small className="text-muted">
                Peso Total: {uploadedPoints.reduce((sum, point) => sum + point.weight, 0).toFixed(2)}kg | 
                Volume Total: {uploadedPoints.reduce((sum, point) => sum + point.volume, 0).toFixed(3)}m³
              </small>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <Table striped hover className="mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Endereço</th>
                  <th>Quantidade</th>
                  <th>Peso (kg)</th>
                  <th>Volume (m³)</th>
                  <th>Janela de Tempo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {uploadedPoints.map((point, index) => (
                  <tr key={point.id}>
                    <td>{index + 1}</td>
                    <td>{point.address}</td>
                    <td>{point.quantity}</td>
                    <td>{point.weight}</td>
                    <td>{point.volume}</td>
                    <td>{point.timeWindow.start} - {point.timeWindow.end}</td>
                    <td className="text-end">
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        onClick={() => handleRemovePoint(index)}
                        disabled={loading}
                      >
                        <FaTrash />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
      


      {/* Modal de Importação de Pontos */}
      <PointImporter 
        show={showPointImporter} 
        onHide={() => setShowPointImporter(false)} 
        onImport={(points) => {
          // Adiciona um ID único para cada ponto
          const pointsWithIds = points.map(point => ({
            ...point,
            id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }));
          
          setUploadedPoints(prev => [...prev, ...pointsWithIds]);
          setShowPointImporter(false);
        }} 
      />

      {/* Modal de Progresso da Otimização */}
      <Modal
        show={showProgressModal}
        onHide={() => setShowProgressModal(false)}
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header closeButton={optimizationProgress.status === 'error'}>
          <Modal.Title>
            {optimizationProgress.status === 'processing' && 'Otimizando Rotas...'}
            {optimizationProgress.status === 'completed' && 'Otimização Concluída'}
            {optimizationProgress.status === 'error' && 'Erro na Otimização'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {optimizationProgress.status === 'processing' && (
            <div className="my-4">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <p>{optimizationProgress.message || 'Processando sua solicitação...'}</p>
              <div className="progress" style={{ height: '20px' }}>
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated" 
                  role="progressbar" 
                  style={{ width: `${optimizationProgress.progress}%` }}
                  aria-valuenow={optimizationProgress.progress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {optimizationProgress.progress}%
                </div>
              </div>
            </div>
          )}
          
          {optimizationProgress.status === 'completed' && (
            <div className="my-4">
              <div className="text-success mb-3">
                <FaCheckCircle size={48} />
              </div>
              <h5>Rota otimizada com sucesso!</h5>
              <p>Redirecionando para a visualização da rota...</p>
            </div>
          )}
          
          {optimizationProgress.status === 'error' && (
            <div className="my-4">
              <div className="text-danger mb-3">
                <FaTimesCircle size={48} />
              </div>
              <h5>Erro ao otimizar rota</h5>
              <p className="text-danger">{optimizationProgress.error || 'Ocorreu um erro durante a otimização.'}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowProgressModal(false)}
            disabled={optimizationProgress.status === 'processing'}
          >
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Upload;
