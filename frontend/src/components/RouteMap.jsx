import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { FaTruck, FaMapMarkerAlt, FaRoute, FaInfoCircle, FaBox, FaWeightHanging, FaRuler, FaHome, FaExternalLinkAlt, FaMapMarkedAlt, FaBoxes, FaStar, FaWarehouse } from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';

// Corrige o problema dos ícones do Leaflet
const fixLeafletIcons = () => {
  if (typeof window === 'undefined') return;
  
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
};

// Adiciona estilos globais para o mapa
const addGlobalStyles = () => {
  if (typeof document === 'undefined') return;
  
  const styleId = 'leaflet-map-styles';
  
  // Remove estilos existentes para evitar duplicação
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .leaflet-container {
      width: 100% !important;
      height: 100% !important;
      min-height: 400px;
      background-color: #f8f9fa;
    }
  `;
  
  document.head.appendChild(style);
};

// Inicializa os estilos e ícones
if (typeof window !== 'undefined') {
  fixLeafletIcons();
  addGlobalStyles();
}

// Cria o ícone padrão
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

// Define o ícone padrão globalmente
L.Marker.prototype.options.icon = DefaultIcon;

// Função para criar um marcador personalizado com base nas configurações
const createCustomIcon = (config) => {
  if (!config) return null;
  
  const size = config.size || 25;
  const color = config.color || '#3388ff';
  const sequence = config.sequence || '';
  const title = config.title || ''; // Título para o tooltip
  
  // Cria um elemento HTML personalizado para o ícone
  const div = document.createElement('div');
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  div.style.borderRadius = config.icon === 'circle' ? '50%' : '0';
  div.style.backgroundColor = color;
  div.style.display = 'flex';
  div.style.justifyContent = 'center';
  div.style.alignItems = 'center';
  div.style.color = 'white';
  div.style.fontSize = `${size * 0.6}px`;
  div.style.position = 'relative';
  div.style.border = '2px solid white';
  div.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
  
  // Adiciona um ícone SVG com base no tipo
  if (config.icon === 'truck') {
    div.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-9H17V12h4.46L19.5 9.5zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM20 8l3 4v5h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1V6c0-1.11.89-2 2-2h14v4h3z"/></svg>`;
  } else if (config.icon === 'trash') {
    div.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
  } else if (config.icon === 'home') {
    div.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
  } else if (config.icon === 'warehouse') {
    div.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M22 21V7L12 3 2 7v14h5v-9h10v9h5zm-11-2H9v2h2v-2zm2-3h-2v2h2v-2zm2 3h-2v2h2v-2z"/></svg>`;
  }
  
  // Adiciona número de sequência se fornecido
  if (sequence) {
    const seqDiv = document.createElement('div');
    seqDiv.textContent = sequence;
    seqDiv.style.position = 'absolute';
    seqDiv.style.top = '-8px';
    seqDiv.style.right = '-8px';
    seqDiv.style.backgroundColor = '#ff6b6b';
    seqDiv.style.color = 'white';
    seqDiv.style.borderRadius = '50%';
    seqDiv.style.width = '18px';
    seqDiv.style.height = '18px';
    seqDiv.style.display = 'flex';
    seqDiv.style.justifyContent = 'center';
    seqDiv.style.alignItems = 'center';
    seqDiv.style.fontSize = '10px';
    seqDiv.style.fontWeight = 'bold';
    seqDiv.style.border = '2px solid white';
    seqDiv.style.zIndex = '1000';
    div.appendChild(seqDiv);
  }
  
  // Adiciona título para o tooltip
  if (title) {
    div.setAttribute('title', title);
  }
  
  return L.divIcon({
    html: div.outerHTML,
    className: 'custom-div-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Função para obter rota do OSRM
async function getRoute(coordinates) {
  try {
    // Formata as coordenadas para o formato do OSRM
    const coords = coordinates.map(coord => `${coord[1]},${coord[0]}`).join(';');
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    
    const data = await response.json();
    
    if (data.routes && data.routes[0]) {
      return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
    }
    return [];
  } catch (error) {
    console.error('Erro ao obter rota:', error);
    return [];
  }
}

const RouteMap = ({
  center = [-23.5505, -46.6333],
  zoom = 14,
  bounds = null,
  markers = [],
  polylines = [],
  height = '500px',
  className = '',
  onMapLoad = null,
  style = {},
}) => {
  // Estado para controlar a instância do mapa e o estado de carregamento
  const [map, setMap] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const routesRef = useRef([]);
  const prevMarkersRef = useRef(markers);
  const prevPolylinesRef = useRef(polylines);
  const prevBoundsRef = useRef(bounds);
  
  // Efeito para gerenciar o carregamento e a inicialização do mapa
  useEffect(() => {
    console.log('Iniciando efeito de montagem do mapa...');
    
    // Verifica se estamos no navegador
    if (typeof window === 'undefined') {
      console.log('Navegador não detectado, saindo...');
      return;
    }
    
    // Verifica se o Leaflet está disponível
    if (typeof L === 'undefined') {
      console.error('Leaflet não está disponível!');
      setIsLoading(false);
      return;
    }
    
    console.log('Leaflet carregado com sucesso:', L.version);
    
    // Define o estado de carregamento como verdadeiro
    setIsLoading(true);
    
    // Força a remontagem do mapa apenas uma vez na montagem
    const timer = setTimeout(() => {
      console.log('Incrementando chave do mapa para forçar remontagem...');
      setMapKey(prevKey => prevKey + 1);
    }, 300); // Aumentado o tempo para garantir que tudo esteja carregado
    
    // Limpa o timer quando o componente for desmontado
    return () => {
      console.log('Limpando timer de montagem do mapa...');
      clearTimeout(timer);
    };
  }, []); // Executa apenas na montagem
  
  // Função para ajustar o mapa aos limites dos marcadores e rotas
  const fitMapToBounds = useCallback(() => {
    if (!map) return;
    
    const bounds = new L.LatLngBounds();
    let hasBounds = false;
    
    // Adiciona os marcadores aos limites
    markers.forEach(marker => {
      bounds.extend([marker.lat, marker.lng]);
      hasBounds = true;
    });
    
    // Adiciona as rotas aos limites
    if (polylines && polylines.length > 0) {
      polylines.forEach(polyline => {
        if (polyline.positions && Array.isArray(polyline.positions)) {
          polyline.positions.forEach(position => {
            if (Array.isArray(position[0])) {
              position.forEach(coord => {
                bounds.extend([coord[0], coord[1]]);
                hasBounds = true;
              });
            } else {
              bounds.extend([position[0], position[1]]);
              hasBounds = true;
            }
          });
        }
      });
    }
    
    // Se houver limites definidos, ajusta a visualização
    if (hasBounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, markers, polylines]);
  
  // Efeito para marcar o carregamento como concluído quando o mapa for criado
  useEffect(() => {
    if (!map) {
      console.log('Aguardando instância do mapa...');
      return;
    }
    
    console.log('Mapa criado com sucesso, ajustando visualização...');
    
    const handleResize = () => {
      console.log('Iniciando redimensionamento do mapa...');
      try {
        if (!map || !map.invalidateSize) {
          console.warn('Mapa ou método invalidateSize não disponível');
          return;
        }
        
        console.log('Chamando invalidateSize...');
        map.invalidateSize(false); // false para não animar o redimensionamento
        
        console.log('Ajustando visualização após redimensionamento...');
        // Força um pequeno atraso para garantir que o redimensionamento foi aplicado
        const adjustTimer = setTimeout(() => {
          try {
            console.log('Ajustando limites do mapa...');
            fitMapToBounds();
          } catch (error) {
            console.error('Erro ao ajustar limites do mapa:', error);
          }
        }, 100);
        
        return () => clearTimeout(adjustTimer);
      } catch (error) {
        console.error('Erro durante o redimensionamento do mapa:', error);
      }
    };
    
    // Ajusta o tamanho e os limites iniciais
    console.log('Iniciando ajuste inicial do mapa...');
    const timer = setTimeout(() => {
      try {
        console.log('Executando ajuste inicial...');
        handleResize();
        
        // Força um segundo ajuste após um pequeno atraso para garantir que tudo esteja estável
        const secondAdjustTimer = setTimeout(() => {
          console.log('Executando segundo ajuste...');
          handleResize();
          
          // Marca como carregado
          setIsLoading(false);
          if (onMapLoad) {
            console.log('Chamando onMapLoad...');
            onMapLoad(map);
          }
        }, 500);
        
        return () => clearTimeout(secondAdjustTimer);
      } catch (error) {
        console.error('Erro durante o ajuste inicial do mapa:', error);
        setIsLoading(false);
      }
    }, 500);
    
    // Adiciona listener para redimensionamento
    console.log('Adicionando listener de redimensionamento...');
    window.addEventListener('resize', handleResize);
    
    return () => {
      console.log('Limpando recursos do mapa...');
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      
      // Limpa a referência do mapa
      if (map && map.remove) {
        console.log('Removendo instância do mapa...');
        try {
          map.remove();
        } catch (e) {
          console.error('Erro ao remover o mapa:', e);
        }
      }
    };
  }, [map, fitMapToBounds, onMapLoad]);
  
  // Efeito para ajustar o mapa quando os marcadores ou rotas mudarem
  useEffect(() => {
    if (!map) return;
    
    // Verifica se houve mudanças reais nos marcadores ou polylines
    const markersChanged = JSON.stringify(prevMarkersRef.current) !== JSON.stringify(markers);
    const polylinesChanged = JSON.stringify(prevPolylinesRef.current) !== JSON.stringify(polylines);
    
    if (markersChanged || polylinesChanged) {
      prevMarkersRef.current = markers;
      prevPolylinesRef.current = polylines;
      
      // Aguarda um pouco para garantir que o DOM foi atualizado
      const timer = setTimeout(() => {
        fitMapToBounds();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [map, markers, polylines, fitMapToBounds]);

  // Efeito para ajustar o zoom quando os bounds mudarem
  useEffect(() => {
    if (!map || !bounds) return;
    
    // Verifica se os bounds realmente mudaram
    const boundsChanged = JSON.stringify(prevBoundsRef.current) !== JSON.stringify(bounds);
    if (!boundsChanged) return;
    
    prevBoundsRef.current = bounds;
    
    // Adiciona um pequeno atraso para garantir que o mapa esteja pronto
    // Adiciona um pequeno atraso para garantir que o mapa esteja pronto
    const timer = setTimeout(() => {
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 15 // Limita o zoom máximo para evitar que o mapa fique muito distante
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [bounds, map]);

  // Efeito para calcular as rotas quando os polylines mudarem
  useEffect(() => {
    if (!map || !polylines || polylines.length === 0) {
      // Se não há polylines, limpa as rotas
      if (routesRef.current.length > 0) {
        routesRef.current = [];
        setRoutes([]);
      }
      return;
    }
    
    // Verifica se os polylines realmente mudaram
    const polylinesChanged = JSON.stringify(prevPolylinesRef.current) !== JSON.stringify(polylines);
    if (!polylinesChanged) return;
    
    prevPolylinesRef.current = polylines;
    
    // Função para processar uma rota assíncronamente
    const processRoute = async (polyline, index) => {
      try {
        if (polyline.positions && polyline.positions.length > 0) {
          // Se já temos as posições, apenas formata para o formato esperado
          return {
            route: polyline.positions,
            color: polyline.color || '#3388ff',
            weight: polyline.weight || 4,
            opacity: polyline.opacity || 0.7
          };
        } else if (polyline.coordinates && polyline.coordinates.length >= 2) {
          // Se temos coordenadas, calculamos a rota
          const route = await getRoute(polyline.coordinates);
          return {
            route,
            color: polyline.color || '#3388ff',
            weight: polyline.weight || 4,
            opacity: polyline.opacity || 0.7
          };
        }
        return null;
      } catch (error) {
        console.error('Erro ao processar rota:', error);
        return null;
      }
    };
    
    // Processa todas as rotas em paralelo
    const processAllRoutes = async () => {
      try {
        const routePromises = polylines.map((polyline, index) => processRoute(polyline, index));
        const newRoutes = (await Promise.all(routePromises)).filter(route => route !== null);
        
        // Atualiza as rotas apenas se houver mudanças
        if (JSON.stringify(routesRef.current) !== JSON.stringify(newRoutes)) {
          routesRef.current = newRoutes;
          setRoutes(newRoutes);
          
          // Ajusta o zoom para mostrar todas as rotas
          if (newRoutes.length > 0) {
            const adjustTimer = setTimeout(() => {
              fitMapToBounds();
            }, 200);
            return () => clearTimeout(adjustTimer);
          }
        }
      } catch (error) {
        console.error('Erro ao processar rotas:', error);
      }
    };
    
    processAllRoutes();
  }, [map, polylines, fitMapToBounds]);

  // Se não estiver no cliente, retorna um contêiner vazio com a mesma altura
  if (typeof window === 'undefined') {
    return (
      <div style={{ 
        height: '600px', 
        width: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }} />
    );
  }
  
  // Estilos inline para o contêiner do mapa
  const containerStyle = {
    height: style?.height || '600px', // Usa a altura do estilo fornecido ou 600px como padrão
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    ...style
  };

  // Estilos inline para o container do mapa
  const mapContainerStyle = {
    width: '100%',
    height: '100%',
    minHeight: '400px',
    backgroundColor: '#f8f9fa',
    margin: 0,
    padding: 0,
    position: 'relative',
    zIndex: 1,
    ...(style || {}) // Inclui quaisquer estilos adicionais passados como props
  };

  // Se estiver carregando, mostra um indicador de carregamento
  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%'
        }}>
          <div className="text-center p-4">
            <div className="spinner-border text-primary mb-2" role="status">
              <span className="visually-hidden">Carregando...</span>
            </div>
            <p className="mb-0">Carregando mapa...</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('Renderizando mapa - key:', mapKey);
  
  return (
    <div style={containerStyle} className={className}>
      <MapContainer 
        key={`map-${mapKey}`} // Usando a chave para forçar a remontagem
        center={center} 
        zoom={zoom} 
        style={mapContainerStyle}
        scrollWheelZoom={true}
        whenCreated={(mapInstance) => {
          console.log('Mapa criado com sucesso');
          setMap(mapInstance);
          if (onMapLoad) onMapLoad(mapInstance);
          
          // Força o redimensionamento após um pequeno atraso
          setTimeout(() => {
            console.log('Forçando redimensionamento após criação do mapa');
            mapInstance.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {markers.map((marker, index) => {
          // Cria um ícone personalizado com base nas configurações do marcador
          const customIcon = marker.markerConfig 
            ? createCustomIcon({
                ...marker.markerConfig,
                sequence: marker.sequence,
                title: marker.popup?.title || ''
              }) 
            : DefaultIcon;
          
          return (
            <Marker 
              key={`marker-${index}`} 
              position={[marker.lat, marker.lng]}
              icon={customIcon}
              eventHandlers={{
                click: () => {
                  if (marker.popup?.title && marker.popup.title !== 'Depósito') {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`;
                    window.open(url, '_blank');
                  }
                }
              }}
            >
              {marker.popup && (
                <Popup>
                  <div style={{ minWidth: '260px' }}>
                    {/* Cabeçalho com nome do ponto */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0 fw-bold text-primary">{marker.popup.title || 'Ponto de Coleta'}</h6>
                      <div className="d-flex gap-1">
                        {marker.markerConfig?.type === 'depot' && <FaHome className="text-primary" title="Depósito" />}
                        {marker.markerConfig?.type === 'delivery' && <FaTruck className="text-success" title="Entrega" />}
                        {marker.popup.priority && <FaStar className="text-warning" title="Prioritário" />}
                      </div>
                    </div>
                    
                    {/* ID do Ponto */}
                    {marker.popup.id && (
                      <div className="mb-2">
                        <div className="small text-muted">Código:</div>
                        <div><code>{marker.popup.id}</code></div>
                      </div>
                    )}
                    
                    {/* Endereço e Referência */}
                    <div className="mb-2">
                      <div className="small text-muted">Endereço:</div>
                      <div>{marker.popup.address || 'Não informado'}</div>
                      {marker.popup.reference && marker.popup.reference !== 'Sem referência' && (
                        <div className="small text-muted mt-1">Referência: {marker.popup.reference}</div>
                      )}
                    </div>
                    
                    {/* Contato */}
                    {marker.popup.phone && marker.popup.phone !== 'Não informado' && (
                      <div className="mb-2">
                        <div className="small text-muted">Contato:</div>
                        <div>📞 {marker.popup.phone}</div>
                      </div>
                    )}
                    
                    {/* Informações da Parada */}
                    <div className="row g-2 mb-2">
                      {/* Ordem e Quantidade */}
                      <div className="col-6">
                        <div className="small text-muted">Ordem:</div>
                        <div className="d-flex align-items-center gap-1">
                          <span>#{marker.popup.sequence || '--'}</span>
                          {marker.popup.quantity > 1 && (
                            <span className="badge bg-secondary" title="Quantidade de itens">
                              {marker.popup.quantity}x
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Horário de Chegada/Saída */}
                      {(marker.popup.arrival_time || marker.popup.departure_time) && (
                        <div className="col-6">
                          <div className="small text-muted">Horário:</div>
                          <div>
                            {marker.popup.arrival_time || '--'}
                            {marker.popup.departure_time && ` → ${marker.popup.departure_time}`}
                          </div>
                        </div>
                      )}
                      
                      {/* Janela de Tempo */}
                      {marker.popup.time_window && marker.popup.time_window !== 'Não especificada' && (
                        <div className="col-12">
                          <div className="small text-muted">Janela de Atendimento:</div>
                          <div>⏰ {marker.popup.time_window}</div>
                        </div>
                      )}
                      
                      {/* Volume e Peso */}
                      {marker.popup.volume && (
                        <div className="col-6">
                          <div className="small text-muted">Volume:</div>
                          <div>📦 {marker.popup.volume}</div>
                        </div>
                      )}
                      {marker.popup.weight && (
                        <div className="col-6">
                          <div className="small text-muted">Peso:</div>
                          <div>⚖️ {marker.popup.weight}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Observações */}
                    {marker.popup.notes && (
                      <div className="mb-3 p-2 bg-light rounded small">
                        <div className="text-muted mb-1">Observações:</div>
                        <div className="text-break">{marker.popup.notes}</div>
                      </div>
                    )}
                    
                    {/* Botões de navegação */}
                    <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <FaMapMarkedAlt className="me-1" /> Maps
                      </a>
                      <a 
                        href={`https://www.waze.com/ul?ll=${marker.lat},${marker.lng}&navigate=yes`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-success"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <SiWaze className="me-1" /> Waze
                      </a>
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
        
        {routes.map((line, index) => {
          const positions = line.route || line.positions || [];
          const color = line.color || `hsl(${(index * 60) % 360}, 80%, 50%)`;
          const weight = line.weight || 5;
          const opacity = line.opacity || 0.7;
          const dashArray = line.dashArray || null;
          
          // Calcula a distância total da rota
          let totalDistance = 0;
          if (positions.length > 1) {
            for (let i = 1; i < positions.length; i++) {
              totalDistance += L.latLng(positions[i-1]).distanceTo(positions[i]);
            }
          }
          
          // Formata a distância
          const formatDistance = (meters) => {
            if (meters < 1000) return `${Math.round(meters)}m`;
            return `${(meters / 1000).toFixed(1)}km`;
          };
          
          return (
            <Polyline
              key={`line-${index}`}
              positions={positions}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray,
                lineJoin: 'round',
                lineCap: 'round'
              }}
              eventHandlers={{
                mouseover: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    weight: weight + 2,
                    opacity: Math.min(opacity + 0.2, 1)
                  });
                  
                  // Cria um popup flutuante com informações da rota
                  if (!layer.getPopup()) {
                    const popup = L.popup({ 
                      closeButton: false,
                      autoClose: false,
                      closeOnClick: false,
                      className: 'route-popup',
                      offset: [0, 0]
                    });
                    
                    popup.setContent(`
                      <div style="padding: 5px 10px; font-size: 12px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                        <div><strong>Rota ${index + 1}</strong></div>
                        <div>Distância: ${formatDistance(totalDistance)}</div>
                        ${line.vehicle ? `<div>Veículo: ${line.vehicle}</div>` : ''}
                      </div>
                    `);
                    
                    // Posiciona o popup no meio da rota
                    const midPoint = positions[Math.floor(positions.length / 2)];
                    popup.setLatLng(midPoint);
                    layer.bindPopup(popup).openPopup();
                  }
                },
                mouseout: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    weight: weight,
                    opacity: opacity
                  });
                  layer.closePopup();
                }
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default RouteMap;
