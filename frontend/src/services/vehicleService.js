import api from './api';

const vehicleService = {
  // Busca todos os veículos
  async getAll() {
    try {
      console.log('[vehicleService] Buscando todos os veículos');
      
      // Faz a requisição para o endpoint de veículos
      const requestId = Date.now();
      const endpoint = '/vehicles';
      console.log(`[${requestId}] [vehicleService] Iniciando requisição GET para ${endpoint}`);
      console.log(`[${requestId}] [vehicleService] URL completa: ${api.defaults.baseURL}${endpoint}`);
      
      const response = await api.get(endpoint, {
        params: {
          include: 'cubage_profile'
        }
      });
      console.log(`[vehicleService] ${response.data.length} veículos encontrados`);
      
      if (!response || !Array.isArray(response.data)) {
        console.error('[vehicleService] Resposta inválida da API:', response);
        throw new Error('Resposta inválida da API');
      }
      
      // Formata os dados dos veículos para garantir consistência
      const formattedVehicles = response.data.map(vehicle => ({
        ...vehicle,
        // Garante que todos os campos necessários estejam presentes
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
        is_active: vehicle.is_active !== undefined ? vehicle.is_active : (vehicle.isActive !== false),
        isActive: vehicle.is_active !== undefined ? vehicle.is_active : (vehicle.isActive !== false),
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at
      }));
      
      console.log('[vehicleService] Veículos formatados com sucesso');
      return formattedVehicles;
    } catch (error) {
      throw error;
    }
  },

  // Busca um veículo pelo ID
  async getById(id) {
    try {
      if (!id) {
        throw new Error('ID do veículo não fornecido');
      }
      
      console.log(`[vehicleService] Buscando veículo com ID: ${id}`);
      const endpoint = `/vehicles/${id}`;
      console.log(`[vehicleService] URL completa: ${api.defaults.baseURL}${endpoint}`);
      
      const response = await api.get(endpoint, {
        params: {
          include: 'cubage_profile'
        }
      });
      console.log('[vehicleService] Resposta da API recebida');
      
      if (!response || !response.data) {
        console.error('[vehicleService] Nenhum dado retornado na resposta');
        throw new Error('Nenhum dado retornado na resposta da API');
      }
      
      const vehicle = response.data;
      console.log('[vehicleService] Dados brutos do veículo:', vehicle);
      
      // Formata os dados do veículo para garantir consistência
      const formattedVehicle = {
        ...vehicle,
        // Garante que todos os campos necessários estejam presentes
        id: vehicle.id,
        plate: vehicle.plate || vehicle.name || '',
        name: vehicle.plate || vehicle.name || '',
        description: vehicle.description || '',
        capacity: parseFloat(vehicle.capacity) || 0,
        max_weight: parseFloat(vehicle.max_weight || vehicle.maxWeight) || 0,
        length: parseFloat(vehicle.length) || 0,
        width: parseFloat(vehicle.width) || 0,
        height: parseFloat(vehicle.height) || 0,
        is_active: vehicle.is_active !== undefined ? vehicle.is_active : (vehicle.isActive !== false),
        cubic_meters: parseFloat(vehicle.cubic_meters || vehicle.cubicMeters) || 0,
        cubage_profile_id: vehicle.cubage_profile_id || vehicle.cubageProfileId || null,
        cubage_profile: vehicle.cubage_profile || null,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at
      };
      
      console.log('[vehicleService] Veículo formatado:', formattedVehicle);
      return formattedVehicle;
    } catch (error) {
      throw error;
    }
  },

  // Cria um novo veículo
  async create(vehicleData) {
    try {
      if (!vehicleData) {
        throw new Error('Dados do veículo não fornecidos');
      }
      
      console.log('[vehicleService] Criando novo veículo com dados:', vehicleData);
      
      // Prepara os dados no formato esperado pelo backend
      const formattedData = {
        name: vehicleData.plate || vehicleData.name || '', // O backend espera 'name' como identificador único
        description: vehicleData.description || '',
        capacity: parseFloat(vehicleData.capacity) || 0,
        max_weight: parseFloat(vehicleData.maxWeight || vehicleData.max_weight) || 0,
        length: parseFloat(vehicleData.length) || 0,
        width: parseFloat(vehicleData.width) || 0,
        height: parseFloat(vehicleData.height) || 0,
        cubage_profile_id: vehicleData.cubageProfileId || vehicleData.cubage_profile_id || null,
        is_active: vehicleData.isActive !== false
      };
      
      // Garantir que o cubage_profile_id seja um número ou null
      if (formattedData.cubage_profile_id) {
        formattedData.cubage_profile_id = parseInt(formattedData.cubage_profile_id, 10);
        if (isNaN(formattedData.cubage_profile_id)) {
          formattedData.cubage_profile_id = null;
        }
      }
      
      // Remove campos vazios ou nulos
      Object.keys(formattedData).forEach(key => {
        if (formattedData[key] === null || formattedData[key] === undefined || formattedData[key] === '') {
          delete formattedData[key];
        }
      });
      
      console.log('[vehicleService] Dados formatados para envio:', formattedData);
      
      const endpoint = '/vehicles';
      console.log(`[vehicleService] Enviando POST para: ${endpoint}`, formattedData);
      
      const response = await api.post(endpoint, formattedData);
      console.log('[vehicleService] Resposta da API:', response);
      
      if (!response || !response.data) {
        throw new Error('Resposta inválida da API');
      }
      
      // Se a resposta for um array, pega o primeiro item (compatibilidade com algumas APIs)
      const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
      
      // Formata a resposta para o frontend
      const result = {
        ...responseData,
        id: responseData.id,
        plate: responseData.plate || responseData.name || '',
        name: responseData.plate || responseData.name || '',
        description: responseData.description || '',
        capacity: parseFloat(responseData.capacity) || 0,
        max_weight: parseFloat(responseData.max_weight || responseData.maxWeight) || 0,
        maxWeight: parseFloat(responseData.max_weight || responseData.maxWeight) || 0,
        length: parseFloat(responseData.length) || 0,
        width: parseFloat(responseData.width) || 0,
        height: parseFloat(responseData.height) || 0,
        cubic_meters: parseFloat(responseData.cubic_meters || responseData.cubicMeters) || 0,
        cubicMeters: parseFloat(responseData.cubic_meters || responseData.cubicMeters) || 0,
        cubage_profile_id: responseData.cubage_profile_id || responseData.cubageProfileId || null,
        cubage_profile: responseData.cubage_profile || null,
        is_active: responseData.is_active !== undefined ? responseData.is_active : (responseData.isActive !== false),
        isActive: responseData.is_active !== undefined ? responseData.is_active : (responseData.isActive !== false),
        created_at: responseData.created_at,
        updated_at: responseData.updated_at
      };
      
      console.log('[vehicleService] Veículo criado com sucesso:', result);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Atualiza um veículo existente
  async update(id, vehicleData) {
    try {
      if (!id) {
        throw new Error('ID do veículo não fornecido');
      }
      
      if (!vehicleData) {
        throw new Error('Dados do veículo não fornecidos');
      }
      
      console.log(`[vehicleService] Atualizando veículo ID: ${id} com dados:`, vehicleData);
      
      // Prepara os dados no formato esperado pelo backend
      const formattedData = {
        name: vehicleData.plate || vehicleData.name || '', // O backend espera 'name' como identificador único
        description: vehicleData.description || '',
        capacity: parseFloat(vehicleData.capacity) || 0,
        max_weight: parseFloat(vehicleData.maxWeight || vehicleData.max_weight) || 0,
        length: parseFloat(vehicleData.length) || 0,
        width: parseFloat(vehicleData.width) || 0,
        height: parseFloat(vehicleData.height) || 0,
        cubage_profile_id: vehicleData.cubageProfileId || vehicleData.cubage_profile_id || null,
        is_active: vehicleData.isActive !== false
      };
      
      // Remove campos vazios ou nulos
      Object.keys(formattedData).forEach(key => {
        if (formattedData[key] === null || formattedData[key] === undefined || formattedData[key] === '') {
          delete formattedData[key];
        }
      });
      
      console.log('[vehicleService] Dados formatados para atualização:', formattedData);
      
      const endpoint = `/vehicles/${id}`;
      console.log(`[vehicleService] Enviando PUT para: ${endpoint}`, formattedData);
      
      const response = await api.put(endpoint, formattedData);
      console.log('[vehicleService] Resposta da API:', response);
      
      if (!response || !response.data) {
        throw new Error('Resposta inválida da API');
      }
      
      // Se a resposta for um array, pega o primeiro item (compatibilidade com algumas APIs)
      const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
      
      // Formata a resposta para o frontend
      const result = {
        ...responseData,
        id: responseData.id,
        plate: responseData.plate || responseData.name || '',
        name: responseData.plate || responseData.name || '',
        description: responseData.description || '',
        capacity: parseFloat(responseData.capacity) || 0,
        max_weight: parseFloat(responseData.max_weight || responseData.maxWeight) || 0,
        maxWeight: parseFloat(responseData.max_weight || responseData.maxWeight) || 0,
        length: parseFloat(responseData.length) || 0,
        width: parseFloat(responseData.width) || 0,
        height: parseFloat(responseData.height) || 0,
        cubic_meters: parseFloat(responseData.cubic_meters || responseData.cubicMeters) || 0,
        cubicMeters: parseFloat(responseData.cubic_meters || responseData.cubicMeters) || 0,
        cubage_profile_id: responseData.cubage_profile_id || responseData.cubageProfileId || null,
        cubage_profile: responseData.cubage_profile || null,
        is_active: responseData.is_active !== undefined ? responseData.is_active : (responseData.isActive !== false),
        isActive: responseData.is_active !== undefined ? responseData.is_active : (responseData.isActive !== false),
        created_at: responseData.created_at,
        updated_at: responseData.updated_at
      };
      
      console.log('[vehicleService] Veículo atualizado com sucesso:', result);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Remove um veículo (soft delete)
  async delete(id) {
    try {
      if (!id) {
        throw new Error('ID do veículo não fornecido');
      }
      
      console.log(`[vehicleService] Removendo veículo ID: ${id}`);
      
      const endpoint = `/vehicles/${id}`;
      console.log(`[vehicleService] Enviando DELETE para: ${endpoint}`);
      
      const response = await api.delete(endpoint);
      console.log('[vehicleService] Resposta da API:', response.data);
      
      if (!response || !response.data) {
        throw new Error('Resposta inválida da API');
      }
      
      console.log('[vehicleService] Veículo removido com sucesso');
      return response.data;
    } catch (error) {
      console.error(`[vehicleService] Erro ao remover veículo ID ${id}:`, error);
      throw error;
    }
  }
};

export default vehicleService;
