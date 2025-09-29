import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import collectionPointService from '../services/collectionPointService';

// Corrige o problema dos ícones do Leaflet
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  });
}

// Ícone personalizado para os marcadores
const createCustomIcon = (color = '#6c757d') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
      ">
        <svg viewBox="0 0 24 24" width="32" height="32" style="
          position: absolute;
          top: 0;
          left: 0;
          fill: ${color};
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <div style="
          position: absolute;
          top: 6px;
          left: 6px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: ${color};
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// Estilo para o popup
const popupStyle = {
  maxWidth: '380px',
  minWidth: '320px',
  padding: '0',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
};

// Estilo para o container do popup
const popupContainerStyle = {
  maxHeight: '70vh',
  overflowY: 'auto',
  padding: '4px 0',
  cursor: 'default',
  '&::-webkit-scrollbar': {
    width: '6px'
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
    borderRadius: '10px'
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#888',
    borderRadius: '10px',
    '&:hover': {
      background: '#555'
    }
  }
};



// Estilo para os marcadores
const markerStyle = {
  cursor: 'pointer'
};

// Estilo para o título do popup
const popupTitleStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '12px',
  padding: '12px 16px',
  background: '#f8f9fa',
  borderBottom: '1px solid #e9ecef'
};

// Estilo para os itens do popup
const popupItemStyle = {
  margin: '8px 0',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'flex-start',
  lineHeight: '1.4'
};

// Estilo para os ícones dos itens
const popupIconStyle = {
  marginRight: '10px',
  color: '#6c757d',
  minWidth: '18px',
  textAlign: 'center',
  marginTop: '2px'
};

// Estilo para o container de notas
const notesStyle = {
  marginTop: '12px',
  padding: '10px',
  backgroundColor: '#f8f9fa',
  borderRadius: '6px',
  borderLeft: '3px solid #6c757d',
  fontSize: '13px',
  color: '#495057',
  fontStyle: 'italic'
};

// Estilo para as seções do popup
const popupSectionStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid #f1f3f5'
};

// Estilo para os títulos das seções do popup
const popupSectionTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#495057',
  marginBottom: '8px',
  fontWeight: '600',
  fontSize: '14px'
};

// Estilo para o rodapé do popup
const popupFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 16px',
  background: '#f8f9fa',
  fontSize: '12px',
  color: '#6c757d'
};

// Função para verificar se um ponto está ativo hoje
const isPointActiveToday = (point) => {
  if (!point.collection_days) return false;
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  // Mapeia os dias da semana para os valores possíveis em collection_days
  const dayMap = {
    0: ['dom', 'domingo'],
    1: ['seg', 'segunda', 'segunda-feira'],
    2: ['ter', 'terca', 'terça', 'terca-feira', 'terça-feira'],
    3: ['qua', 'quarta', 'quarta-feira'],
    4: ['qui', 'quinta', 'quinta-feira'],
    5: ['sex', 'sexta', 'sexta-feira'],
    6: ['sab', 'sáb', 'sabado', 'sábado']
  };
  
  // Verifica se algum dos dias da semana do ponto corresponde ao dia de hoje
  const todayKeywords = dayMap[dayOfWeek] || [];
  const days = String(point.collection_days).toLowerCase().split(/[,\s]+/);
  
  return todayKeywords.some(keyword => days.includes(keyword));
};

const CollectionPointsMap = () => {
  const [points, setPoints] = useState([]);
  const [activePointIds, setActivePointIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([-23.5505, -46.6333]); // Centro em São Paulo por padrão
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = useRef(null);
  const boundsRef = useRef(null);

  // Efeito para adicionar estilos globais dos marcadores
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-marker-icon {
          transition: transform 0.2s ease;
        }
        .leaflet-marker-icon:hover {
          transform: scale(1.2);
          z-index: 1000 !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        setLoading(true);
        // Busca apenas pontos ativos com compatibilidade para retornar array simples
        const response = await collectionPointService.getAll({ 
          is_active: true,
          compatibilidade: true // Garante que retorne um array simples
        });
        
        // Garante que temos um array para trabalhar
        const data = Array.isArray(response) ? response : (response.items || []);
        
        // Filtra pontos com coordenadas válidas e converte para número
        const validPoints = data
          .filter(point => point && point.latitude && point.longitude)
          .map(point => ({
            ...point,
            lat: parseFloat(point.latitude),
            lng: parseFloat(point.longitude)
          }))
          .filter(point => !isNaN(point.lat) && !isNaN(point.lng));
        
        // Identifica quais pontos estão ativos hoje
        const todayActiveIds = new Set();
        const activePoints = [];
        
        validPoints.forEach(point => {
          if (isPointActiveToday(point)) {
            todayActiveIds.add(point.id);
            activePoints.push(point);
          }
        });
        
        console.log('Pontos de coleta válidos:', validPoints);
        console.log('Pontos ativos hoje:', todayActiveIds);
        
        setPoints(validPoints);
        setActivePointIds(todayActiveIds);
        
        // Ajusta o zoom para mostrar os pontos ativos, ou todos se não houver ativos
        const pointsToShow = activePoints.length > 0 ? activePoints : validPoints;
        
        if (pointsToShow.length > 0) {
          const bounds = L.latLngBounds(
            pointsToShow.map(point => [point.lat, point.lng])
          );
          
          // Atualiza a referência dos bounds para uso posterior
          boundsRef.current = bounds;
          
          // Calcula o centro dos pontos ativos
          const center = bounds.getCenter();
          setMapCenter([center.lat, center.lng]);
          
          // Ajusta o zoom baseado na área coberta pelos pontos
          const area = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
          const zoom = area > 5000 ? 12 : 15; // Zoom menor para áreas maiores
          setMapZoom(zoom);
          
          console.log('Centro do mapa:', center);
          console.log('Zoom calculado:', zoom);
        }
      } catch (err) {
        console.error('Erro ao carregar pontos de coleta:', err);
        setError('Erro ao carregar os pontos de coleta. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <span className="ms-2">Carregando pontos de coleta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-3" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div style={{ 
      height: '80vh', 
      width: '100%', 
      borderRadius: '8px', 
      overflow: 'hidden',
      boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)'
    }}>
      <MapContainer 
        key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
        whenCreated={mapInstance => {
          mapRef.current = mapInstance;
          
          // Ajusta a visualização para os bounds quando o mapa for criado
          if (boundsRef.current) {
            mapInstance.fitBounds(boundsRef.current, {
              padding: [50, 50],
              maxZoom: 15
            });
          }
          
          // Força a atualização do tamanho do mapa após a criação
          setTimeout(() => {
            mapInstance.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {points.map((point, index) => {
          const isActive = activePointIds.has(point.id);
          return (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={createCustomIcon(isActive ? '#28a745' : '#6c757d')}
              eventHandlers={{
                mouseover: (e) => {
                  e.target.openPopup();
                },
                mouseout: (e) => {
                  // Fecha o popup quando o mouse sai do marcador
                  setTimeout(() => {
                    const popup = e.target.getPopup();
                    if (popup && popup.isOpen()) {
                      e.target.closePopup();
                    }
                  }, 300);
                },
                click: (e) => {
                  e.target.openPopup();
                }
              }}
              style={markerStyle}
            >
              <Popup 
                closeButton={true}
                closeOnClick={false}
                autoClose={false}
                closeOnEscapeKey={true}
                style={popupStyle}
                className="custom-popup"
              >
                <div style={popupContainerStyle}>
                  <div style={popupTitleStyle}>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      {point.external_id || 'Sem ID'}
                    </div>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px', 
                      color: '#212529',
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}>
                      {point.name || 'Ponto de Coleta'}
                    </div>
                    {isActive && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        background: '#d4edda',
                        color: '#155724',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '500',
                        width: 'fit-content',
                        marginTop: '4px'
                      }}>
                        <span>●</span> Coleta Hoje
                      </div>
                    )}
                  </div>
                  
                  <div style={popupSectionStyle}>
                    <div style={popupSectionTitleStyle}>
                      <span>📍</span>
                      <span>Endereço</span>
                    </div>
                    <div style={{ lineHeight: '1.5' }}>
                      {point.address && <div>{point.address}</div>}
                      {point.address_complement && <div>{point.address_complement}</div>}
                      {point.neighborhood && <div>Bairro: {point.neighborhood}</div>}
                      {(point.city || point.state || point.zip_code) && (
                        <div>
                          {point.city && <span>{point.city}</span>}
                          {point.state && <span>{point.city ? ', ' : ''}{point.state}</span>}
                          {point.zip_code && <span>{point.city || point.state ? ' - ' : ''}{point.zip_code}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={popupSectionStyle}>
                    <div style={popupSectionTitleStyle}>
                      <span>📅</span>
                      <span>Coleta</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {point.days_of_week && (
                        <div>
                          <span style={{ fontWeight: '500' }}>Dias: </span>
                          {(() => {
                            const daysMap = {
                              '1': 'Seg',
                              '2': 'Ter',
                              '3': 'Qua',
                              '4': 'Qui',
                              '5': 'Sex',
                              '6': 'Sáb',
                              '7': 'Dom'
                            };
                            return point.days_of_week.split(',').map(d => daysMap[d.trim()] || d.trim()).join(', ');
                          })()}
                        </div>
                      )}
                      {point.weeks_of_month && (
                        <div>
                          <span style={{ fontWeight: '500' }}>Semanas: </span>
                          {point.weeks_of_month.split(',').map(w => `${w.trim()}ª`).join(', ')} semana do mês
                        </div>
                      )}
                      {point.frequency && (
                        <div><span style={{ fontWeight: '500' }}>Frequência: </span>{point.frequency}</div>
                      )}
                      {point.collection_time && (
                        <div><span style={{ fontWeight: '500' }}>Horário: </span>{point.collection_time}</div>
                      )}
                      {point.collection_instructions && (
                        <div><span style={{ fontWeight: '500' }}>Instruções: </span>{point.collection_instructions}</div>
                      )}
                    </div>
                  </div>

                  {(point.operating_hours || point.business_hours) && (
                    <div style={popupSectionStyle}>
                      <div style={popupSectionTitleStyle}>
                        <span>🏪</span>
                        <span>Horário de Funcionamento</span>
                      </div>
                      <div>{point.operating_hours || point.business_hours}</div>
                    </div>
                  )}

                  <div style={popupFooterStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: point.is_active !== false ? '#155724' : '#6c757d',
                        fontWeight: '500'
                      }}>
                        <span>●</span> {point.is_active !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>📅</span> {point.created_at ? new Date(point.created_at).toLocaleDateString('pt-BR') : 'Data não disponível'}
                      </span>
                    </div>
                  </div>

                  {(point.notes || point.observations || point.additional_info) && (
                    <div style={{
                      padding: '12px 16px',
                      background: '#f8f9fa',
                      borderTop: '1px solid #e9ecef',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#495057' }}>Observações</div>
                      <div style={{ color: '#6c757d' }}>{point.notes || point.observations || point.additional_info}</div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default CollectionPointsMap;
