import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Spinner, 
  Alert, 
  Button, 
  Row, 
  Col, 
  Badge, 
  ListGroup, 
  Tab, 
  Tabs, 
  Toast, 
  ToastContainer,
  Form,
  InputGroup,
  FormControl,
  Table
} from 'react-bootstrap';
import { 
  FaTruck, 
  FaMapMarkerAlt, 
  FaRoute, 
  FaInfoCircle,
  FaPlus,
  FaBox, 
  FaWeightHanging, 
  FaRuler, 
  FaHome, 
  FaExternalLinkAlt, 
  FaMapMarkedAlt, 
  FaBoxes, 
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaSync
} from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RouteMap from '../components/RouteMap';
import routeService from '../services/routeService';
import collectionPointService from '../services/collectionPointService';

const RoutesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [optimizationStatus, setOptimizationStatus] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [center] = useState([-23.5505, -46.6333]); // Centro em São Paulo
  const [bounds, setBounds] = useState(null);
  const [map, setMap] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activePoints, setActivePoints] = useState([]);
  const [showActivePoints, setShowActivePoints] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'active',
    // Adicione mais filtros conforme necessário
  });
  // Estados para controle do mapa
  
  // Processa as rotas para o formato do mapa
  const processRoutesForMap = useCallback((routes) => {
    if (!routes || !Array.isArray(routes)) return { markers: [], polylines: [] };

    const markers = [];
    const polylines = [];
    // Cores distintas para cada rota
    const colors = [
      '#FF5252', // Vermelho
      '#4CAF50', // Verde
      '#2196F3', // Azul
      '#FF9800', // Laranja
      '#9C27B0', // Roxo
      '#00BCD4', // Ciano
      '#FFC107', // Âmbar
      '#795548'  // Marrom
    ];

    routes.forEach((route, routeIndex) => {
      const color = colors[routeIndex % colors.length];
      const routePoints = [];
      let totalDistance = 0;
      let totalDuration = 0;

      // Adiciona marcadores para cada ponto da rota
      if (route.points && Array.isArray(route.points)) {
        route.points.forEach((point, pointIndex) => {
          if (!point || typeof point !== 'object') return;
          
          const isFirstPoint = pointIndex === 0;
          const isLastPoint = pointIndex === route.points.length - 1;
          let pointType = 'point';
          
          if (isFirstPoint) pointType = 'start';
          else if (isLastPoint) pointType = 'end';
          else if (point.type) pointType = point.type;

          // Calcula a distância e duração desde o ponto anterior
          let distanceFromPrevious = 0;
          let durationFromPrevious = 0;
          
          if (pointIndex > 0) {
            const prevPoint = route.points[pointIndex - 1];
            if (prevPoint && prevPoint.lat && prevPoint.lng) {
              // Simples cálculo de distância em linha reta (poderia ser substituído por distância real da rota)
              const latDiff = point.lat - prevPoint.lat;
              const lngDiff = point.lng - prevPoint.lng;
              distanceFromPrevious = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Aproximação em km
              durationFromPrevious = distanceFromPrevious * 2; // Aproximação em minutos (60 km/h)
              
              totalDistance += distanceFromPrevious;
              totalDuration += durationFromPrevious;
            }
          }

          const marker = {
            position: [point.lat, point.lng],
            popup: {
              title: point.name || `Ponto ${point.id || pointIndex + 1}`,
              id: point.id || `p${routeIndex}-${pointIndex}`,
              address: point.address || 'Endereço não informado',
              reference: point.reference || 'Sem referência',
              phone: point.phone || 'Não informado',
              type: point.type || 'coleta',
              priority: point.priority || false,
              notes: point.notes || '',
              sequence: pointIndex + 1,
              quantity: point.quantity || 1,
              weight: point.weight_kg ? `${point.weight_kg} kg` : 'Não informado',
              volume: point.volume_m3 ? `${point.volume_m3} m³` : 'Não informado',
              time_window: point.time_window || 'Não especificada',
              service_time: point.service_time_min ? `${point.service_time_min} min` : 'Não especificado',
              distance_from_previous: distanceFromPrevious > 0 ? `${distanceFromPrevious.toFixed(2)} km` : 'Ponto de partida',
              duration_from_previous: durationFromPrevious > 0 ? `${Math.round(durationFromPrevious)} min` : 'Ponto de partida',
              total_distance: totalDistance > 0 ? `${totalDistance.toFixed(2)} km` : 'Ponto de partida',
              total_duration: totalDuration > 0 ? `${Math.round(totalDuration)} min` : 'Ponto de partida'
            },
            markerConfig: {
              type: pointType,
              color: color,
              icon: pointType === 'start' ? 'home' : (pointType === 'end' ? 'flag' : 'point'),
              size: pointType === 'start' ? 40 : (pointType === 'end' ? 36 : 32),
              sequence: pointIndex + 1
            }
          };
          
          markers.push(marker);
          routePoints.push([point.lat, point.lng]);
        });
      }

      // Adiciona a linha da rota
      if (routePoints.length > 1) {
        // Calcula métricas totais da rota
        const totalStops = route.points?.length || 0;
        const totalWeight = route.points?.reduce((sum, p) => sum + (p.weight_kg || 0), 0) || 0;
        const totalVolume = route.points?.reduce((sum, p) => sum + (p.volume_m3 || 0), 0) || 0;
        
        polylines.push({
          positions: routePoints,
          color: color,
          weight: 5,
          opacity: 0.7,
          dashArray: null,
          vehicle: route.vehicle_name || `Veículo ${routeIndex + 1}`,
          total_distance: totalDistance,
          total_duration: totalDuration,
          total_stops: totalStops,
          total_weight: totalWeight,
          total_volume: totalVolume,
          metadata: {
            title: `Rota ${routeIndex + 1}`,
            vehicle: route.vehicle_name || 'Não especificado',
            driver: route.driver_name || 'Não atribuído',
            capacity: route.vehicle_capacity || {},
            constraints: route.constraints || {}
          },
          popup: {
            title: `Rota ${routeIndex + 1}`,
            content: [
              `Veículo: ${route.vehicle_name || 'Não especificado'}`,
              `Motorista: ${route.driver_name || 'Não atribuído'}`,
              `Paradas: ${totalStops} pontos`,
              `Distância total: ${totalDistance.toFixed(2)} km`,
              `Duração total: ${Math.round(totalDuration)} min`,
              `Carga: ${totalWeight.toFixed(2)} kg / ${route.vehicle_capacity?.max_weight_kg || '∞'} kg`,
              `Volume: ${totalVolume.toFixed(2)} m³ / ${route.vehicle_capacity?.max_volume_m3 || '∞'} m³`,
              `Status: ${route.status || 'Planejada'}`
            ].filter(Boolean).join('<br>')
          }
        });
      }
    });

    return { markers, polylines };
  }, []);

  // Função para carregar pontos ativos
  const loadActivePoints = useCallback(async () => {
    try {
      setLoadingPoints(true);
      // Adiciona um pequeno atraso para evitar sobrecarga na API durante testes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Busca os pontos ativos com os filtros atuais
      const points = await collectionPointService.getAll({ 
        status: 'active', 
        ...filters,
        // Adiciona parâmetros adicionais para melhorar a busca
        include_details: true,
        limit: 1000 // Aumenta o limite de pontos retornados
      });
      
      console.log('Pontos ativos carregados:', points);
      
      // Formata os pontos para o formato esperado pelo mapa
      const formattedPoints = points
        .filter(point => 
          point.latitude && 
          point.longitude && 
          !isNaN(parseFloat(point.latitude)) && 
          !isNaN(parseFloat(point.longitude))
        )
        .map(point => {
          // Formata o endereço completo
          const address = [
            point.address,
            point.number ? `Nº ${point.number}` : null,
            point.complement,
            point.neighborhood,
            point.city ? `${point.city}${point.state ? `-${point.state}` : ''}` : null,
            point.cep ? `CEP: ${point.cep}` : null
          ].filter(Boolean).join(', ');
          
          // Formata os contatos
          const contacts = [
            point.contact_name ? `Contato: ${point.contact_name}` : null,
            point.phone ? `Tel: ${point.phone}` : null,
            point.email ? `Email: ${point.email}` : null
          ].filter(Boolean).join(' | ');
          
          // Determina a cor do marcador com base no status
          let markerColor = '#3498db'; // Azul padrão
          let markerIcon = 'map-marker';
          let markerSize = 32;
          
          if (point.priority === 'high') {
            markerColor = '#e74c3c'; // Vermelho para alta prioridade
            markerIcon = 'exclamation-triangle';
            markerSize = 36;
          } else if (point.status === 'pending') {
            markerColor = '#f39c12'; // Laranja para pendentes
            markerIcon = 'clock';
          } else if (point.status === 'inactive') {
            markerColor = '#95a5a6'; // Cinza para inativos
            markerIcon = 'ban';
          }
          
          return {
            id: point.id,
            lat: parseFloat(point.latitude),
            lng: parseFloat(point.longitude),
            popup: {
              title: point.name || `Ponto #${point.id}`,
              address: address || 'Endereço não informado',
              reference: point.reference || 'Sem referência',
              contacts: contacts || 'Sem contato cadastrado',
              status: point.status || 'Ativo',
              type: point.type || 'Coleta',
              priority: point.priority || 'Normal',
              notes: point.notes || 'Nenhuma observação',
              quantity: point.quantity || 1,
              weight: point.weight_kg ? `${point.weight_kg} kg` : 'Não informado',
              volume: point.volume_m3 ? `${point.volume_m3} m³` : 'Não informado',
              time_window: point.time_window || 'Não especificada',
              service_time: point.service_time_min ? `${point.service_time_min} min` : 'Não especificado',
              last_visit: point.last_visit || 'Nunca visitado',
              created_at: point.created_at ? new Date(point.created_at).toLocaleDateString('pt-BR') : 'Data não disponível'
            },
            markerConfig: {
              type: 'point',
              color: markerColor,
              icon: markerIcon,
              size: markerSize,
              pulse: point.priority === 'high' // Efeito de pulso para alta prioridade
            },
            // Metadados adicionais para filtragem
            metadata: {
              city: point.city,
              neighborhood: point.neighborhood,
              type: point.type,
              priority: point.priority,
              status: point.status,
              has_notes: !!point.notes,
              has_issues: point.has_issues || false
            }
          };
        });
      
      console.log('Pontos formatados:', formattedPoints);
      setActivePoints(formattedPoints);
      
      // Atualiza os limites do mapa para incluir os pontos ativos
      if (formattedPoints.length > 0) {
        const bounds = L.latLngBounds(
          formattedPoints.map(point => [point.lat, point.lng])
        );
        
        // Se já tiver um mapa, ajusta a visualização
        if (map) {
          // Aguarda um pouco para garantir que o mapa esteja pronto
          setTimeout(() => {
            try {
              map.fitBounds(bounds.pad(0.1), { 
                padding: [50, 50],
                maxZoom: 15 
              });
            } catch (error) {
              console.error('Erro ao ajustar visualização do mapa:', error);
            }
          }, 100);
        }
      }
      
    } catch (error) {
      console.error('Erro ao carregar pontos ativos:', error);
      setToastMessage('Erro ao carregar pontos ativos. Tente novamente mais tarde.');
      setShowToast(true);
    } finally {
      setLoadingPoints(false);
    }
  }, [filters, map]);

  // Efeito para recarregar pontos ativos quando os filtros mudarem
  useEffect(() => {
    loadActivePoints();
  }, [loadActivePoints]);
  
  // Processa os marcadores das rotas
  const processedMarkers = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    
    const { markers } = processRoutesForMap(routes);
    return markers;
  }, [routes, processRoutesForMap]);
  
  // Atualiza os limites do mapa quando os marcadores mudam
  useEffect(() => {
    if (map && processedMarkers.length > 0) {
      const bounds = L.latLngBounds(
        processedMarkers.map(marker => marker.position)
      );
      map.fitBounds(bounds.pad(0.1), { maxZoom: 15 });
    }
  }, [map, processedMarkers]);

  // Efeito para carregar rotas ou processar pontos selecionados
  useEffect(() => {
    if (!routes || !Array.isArray(routes)) return { markers: [], polylines: [] };

    const markers = [];
    const polylines = [];
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFA500', '#800080', '#FF00FF', '#00FFFF', '#A52A2A'];

    routes.forEach((route, routeIndex) => {
      const color = colors[routeIndex % colors.length];
      const routePoints = [];

      // Adiciona marcadores para cada ponto da rota
      route.points.forEach((point, pointIndex) => {
        const marker = {
          position: [point.lat, point.lng],
          popup: {
            title: point.name || `Ponto ${point.id}`,
            content: [
              `Endereço: ${point.address || 'Não informado'}`,
              `Tipo: ${point.type || 'Não especificado'}`,
              `Peso: ${point.weight_kg || 0} kg`,
              `Volume: ${point.volume_m3 || 0} m³`,
              `Janela de tempo: ${point.time_window || 'Não especificada'}`,
              `Tempo de serviço: ${point.service_time_min || 0} min`
            ].join('<br>'),
            sequence: pointIndex + 1
          },
          markerConfig: {
            type: point.type === 'start' ? 'home' : 'point',
            color: color,
            icon: point.type === 'start' ? 'home' : 'point',
            size: point.type === 'start' ? 40 : 32,
            sequence: pointIndex + 1
          }
        };
        markers.push(marker);
        routePoints.push([point.lat, point.lng]);
      });

      // Adiciona a linha da rota
      if (routePoints.length > 1) {
        polylines.push({
          positions: routePoints,
          color: color,
          weight: 5,
          opacity: 0.7,
          dashArray: null,
          popup: {
            title: `Rota ${routeIndex + 1}`,
            content: [
              `Veículo: ${route.vehicle_name || 'Não especificado'}`,
              `Distância: ${route.distance_km || 0} km`,
              `Duração: ${route.duration_min || 0} min`,
              `Carga: ${route.load_kg || 0} kg / ${route.vehicle_capacity?.max_weight_kg || 0} kg`,
              `Volume: ${route.volume_m3 || 0} m³ / ${route.vehicle_capacity?.max_volume_m3 || 0} m³`
            ].join('<br>')
          }
        });
      }
    });

    return { markers, polylines };
  }, []);

  // Efeito para carregar rotas ou processar pontos selecionados
  useEffect(() => {
    // Carrega pontos ativos quando o componente é montado
    loadActivePoints();

    // Verifica se há pontos selecionados para roteirização
    if (location.state?.selectedPoints) {
      console.log('Pontos selecionados para roteirização:', location.state.selectedPoints);
      setToastMessage(`${location.state.selectedPoints.length} ponto(s) selecionado(s) para roteirização`);
      setShowToast(true);
      
      // Converte os pontos para o formato esperado pelo serviço de roteirização
      const pointsForRouting = location.state.selectedPoints.map(point => ({
        id: point.id,
        name: point.name,
        address: point.address,
        neighborhood: point.neighborhood,
        city: point.city,
        state: point.state,
        lat: point.latitude,
        lng: point.longitude,
      }));
      
      console.log('Pontos formatados para roteirização:', pointsForRouting);
      
      // Inicia o processo de otimização
      const startOptimization = async () => {
        try {
          setLoading(true);
          const optimizationData = {
            points: pointsForRouting,
            // Adicione outros parâmetros necessários para a otimização
          };
          
          const result = await routeService.generateAsync(optimizationData, (progress) => {
            console.log('Progresso da otimização:', progress);
            setOptimizationStatus(progress);
          });
          
          console.log('Otimização concluída:', result);
          setOptimizationStatus({
            status: 'completed',
            result: result
          });
          setRoutes(result.routes || []);
          
          // Atualiza a URL para remover o estado de navegação
          navigate(location.pathname, { replace: true });
          
        } catch (error) {
          console.error('Erro ao otimizar rotas:', error);
          setToastMessage('Erro ao otimizar rotas. Tente novamente.');
          setShowToast(true);
        } finally {
          setLoading(false);
        }
      };
      
      startOptimization();
      return;
    }
    
    // Verifica se há dados de rota otimizada no estado de navegação
    if (location.state?.optimizedRoute) {
      console.log('Usando rota otimizada do estado de navegação:', location.state.optimizedRoute);
      setOptimizationStatus({
        status: 'completed',
        result: location.state.optimizedRoute
      });
      setRoutes(location.state.optimizedRoute.routes || []);
      
      // Atualiza a URL para remover o estado de navegação
      navigate(location.pathname, { replace: true });
      setLoading(false);
      return;
    }

    // Se tiver um ID de requisição na URL, busca o status
    const searchParams = new URLSearchParams(location.search);
    const requestId = searchParams.get('request_id');
    
    if (requestId) {
      const fetchStatus = async () => {
        try {
          setLoading(true);
          const status = await routeService.getOptimizationStatus(requestId);
          setOptimizationStatus(status);
          if (status.status === 'completed' && status.result) {
            setRoutes(status.result.routes || []);
          }
        } catch (err) {
          console.error('Erro ao buscar status da otimização:', err);
          setError('Erro ao carregar o status da otimização. Tente novamente mais tarde.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [location.state, location.search]);

  // Funções auxiliares
  const formatDistance = (meters) => {
    if (!meters && meters !== 0) return '0m';
    if (meters < 1000) return `${Math.round(meters)}m`;
    if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters / 1000)} km`;
  };

  const getRouteColor = (index) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f1c40f', '#e74c3c'];
    return colors[index % colors.length];
  };

  // Calcular os limites do mapa baseado nas rotas
  const calculateMapBounds = useCallback((routes) => {
    if (!routes || routes.length === 0) return null;
    
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let hasValidPoints = false;
    
    routes.forEach(route => {
      if (!route.stops) return;
      
      route.stops.forEach(stop => {
        if (stop && stop.lat !== undefined && stop.lng !== undefined && 
            !isNaN(parseFloat(stop.lat)) && !isNaN(parseFloat(stop.lng)) &&
            Math.abs(stop.lat) <= 90 && Math.abs(stop.lng) <= 180) {
          
          const lat = parseFloat(stop.lat);
          const lng = parseFloat(stop.lng);
          
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          
          hasValidPoints = true;
        }
      });
    });
    
    if (!hasValidPoints) return null;
    
    return {
      _southWest: L.latLng(minLat, minLng),
      _northEast: L.latLng(maxLat, maxLng)
    };
  }, []);

  // Calcular o centro do mapa
  const mapCenter = useMemo(() => {
    if (!routes || routes.length === 0) return [-23.5505, -46.6333]; // Centro de SP como fallback
    
    const bounds = calculateMapBounds(routes);
    if (!bounds) return [-23.5505, -46.6333];
    
    return [
      (bounds._southWest.lat + bounds._northEast.lat) / 2,
      (bounds._southWest.lng + bounds._northEast.lng) / 2
    ];
  }, [routes, calculateMapBounds]);

  // Obter os limites do mapa no formato correto para o Leaflet
  const mapBounds = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    return calculateMapBounds(routes);
  }, [routes, calculateMapBounds]);

  // Prepara as rotas para o RouteMap
  const processedPolylines = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    
    return routes.map((route, index) => {
      // Filtra pontos inválidos e mapeia para o formato [lat, lng]
      const positions = (route.stops || [])
        .filter(stop => {
          const isValid = stop && 
                       stop.lat !== undefined && 
                       stop.lng !== undefined &&
                       !isNaN(parseFloat(stop.lat)) && 
                       !isNaN(parseFloat(stop.lng)) &&
                       Math.abs(stop.lat) <= 90 && 
                       Math.abs(stop.lng) <= 180;
          
          if (!isValid) {
            console.warn('Ponto de rota inválido ignorado:', stop);
          }
          
          return isValid;
        })
        .map(stop => [parseFloat(stop.lat), parseFloat(stop.lng)]);
      
      return {
        positions,
        color: getRouteColor(index),
        routeId: route.id,
        routeName: route.vehicle || `Rota ${index + 1}`
      };
    });
  }, [routes]);
  
  // Atualiza as polilinhas do mapa quando as rotas mudam
  useEffect(() => {
    setMapPolylines(processedPolylines);
  }, [processedPolylines]);

  // Filtra os pontos ativos com base no termo de busca
  const filteredActivePoints = useMemo(() => {
    if (!searchTerm) return activePoints;
    
    const term = searchTerm.toLowerCase();
    return activePoints.filter(point => 
      (point.name && point.name.toLowerCase().includes(term)) ||
      (point.address && point.address.toLowerCase().includes(term)) ||
      (point.neighborhood && point.neighborhood.toLowerCase().includes(term)) ||
      (point.city && point.city.toLowerCase().includes(term))
    );
  }, [activePoints, searchTerm]);

  // Renderização de loading
  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando rotas...</span>
        </Spinner>
        <p className="mt-2">Carregando rotas...</p>
      </div>
    );
  }


  // Renderização de erro
  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Erro ao carregar rotas</Alert.Heading>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline-danger">
          Tentar novamente
        </Button>
      </Alert>
    );
  }

  return (
    <div>
      {/* Toast para notificações */}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
        <Toast 
          onClose={() => setShowToast(false)} 
          show={showToast} 
          delay={5000} 
          autohide
          bg="info"
        >
          <Toast.Header closeButton>
            <strong className="me-auto">Roteirização</strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            {toastMessage}
            <div className="mt-2 pt-2 border-top">
              <Button 
                variant="outline-light" 
                size="sm" 
                onClick={() => {
                  // Lógica para iniciar a roteirização
                  setShowToast(false);
                }}
              >
                Iniciar Roteirização
              </Button>
            </div>
          </Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Cabeçalho */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <FaRoute className="me-2" />
          Rotas de Coleta
          {location.state?.selectedDate && (
            <span className="ms-3 text-muted" style={{ fontSize: '0.8rem' }}>
              <FaCalendarAlt className="me-1" />
              {new Date(location.state.selectedDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </span>
          )}
        </h2>
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center me-2">
            <div className="form-check form-switch mb-0 me-2">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="togglePoints"
                checked={showActivePoints}
                onChange={(e) => setShowActivePoints(e.target.checked)}
                style={{ width: '2.5em', height: '1.5em' }}
              />
            </div>
            <label className="form-check-label fw-medium" htmlFor="togglePoints">
              {showActivePoints ? 'Ocultar Pontos' : 'Mostrar Pontos'}
            </label>
            {loadingPoints && (
              <Spinner animation="border" size="sm" className="ms-2" />
            )}
          </div>
          
          <Button variant="primary">
            <FaPlus className="me-1" /> Nova Rota
          </Button>
        </div>
      </div>

      {/* Barra de pesquisa e contador de pontos */}
      {showActivePoints && (
        <Card className="mb-3">
          <Card.Body className="p-3">
            <Row className="align-items-center">
              <Col xs={12} md={8}>
                <InputGroup>
                  <InputGroup.Text className="bg-white">
                    <FaSearch className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por nome, endereço, bairro ou cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={loadingPoints}
                  />
                  <Button 
                    variant="outline-secondary" 
                    disabled={loadingPoints}
                    onClick={() => loadActivePoints()}
                    title="Atualizar pontos"
                  >
                    <FaFilter className="me-1" />
                    Filtrar
                  </Button>
                </InputGroup>
              </Col>
              
              <Col xs={12} md={4} className="mt-2 mt-md-0">
                <div className="d-flex justify-content-md-end">
                  <Badge bg="success" className="px-3 py-2 d-flex align-items-center">
                    {loadingPoints ? (
                      <Spinner animation="border" size="sm" className="me-2" />
                    ) : (
                      <>
                        <FaMapMarkerAlt className="me-1" />
                        {filteredActivePoints.length} {filteredActivePoints.length === 1 ? 'ponto ativo' : 'pontos ativos'}
                      </>
                    )}
                  </Badge>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Mapa */}
      <div className="mb-4" style={{ 
        height: '600px',
        width: '100%',
        position: 'relative',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #dee2e6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {loading ? (
          <div className="text-center p-4">
            <Spinner animation="border" variant="primary" className="mb-3" />
            <p>Carregando mapa...</p>
          </div>
        ) : (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%'
          }}>
            {filteredActivePoints.length === 0 && processedPolylines.length === 0 ? (
              <div className="text-center p-4" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: '#f8f9fa'
              }}>
                <FaMapMarkedAlt size={48} className="text-muted mb-3" />
                <h5>Nenhum dado para exibir</h5>
                <p className="text-muted">Nenhum ponto ou rota encontrado. Tente ajustar os filtros.</p>
                <Button 
                  variant="outline-primary" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  <FaSync className="me-2" /> Recarregar
                </Button>
              </div>
            ) : (
              <RouteMap 
                key={`map-${filteredActivePoints.length}-${processedPolylines.length}`}
                markers={[...filteredActivePoints, ...processedMarkers]}
                polylines={processedPolylines}
                center={center}
                zoom={12}
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  minHeight: '400px'
                }}
                onMapLoad={(mapInstance) => {
                  console.log('Mapa carregado com sucesso');
                  setMap(mapInstance);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Abas */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        
        <Tab eventKey="list" title={`Lista de Rotas (${routes.length})`}>
          <div className="row mt-3">
            <div className="col-md-4">
              <ListGroup className="mb-4">
                {routes.map((route, index) => (
                  <ListGroup.Item 
                    key={route.id || index}
                    action
                    active={selectedRoute?.id === route.id}
                    onClick={() => setSelectedRoute(route)}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="ms-2 me-auto">
                      <div className="fw-bold">{route.vehicle || `Rota ${index + 1}`}</div>
                      {route.stops?.length > 0 && (
                        <small>
                          {route.stops.length - 1} paradas • {formatDistance(route.distance || 0)}
                        </small>
                      )}
                    </div>
                    <Badge bg={getRouteColor(index)} pill>
                      {index + 1}
                    </Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
            
            <div className="col-md-8">
              {selectedRoute ? (
                <Card>
                  <Card.Header 
                    className="d-flex justify-content-between align-items-center" 
                    style={{ 
                      backgroundColor: getRouteColor(
                        routes.findIndex(r => r.id === selectedRoute.id)
                      ), 
                      color: 'white' 
                    }}
                  >
                    <div>
                      <FaTruck className="me-2" />
                      {selectedRoute.vehicle || 'Rota'}
                    </div>
                    <div>
                      <Badge bg="light" text="dark" className="me-2">
                        {formatDistance(selectedRoute.distance || 0)}
                      </Badge>
                      <Badge bg="light" text="dark">
                        {selectedRoute.stops?.length - 1 || 0} paradas
                      </Badge>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <ListGroup variant="flush">
                      {selectedRoute.stops?.map((stop, idx) => (
                        <ListGroup.Item key={idx}>
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">
                              {stop.name || (idx === 0 ? 'Depósito' : `Parada ${idx}`)}
                            </h6>
                            <small>{stop.time || ''}</small>
                          </div>
                          <p className="mb-1">{stop.address || ''}</p>
                          <small className="text-muted">
                            {stop.city} {stop.state ? `- ${stop.state}` : ''}
                          </small>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Card.Body>
                </Card>
              ) : (
                <Alert variant="info">
                  Selecione uma rota para ver os detalhes
                </Alert>
              )}
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};

export default RoutesPage;
