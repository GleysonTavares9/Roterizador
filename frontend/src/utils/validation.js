/**
 * Calcula a distância em metros entre duas coordenadas geográficas
 * usando a fórmula de Haversine
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180; // φ, λ em radianos
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // em metros
};

/**
 * Converte um horário no formato HH:MM para minutos desde a meia-noite
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  
  // Verifica se o formato está correto (HH:MM)
  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
    return -1; // Retorna -1 para indicar formato inválido
  }
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Verifica se os valores estão dentro dos limites
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return -1; // Retorna -1 para indicar valores inválidos
  }
  
  return hours * 60 + minutes;
};

/**
 * Formata minutos para o formato HH:MM
 */
const minutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Valida os dados antes de enviar para otimização
 * @param {Object} data - Dados da otimização
 * @returns {{isValid: boolean, errors: string[]}} - Resultado da validação
 */
export const validateOptimizationData = (data) => {
  const errors = [];
  const warnings = [];
  const { points = [], vehicles = [], startPoint } = data;
  const MIN_DISTANCE_BETWEEN_POINTS = 10; // 10 metros

  // Validação de pontos
  if (points.length === 0) {
    errors.push('Nenhum ponto de coleta foi adicionado.');
  } else {
    const invalidPoints = [];
    const pointsWithCoords = [];
    
    // Validação individual de cada ponto
    points.forEach((point, index) => {
      const lat = parseFloat(point.lat);
      const lng = parseFloat(point.lng);
      const weight = parseFloat(point.weight || 0);
      const volume = parseFloat(point.volume || 0);
      
      // Verifica coordenadas
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        invalidPoints.push(`Ponto ${index + 1} (${point.name || 'Sem nome'}) tem coordenadas inválidas.`);
        return;
      }
      
      // Verifica valores numéricos
      if (isNaN(weight) || weight < 0) {
        invalidPoints.push(`Peso inválido no ponto ${index + 1} (${point.name || 'Sem nome'}).`);
      }
      
      if (isNaN(volume) || volume < 0) {
        invalidPoints.push(`Volume inválido no ponto ${index + 1} (${point.name || 'Sem nome'}).`);
      }
      
      // Verifica janela de tempo
      const timeWindowStart = timeToMinutes(point.time_window_start || '00:00');
      const timeWindowEnd = timeToMinutes(point.time_window_end || '23:59');
      
      if (timeWindowStart >= timeWindowEnd) {
        invalidPoints.push(`Janela de tempo inválida no ponto ${index + 1} (${point.name || 'Sem nome'}).`);
      }
      
      pointsWithCoords.push({...point, lat, lng, index});
    });
    
    // Validação de pontos muito próximos foi removida conforme solicitado
    
    if (invalidPoints.length > 0) {
      errors.push(...invalidPoints);
    }
  }

  // Validação de veículos
  if (vehicles.length === 0) {
    errors.push('Nenhum veículo foi selecionado.');
  } else {
    // Verifica capacidade dos veículos
    const invalidVehicles = [];
    
    vehicles.forEach((vehicle, index) => {
      const capacity = parseFloat(vehicle.capacity);
      const maxWeight = parseFloat(vehicle.max_weight || 0);
      const volumeCapacity = parseFloat(vehicle.volume_capacity || 0);
      
      if (isNaN(capacity) || capacity <= 0) {
        invalidVehicles.push(`Capacidade inválida para o veículo ${vehicle.name || `#${index + 1}`}.`);
      }
      
      if (isNaN(maxWeight) || maxWeight < 0) {
        invalidVehicles.push(`Peso máximo inválido para o veículo ${vehicle.name || `#${index + 1}`}.`);
      }
      
      if (isNaN(volumeCapacity) || volumeCapacity < 0) {
        invalidVehicles.push(`Volume máximo inválido para o veículo ${vehicle.name || `#${index + 1}`}.`);
      }
    });
    
    if (invalidVehicles.length > 0) {
      errors.push(...invalidVehicles);
    }
  }

  // Validação de ponto de partida
  if (!startPoint || !startPoint.lat || !startPoint.lng) {
    errors.push('O ponto de partida é obrigatório.');
  } else {
    const startLat = parseFloat(startPoint.lat);
    const startLng = parseFloat(startPoint.lng);
    
    if (isNaN(startLat) || isNaN(startLng) || startLat < -90 || startLat > 90 || startLng < -180 || startLng > 180) {
      errors.push('As coordenadas do ponto de partida são inválidas.');
    }
    
    // Verifica se o ponto de partida está muito longe dos pontos de coleta
    if (points.length > 0) {
      const maxRadiusMeters = (data.options?.max_radius_km || 50) * 1000; // Converte km para metros
      const farPoints = [];
      
      points.forEach((point, index) => {
        const pointLat = parseFloat(point.lat);
        const pointLng = parseFloat(point.lng);
        
        if (!isNaN(pointLat) && !isNaN(pointLng)) {
          const distance = calculateDistance(startLat, startLng, pointLat, pointLng);
          
          if (distance > maxRadiusMeters) {
            farPoints.push({
              point: point.name || `Ponto ${index + 1}`,
              distance: (distance / 1000).toFixed(1)
            });
          }
        }
      });
      
      if (farPoints.length > 0) {
        const maxRadiusKm = (maxRadiusMeters / 1000).toFixed(0);
        const farPointsMessage = farPoints.slice(0, 3) // Limita a 3 pontos para não poluir
          .map(p => `${p.point} (${p.distance}km)`)
          .join(', ');
        
        // Adiciona como aviso em vez de erro
        console.warn(`[AVISO] Alguns pontos estão muito longe do ponto de partida (mais de ${maxRadiusKm}km): ${farPointsMessage}${farPoints.length > 3 ? '...' : ''}`);
        
        // Adiciona ao array de avisos em vez de erros
        if (!data.warnings) data.warnings = [];
        data.warnings.push(`📍 PONTO DE PARTIDA\n` +
          `------------------\n` +
          farPoints.map(p => `• ${p.point} (${p.distance}km)`).join('\n') + 
          `${farPoints.length > 3 ? '\n• ...' : ''}`);
      }
    }
  }

  // Validação de janelas de tempo
  if (points.length > 0) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;
    
    // Verifica se as janelas de tempo são viáveis
    points.forEach((point, index) => {
      const pointName = point.name || `Ponto ${index + 1}`;
      const timeWindowStart = timeToMinutes(point.time_window_start || '00:00');
      const timeWindowEnd = timeToMinutes(point.time_window_end || '23:59');
      
      if (timeWindowStart === -1) {
        errors.push(`Formato de horário de início inválido para ${pointName}. Use o formato HH:MM.`);
      }
      
      if (timeWindowEnd === -1) {
        errors.push(`Formato de horário de término inválido para ${pointName}. Use o formato HH:MM.`);
      }
      
      if (timeWindowStart !== -1 && timeWindowEnd !== -1) {
        // Verifica se a janela de tempo é válida
        if (timeWindowStart >= timeWindowEnd) {
          errors.push(`A janela de tempo para ${pointName} é inválida (${point.time_window_start} - ${point.time_window_end}). O horário de término deve ser após o horário de início.`);
        }
        
        // Verifica se a janela de tempo já passou
        if (timeWindowEnd < currentTimeInMinutes) {
          errors.push(`A janela de tempo para ${pointName} (${point.time_window_start} - ${point.time_window_end}) já expirou.`);
        }
      }
    });
    
    // Verifica se há sobreposição de janelas de tempo para o mesmo veículo
    if (vehicles.length > 0) {
      // Para cada veículo, verifica se há sobreposição de janelas de tempo
      vehicles.forEach((vehicle, vIndex) => {
        const vehicleName = vehicle.name || `Veículo ${vIndex + 1}`;
        const vehicleTimeWindows = [];
        
        // Coleta todas as janelas de tempo para este veículo
        points.forEach((point, pIndex) => {
          if (point.assigned_vehicle_id === vehicle.id) {
            const start = timeToMinutes(point.time_window_start || '00:00');
            const end = timeToMinutes(point.time_window_end || '23:59');
            
            if (start !== -1 && end !== -1) {
              vehicleTimeWindows.push({
                point: point.name || `Ponto ${pIndex + 1}`,
                start,
                end
              });
            }
          }
        });
        
        // Verifica sobreposições
        for (let i = 0; i < vehicleTimeWindows.length; i++) {
          for (let j = i + 1; j < vehicleTimeWindows.length; j++) {
            const w1 = vehicleTimeWindows[i];
            const w2 = vehicleTimeWindows[j];
            
            // Verifica se há sobreposição
            if (w1.start < w2.end && w2.start < w1.end) {
              errors.push(`Sobreposição de janelas de tempo para ${vehicleName}: ${w1.point} (${minutesToTime(w1.start)}-${minutesToTime(w1.end)}) e ${w2.point} (${minutesToTime(w2.start)}-${minutesToTime(w2.end)})`);
            }
          }
        }
      });
    }
  }

  // Validação de capacidade total vs demanda
  if (points.length > 0 && vehicles.length > 0) {
    const totalWeight = points.reduce((sum, point) => sum + Math.max(0, parseFloat(point.weight) || 0), 0);
    const totalVolume = points.reduce((sum, point) => sum + Math.max(0, parseFloat(point.volume) || 0), 0);
    const totalQuantity = points.reduce((sum, point) => sum + Math.max(0, parseInt(point.quantity || 1, 10)), 0);
    
    const totalCapacity = vehicles.reduce((sum, vehicle) => sum + Math.max(0, parseFloat(vehicle.capacity) || 0), 0);
    const totalVolumeCapacity = vehicles.reduce((sum, vehicle) => {
      const vol = parseFloat(vehicle.volume_capacity) || 0;
      return sum + (vol > 0 ? vol : 0);
    }, 0);
    
    if (totalWeight > totalCapacity) {
      errors.push(`O peso total (${totalWeight.toFixed(2)}kg) excede a capacidade total dos veículos (${totalCapacity.toFixed(2)}kg).`);
    }
    
    if (totalVolume > 0 && totalVolumeCapacity > 0 && totalVolume > totalVolumeCapacity) {
      errors.push(`O volume total (${totalVolume.toFixed(2)}m³) excede a capacidade total dos veículos (${totalVolumeCapacity.toFixed(2)}m³).`);
    }
    
    if (totalQuantity > points.length * 10) { // Limite razoável de itens por ponto
      errors.push(`A quantidade total de itens (${totalQuantity}) parece excessiva para a quantidade de pontos.`);
    }
  }

  // Se houver apenas avisos e nenhum erro, considera válido
  const hasErrors = errors.length > 0;
  
  return {
    isValid: !hasErrors,
    errors,
    warnings: data.warnings || []
  };
};

/**
 * Agrupa erros por categoria para melhor organização
 */
const groupErrorsByCategory = (errors) => {
  const categories = {
    startPoint: [],
    points: [],
    vehicles: [],
    capacity: [],
    other: []
  };
  
  errors.forEach(error => {
    if (error.includes('ponto de partida') || error.includes('coordenadas do ponto de partida')) {
      categories.startPoint.push(error);
    } else if (error.includes('ponto') || error.includes('coordenadas') || error.includes('janela de tempo')) {
      categories.points.push(error);
    } else if (error.includes('veículo') || error.includes('veiculo')) {
      categories.vehicles.push(error);
    } else if (error.includes('capacidade') || error.includes('volume') || error.includes('peso')) {
      categories.capacity.push(error);
    } else {
      categories.other.push(error);
    }
  });
  
  return categories;
};

/**
 * Formata as mensagens de erro para exibição
 * @param {string[]} errors - Lista de erros
 * @param {boolean} [isWarning=false] - Indica se são avisos (não bloqueantes)
 * @returns {string} - Mensagem formatada
 */
export const formatValidationErrors = (errors, isWarning = false) => {
  if (!errors || errors.length === 0) return '';
  
  // Agrupa erros por categoria
  const groupedErrors = groupErrorsByCategory(errors);
  
  // Função auxiliar para formatar uma lista de erros/avisos
  const formatErrorList = (errorList, maxItems = 5) => {
    const visibleItems = errorList.slice(0, maxItems);
    const remaining = errorList.length - maxItems;
    
    let result = visibleItems.map((error, i) => {
      // Remove o número do início da mensagem se existir
      const cleanError = error.replace(/^\d+\.\s*/, '');
      return `• ${cleanError}`;
    }).join('\n');
    
    if (remaining > 0) {
      result += `\n• ...e mais ${remaining} ${remaining === 1 ? 'item' : 'itens'} semelhantes`;
    }
    
    return result;
  };
  
  // Cabeçalho da mensagem baseado no tipo (erro ou aviso)
  let message = isWarning 
    ? 'Atenção aos seguintes itens:\n\n'
    : 'Por favor, corrija os seguintes problemas antes de continuar:\n\n';
  
  // Formata os erros/avisos por categoria
  if (groupedErrors.startPoint.length > 0) {
    message += '\n📍 PONTO DE PARTIDA\n';
    message += '------------------\n';
    message += formatErrorList(groupedErrors.startPoint);
    message += '\n';
  }
  
  if (groupedErrors.points.length > 0) {
    message += '\n📌 PONTOS DE COLETA\n';
    message += '------------------\n';
    message += formatErrorList(groupedErrors.points);
    message += '\n';
  }
  
  if (groupedErrors.vehicles.length > 0) {
    message += '\n🚚 VEÍCULOS\n';
    message += '----------\n';
    message += formatErrorList(groupedErrors.vehicles);
    message += '\n';
  }
  
  if (groupedErrors.capacity.length > 0) {
    message += '\n⚖️ CAPACIDADE E DIMENSÕES\n';
    message += '------------------------\n';
    message += formatErrorList(groupedErrors.capacity);
    message += '\n';
  }
  
  if (groupedErrors.other.length > 0) {
    message += '\n⚠️  OUTROS\n';
    message += '----------\n';
    message += formatErrorList(groupedErrors.other);
    message += '\n';
  }
  
  // Adiciona dicas gerais no final
  if (!isWarning) {
    message += '\n💡 DICAS:\n';
    message += '----------\n';
    message += '• Verifique se todos os campos obrigatórios foram preenchidos corretamente\n';
    message += '• Confirme se as coordenadas dos pontos estão corretas\n';
    message += '• Verifique se a capacidade dos veículos atende à demanda total\n';
    message += '• Certifique-se de que não há pontos duplicados ou muito próximos\n';
  }
  
  return message;
};
