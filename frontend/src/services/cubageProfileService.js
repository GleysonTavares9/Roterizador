import api from './api';

const cubageProfileService = {
  // Busca todos os perfis de cubagem
  async getAll(activeOnly = false) {
    try {
      console.log(`[cubageProfileService] Buscando todos os perfis de cubagem`);
      console.log('[cubageProfileService] URL da API:', api.defaults.baseURL);
      
      // Adiciona um timestamp para rastrear a requisição
      const requestId = Date.now();
      console.log(`[${requestId}] [cubageProfileService] Iniciando requisição GET para /cubage-profiles`);
      console.log(`[${requestId}] [cubageProfileService] URL completa: ${api.defaults.baseURL}/cubage-profiles`);
      
      const response = await api.get('/cubage-profiles', {
        params: { 
          active_only: activeOnly,
          _t: new Date().getTime() // Evita cache
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-ID': requestId
        },
        timeout: 15000 // 15 segundos de timeout
      });
      
      console.log(`[${requestId}] [cubageProfileService] Resposta recebida com status:`, response.status);
      
      if (!Array.isArray(response.data)) {
        console.error(`[${requestId}] [cubageProfileService] Resposta inesperada da API:`, response.data);
        throw new Error('Formato de resposta inesperado da API');
      }
      
      // Formata os dados para o formato esperado pelo frontend
      const formattedProfiles = response.data.map(profile => {
        // Calcula valores padrão se necessário
        const length = parseFloat(profile.length) || 0;
        const width = parseFloat(profile.width) || 0;
        const height = parseFloat(profile.height) || 0;
        const weight = parseFloat(profile.weight) || 0;
        const volume = parseFloat(profile.volume) || (length * width * height);
        const density = volume > 0 ? (weight / volume) : 0;
        
        return {
          id: profile.id,
          name: profile.name || `Perfil ${profile.id}`,
          description: profile.description || '',
          weight: weight,
          capacity: parseFloat(profile.capacity) || weight,
          maxWeight: parseFloat(profile.maxWeight) || weight,
          length: length,
          width: width,
          height: height,
          volume: volume,
          density: parseFloat(profile.density) || density,
          isActive: profile.is_active !== false,
          is_active: profile.is_active !== false,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          // Adiciona campos para compatibilidade
          cubage_profile_id: profile.id,
          cubageProfileId: profile.id
        };
      });
      
      console.log(`[${requestId}] [cubageProfileService] ${formattedProfiles.length} perfis formatados com sucesso`);
      return formattedProfiles;
    } catch (error) {
      console.error('Erro ao buscar perfis de cubagem:', error);
      
      // Verifica se é um erro de rede
      if (error.response) {
        // A requisição foi feita e o servidor respondeu com um status de erro
        console.error('Resposta de erro:', error.response.data);
        console.error('Status do erro:', error.response.status);
        console.error('Cabeçalhos:', error.response.headers);
        throw new Error(`Erro ${error.response.status}: ${error.response.data?.detail || 'Erro ao buscar perfis'}`);
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta
        console.error('Sem resposta do servidor:', error.request);
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        // Algo aconteceu na configuração da requisição que causou um erro
        console.error('Erro ao configurar a requisição:', error.message);
        throw new Error(`Erro ao buscar perfis: ${error.message}`);
      }
    }
  },

  // Busca um perfil de cubagem pelo ID
  async getById(id) {
    try {
      if (!id) {
        throw new Error('ID do perfil não fornecido');
      }

      console.log(`[cubageProfileService] Buscando perfil com ID: ${id}`);
      
      const response = await api.get(`/cubage-profiles/${id}`, {
        params: { _t: new Date().getTime() } // Evita cache
      });
      
      if (!response.data) {
        throw new Error('Perfil não encontrado');
      }
      
      // Formata os dados para o formato esperado pelo frontend
      const profile = response.data;
      console.log(`[cubageProfileService] Dados brutos do perfil ${id}:`, profile);
      
      // Calcula valores padrão se necessário
      const length = parseFloat(profile.length) || 0;
      const width = parseFloat(profile.width) || 0;
      const height = parseFloat(profile.height) || 0;
      const weight = parseFloat(profile.weight) || 0;
      const volume = parseFloat(profile.volume) || (length * width * height);
      const density = volume > 0 ? (weight / volume) : 0;
      
      const formattedProfile = {
        id: profile.id,
        name: profile.name || `Perfil ${profile.id}`,
        description: profile.description || '',
        weight: weight,
        capacity: parseFloat(profile.capacity) || weight, // Adiciona suporte a capacity
        maxWeight: parseFloat(profile.maxWeight) || weight, // Adiciona suporte a maxWeight
        length: length,
        width: width,
        height: height,
        volume: volume,
        density: parseFloat(profile.density) || density,
        isActive: profile.is_active !== false,
        is_active: profile.is_active !== false,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
      
      console.log(`[cubageProfileService] Perfil formatado (ID ${id}):`, formattedProfile);
      return formattedProfile;
    } catch (error) {
      console.error(`Erro ao buscar perfil com ID ${id}:`, error);
      throw error;
    }
  },

  // Cria um novo perfil de cubagem
  async create(profileData) {
    try {
      console.log('Dados recebidos para criação de perfil:', profileData);
      
      // Garante que os valores numéricos sejam tratados corretamente
      const formatNumber = (value) => {
        if (value === null || value === undefined) return 0;
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
        return isNaN(num) ? 0 : num;
      };
      
      // Prepara os dados no formato esperado pelo backend
      const formattedData = {
        name: String(profileData.name || '').trim(),
        description: String(profileData.description || '').trim(),
        weight: formatNumber(profileData.weight),
        length: formatNumber(profileData.length),
        width: formatNumber(profileData.width),
        height: formatNumber(profileData.height),
        is_active: Boolean(profileData.is_active !== false)
      };
      
      console.log('Enviando requisição POST para /cubage-profiles com os dados:', formattedData);
      
      const response = await api.post('/cubage-profiles', formattedData);
      
      console.log('Resposta da API (create):', response.data);
      
      // Retorna os dados formatados
      const profile = response.data;
      return {
        id: profile.id,
        name: profile.name,
        description: profile.description || '',
        weight: profile.weight,
        length: profile.length,
        width: profile.width,
        height: profile.height,
        volume: profile.volume || (profile.length * profile.width * profile.height),
        density: profile.density || (profile.weight / (profile.length * profile.width * profile.height)),
        isActive: profile.is_active !== false,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    } catch (error) {
      console.error('Erro ao criar perfil de cubagem:', error);
      
      if (error.response) {
        if (error.response.data && error.response.data.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error(`Erro ao criar perfil: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        throw new Error(`Erro ao processar a requisição: ${error.message}`);
      }
    }
  },

  // Atualiza um perfil de cubagem existente
  async update(id, profileData) {
    try {
      console.log(`Atualizando perfil de cubagem com ID: ${id}`, profileData);
      
      // Garante que os valores numéricos sejam tratados corretamente
      const formatNumber = (value) => {
        if (value === null || value === undefined) return 0;
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
        return isNaN(num) ? 0 : num;
      };
      
      // Prepara os dados no formato esperado pelo backend
      const formattedData = {
        name: String(profileData.name || '').trim(),
        description: String(profileData.description || '').trim(),
        weight: formatNumber(profileData.weight),
        length: formatNumber(profileData.length),
        width: formatNumber(profileData.width),
        height: formatNumber(profileData.height),
        is_active: Boolean(profileData.is_active !== false)
      };
      
      console.log(`Enviando requisição PUT para /cubage-profiles/${id} com os dados:`, formattedData);
      
      const response = await api.put(`/cubage-profiles/${id}`, formattedData);
      
      console.log('Resposta da API (update):', response.data);
      
      // Retorna os dados formatados
      const profile = response.data;
      return {
        id: profile.id,
        name: profile.name,
        description: profile.description || '',
        weight: profile.weight,
        length: profile.length,
        width: profile.width,
        height: profile.height,
        volume: profile.volume || (profile.length * profile.width * profile.height),
        density: profile.density || (profile.weight / (profile.length * profile.width * profile.height)),
        isActive: profile.is_active !== false,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    } catch (error) {
      console.error(`Erro ao atualizar perfil com ID ${id}:`, error);
      
      if (error.response) {
        if (error.response.data && error.response.data.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error(`Erro ao atualizar perfil: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        throw new Error(`Erro ao processar a requisição: ${error.message}`);
      }
    }
  },

  // Remove um perfil de cubagem
  async delete(id) {
    try {
      if (!id) {
        throw new Error('ID do perfil não fornecido');
      }

      console.log(`[cubageProfileService] Removendo perfil ${id}`);
      
      const response = await api.delete(`/cubage-profiles/${id}`);
      console.log('Resposta da API (delete):', response.data);
      return response.data;
    } catch (error) {
      console.error(`Erro ao excluir perfil com ID ${id}:`, error);
      
      if (error.response) {
        if (error.response.data && error.response.data.detail) {
          throw new Error(error.response.data.detail);
        }
        throw new Error(`Erro ao excluir perfil: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      } else {
        throw new Error(`Erro ao processar a requisição: ${error.message}`);
      }
    }
  }
};

export default cubageProfileService;
