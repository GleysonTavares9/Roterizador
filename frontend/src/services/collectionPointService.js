import api from './api';

const BATCH_ENDPOINT = '/collection-points/';

// Configurações padrão
const DEFAULT_CONFIG = {
  batchSize: 100,            // Aumentado para processar mais pontos por requisição
  maxConcurrent: 5,          // Aumentado para mais requisições concorrentes
  maxRetries: 3,             // Número máximo de tentativas por lote
  baseDelay: 1000,           // Atraso base para backoff exponencial
  timeout: 60000,            // Aumentado para processamento em lote
  validateBeforeSend: true,  // Valida os dados antes de enviar
  chunkSize: 20,             // Tamanho dos minilotes para processamento paralelo
};

/**
 * Serviço para processamento em lote de pontos de coleta
 */
const batchService = {
  /**
   * Formata um ponto de coleta para o formato esperado pelo backend
   * @private
   */
  _formatPoint(point) {
    const formatFrequencyField = (value, fieldName = '') => {
      if (value === null || value === undefined || value === '') return null;
      
      // Converte para array se ainda não for
      let values = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
      
      // Filtra e valida valores vazios
      values = values.filter(v => v !== '');
      
      // Validação especial para semanas do mês (1-4)
      if (fieldName === 'weeks_of_month' || fieldName === 'week_of_month') {
        values = values
          .map(v => parseInt(v, 10))
          .filter(v => !isNaN(v) && v >= 1 && v <= 4)
          .sort((a, b) => a - b)
          .map(String);
        return values.length > 0 ? values.join(',') : null;
      }
      
      return values.join(',');
    };

    return {
      external_id: point.external_id ? String(point.external_id).trim() : null,
      name: String(point.name || '').trim(),
      address: String(point.address || '').trim(),
      neighborhood: String(point.neighborhood || '').trim(),
      city: String(point.city || '').trim(),
      state: String(point.state || '').trim().substring(0, 2).toUpperCase(),
      zip_code: point.zip_code ? String(point.zip_code).replace(/\D/g, '').substring(0, 8) : null,
      phone: point.phone ? String(point.phone).replace(/\D/g, '') : null,
      email: point.email ? String(point.email).trim().toLowerCase() : null,
      notes: point.notes ? String(point.notes).trim() : null,
      is_active: point.is_active !== undefined ? Boolean(point.is_active) : true,
      latitude: point.latitude != null ? parseFloat(point.latitude) : null,
      longitude: point.longitude != null ? parseFloat(point.longitude) : null,
      frequency: formatFrequencyField(point.frequency, 'frequency'),
      days_of_week: formatFrequencyField(point.days_of_week || point.week_days, 'days_of_week'),
      weeks_of_month: formatFrequencyField(point.weeks_of_month || point.week_of_month, 'weeks_of_month'),
    };
  },

  /**
   * Valida um ponto de coleta
   * @private
   */
  _validatePoint(point, index) {
    const errors = [];
    
    if (!point.external_id || String(point.external_id).trim() === '') {
      errors.push('external_id é obrigatório');
    }
    
    if (!point.name || String(point.name).trim() === '') {
      errors.push('name é obrigatório');
    }
    
    if (!point.address || String(point.address).trim() === '') {
      errors.push('address é obrigatório');
    }
    
    if (point.latitude && (isNaN(parseFloat(point.latitude)) || point.latitude < -90 || point.latitude > 90)) {
      errors.push('latitude inválida');
    }
    
    if (point.longitude && (isNaN(parseFloat(point.longitude)) || point.longitude < -180 || point.longitude > 180)) {
      errors.push('longitude inválida');
    }
    
    return errors.length === 0 ? null : {
      index,
      external_id: point.external_id,
      name: point.name,
      errors
    };
  },

  /**
   * Processa uma requisição com retry e backoff exponencial
   * @private
   */
  async _fetchWithRetry(url, data, config = {}, attempt = 1) {
    const { maxRetries = 3, baseDelay = 1000 } = config;
    
    try {
      console.log(`[${new Date().toISOString()}] Enviando requisição para ${url}`, { 
        attempt, 
        data: JSON.stringify(data),
        config: {
          timeout: config.timeout,
          maxRetries: config.maxRetries,
          headers: config.headers
        }
      });
      
      const response = await api({
        method: 'post',
        url,
        data: data, // Já deve estar no formato correto
        timeout: config.timeout || 30000,
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {})
        }
      });
      
      console.log(`[${new Date().toISOString()}] Resposta recebida de ${url}:`, {
        status: response.status,
        data: response.data,
        headers: response.headers
      });
      
      // Se a resposta for bem-sucedida, retorna os dados diretamente
      if (response.status >= 200 && response.status < 300) {
        return { 
          success: true, 
          data: response.data,
          status: response.status
        };
      }
      
      // Se a resposta for um erro, lança uma exceção para ser capturada pelo catch
      const error = new Error(`HTTP error ${response.status}: ${JSON.stringify(response.data)}`);
      error.response = response;
      throw error;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro na requisição para ${url}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
        stack: error.stack
      });
      
      if (attempt >= maxRetries) {
        console.error(`[${new Date().toISOString()}] Número máximo de tentativas (${maxRetries}) atingido para ${url}`);
        return { 
          success: false, 
          error: {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data || error.data,
            stack: error.stack
          }
        };
      }
      
      // Backoff exponencial com jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        30000 // Máximo de 30 segundos
      );
      
      console.warn(`[${new Date().toISOString()}] Tentativa ${attempt}/${maxRetries} falhou. Tentando novamente em ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this._fetchWithRetry(url, data, config, attempt + 1);
    }
  },

  /**
   * Processa um lote de pontos em uma única requisição
   * @private
   */
  async _processBatch(batch, config, onProgress) {
    const results = [];
    const errors = [];
    const chunkSize = config.chunkSize || 20;
    let processed = 0;
    
    // Processa em pedaços menores para melhor controle de progresso
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      
      try {
        const { success, data, error } = await this._fetchWithRetry(
          `${BATCH_ENDPOINT}/batch`,
          { points: chunk },
          config
        );
        
        if (success) {
          const successfulPoints = data.points || [];
          results.push(...successfulPoints);
          
          // Verifica se algum ponto falhou no processamento
          if (successfulPoints.length < chunk.length) {
            const processedIds = new Set(successfulPoints.map(p => p.external_id));
            const failedPoints = chunk.filter(p => !processedIds.has(p.external_id));
            
            failedPoints.forEach(point => {
              errors.push({
                point,
                error: { message: 'Falha ao processar o ponto' }
              });
            });
          }
          
          processed += chunk.length;
          onProgress?.({
            processed,
            success: successfulPoints.length,
            errors: chunk.length - successfulPoints.length,
            current: Math.min(processed, batch.length),
            total: batch.length
          });
        } else {
          throw error || new Error('Erro desconhecido ao processar lote');
        }
      } catch (error) {
        console.error('Erro ao processar lote:', error);
        
        // Adiciona todos os pontos do chunk como erro
        chunk.forEach(point => {
          errors.push({
            point,
            error: error.message || 'Erro ao processar o ponto'
          });
        });
        
        processed += chunk.length;
        onProgress?.({
          processed,
          success: 0,
          errors: chunk.length,
          current: Math.min(processed, batch.length),
          total: batch.length
        });
      }
    }
    
    return { results, errors };
  },

  /**
   * Processa uma lista de pontos de coleta em lotes
   * @param {Array} points - Lista de pontos a serem processados
   * @param {Object} options - Opções de configuração
   * @param {Function} onProgress - Callback para acompanhar o progresso
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processPoints(points, options = {}, onProgress) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const startTime = Date.now();
  
  console.log(`Iniciando processamento de ${points.length} pontos`, { config });
  
  // Validação inicial de todos os pontos
  const validationResults = points.map((point, index) => ({
    point,
    error: config.validateBeforeSend ? this._validatePoint(point, index) : null
  }));
  
  const invalidPoints = validationResults.filter(r => r.error);
  const validPoints = validationResults
    .filter(r => !r.error)
    .map(r => this._formatPoint(r.point));
  
  if (invalidPoints.length > 0) {
    console.warn(`Encontrados ${invalidPoints.length} pontos inválidos`);
  }
  
  // Processa os pontos válidos em lotes
  const batchSize = config.batchSize;
  const batches = [];
  
  for (let i = 0; i < validPoints.length; i += batchSize) {
    batches.push(validPoints.slice(i, i + batchSize));
  }
  
  const results = [];
  const errors = [];
  let processedCount = 0;
  
  // Processa os lotes em paralelo controlado
  for (let i = 0; i < batches.length; i += config.maxConcurrent) {
    const currentBatches = batches.slice(i, i + config.maxConcurrent);
    const batchPromises = currentBatches.map(batch => 
      this._processBatch(
        batch, 
        config, 
        (progress) => {
          const globalProgress = {
            processed: processedCount + progress.processed,
            success: results.length + progress.success,
            errors: errors.length + progress.errors,
            current: Math.min(processedCount + progress.processed, validPoints.length),
            total: validPoints.length
          };
          onProgress?.(globalProgress);
        }
      )
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ results: batchResults, errors: batchErrors }) => {
      results.push(...batchResults);
      errors.push(...batchErrors);
      processedCount += batchResults.length + batchErrors.length;
    });
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  
  return {
    total: points.length,
    processed: results.length + errors.length + invalidPoints.length,
    success: results.length,
    errors: errors.length + invalidPoints.length,
    invalid: invalidPoints.length,
    time: totalTime,
    pointsPerSecond: points.length / totalTime,
    batches: {
      total: batches.length,
      size: batchSize,
      concurrent: config.maxConcurrent
    },
    details: {
      results,
      errors: [
        ...errors.map(e => ({
          point: e.point,
          error: e.error?.message || 'Erro desconhecido',
          type: 'processing'
        })),
        ...invalidPoints.map(p => ({
          point: p.point,
          error: p.error.errors.join(', '),
          type: 'validation'
        }))
      ]
    }
  };
},

/**
    }

    // Processa os pontos válidos em lotes
    const batchSize = config.batchSize;
    const batches = [];

    for (let i = 0; i < validPoints.length; i += batchSize) {
      batches.push(validPoints.slice(i, i + batchSize));
    }

    const results = [];
    const errors = [];
    let processedCount = 0;

    // Processa os lotes em paralelo controlado
    for (let i = 0; i < batches.length; i += config.maxConcurrent) {
      const currentBatches = batches.slice(i, i + config.maxConcurrent);
      const batchPromises = currentBatches.map(batch =>
        this._processBatch(
          batch,
          config,
          (progress) => {
            const globalProgress = {
              processed: processedCount + progress.processed,
              success: results.length + progress.success,
              errors: errors.length + progress.errors,
              current: Math.min(processedCount + progress.processed, validPoints.length),
              total: validPoints.length
            };
            onProgress?.(globalProgress);
          }
        )
      );

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(({ results: batchResults, errors: batchErrors }) => {
        results.push(...batchResults);
        errors.push(...batchErrors);
        processedCount += batchResults.length + batchErrors.length;
      });
    }

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    return {
      total: points.length,
      processed: results.length + errors.length + invalidPoints.length,
      success: results.length,
      errors: errors.length + invalidPoints.length,
      invalid: invalidPoints.length,
      time: totalTime,
      pointsPerSecond: points.length / totalTime,
      batches: {
        total: batches.length,
        size: batchSize,
        concurrent: config.maxConcurrent
      },
      details: {
        results,
        errors: [
          ...errors.map(e => ({
            point: e.point,
            error: e.error?.message || 'Erro desconhecido',
            type: 'processing'
          })),
          ...invalidPoints.map(p => ({
            point: p.point,
            error: p.error.errors.join(', '),
            type: 'validation'
          }))
        ]
      }
    };
  },

  /**
   * Verifica quais IDs externos já existem no sistema
   * @param {Array<string>} externalIds - Lista de IDs externos para verificar
   * @param {Object} options - Opções de configuração
   * @returns {Promise<Object>} Mapa de IDs para booleanos indicando existência
   */
  async checkExistingExternalIds(externalIds, options = {}) {
    console.log(`[${new Date().toISOString()}] Verificando ${externalIds.length} IDs externos...`);

    if (!Array.isArray(externalIds) || externalIds.length === 0) {
      console.warn('Nenhum ID fornecido para verificação');
      return {};
    }

    // Configuração padrão
    const config = { 
      ...DEFAULT_CONFIG,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    try {
      // Filtra e valida os IDs
      const validIds = externalIds
        .filter(id => {
          if (id === null || id === undefined || id === '') {
            console.warn(`ID inválido (nulo ou vazio): ${id}`);
            return false;
          }
          const strId = String(id).trim();
          if (strId === '') {
            console.warn('ID vazio após conversão para string');
            return false;
          }
          return true;
        })
        .map(id => String(id).trim());

      if (validIds.length === 0) {
        console.warn('Nenhum ID válido para verificação após filtragem');
        return {};
      }

      console.log(`[${new Date().toISOString()}] Verificando ${validIds.length} IDs únicos...`);

      // Processa em lotes menores para evitar problemas
      const BATCH_SIZE = 20; // Reduzido para 20 por lote
      const results = {};
      const totalBatches = Math.ceil(validIds.length / BATCH_SIZE);

      for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
        const batch = validIds.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`[${new Date().toISOString()}] Processando lote ${batchNumber}/${totalBatches} com ${batch.length} IDs`);

        try {
          // Cria o payload no formato esperado pelo backend
          const payload = { ids: batch };
          
          console.log(`[${new Date().toISOString()}] Enviando lote ${batchNumber}...`, {
            url: `${BATCH_ENDPOINT}/check-existing`,
            payload: JSON.stringify(payload, null, 2),
            headers: config.headers
          });

          const response = await this._fetchWithRetry(
            `${BATCH_ENDPOINT}/check-existing`,
            payload,
            {
              ...config,
              maxRetries: 2,
              timeout: 30000,
              headers: {
                ...config.headers,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            }
          );

          console.log(`[${new Date().toISOString()}] Resposta recebida para lote ${batchNumber}:`, {
            status: response.status,
            data: response.data ? 'Dados recebidos' : 'Sem dados',
            error: response.error ? response.error.message : 'Nenhum erro'
          });

          if (response.success && response.data && typeof response.data === 'object') {
            console.log(`[${new Date().toISOString()}] Dados da resposta:`, {
              receivedIds: Object.keys(response.data).length,
              sample: Object.entries(response.data).slice(0, 3)
            });
            
            // Adiciona os resultados ao objeto final
            Object.assign(results, response.data);
            
            // Verifica se algum ID está faltando na resposta
            const missingIds = batch.filter(id => response.data[id] === undefined);
            if (missingIds.length > 0) {
              console.warn(`[${new Date().toISOString()}] ${missingIds.length} IDs não retornados na resposta do lote ${batchNumber}`, {
                sampleMissingIds: missingIds.slice(0, 5)
              });
              // Marca os faltantes como não existentes
              missingIds.forEach(id => {
                results[id] = false;
              });
            }
          } else {
            // Em caso de falha, marca todos os IDs do lote como não existentes
            console.warn(`[${new Date().toISOString()}] Falha ao processar lote ${batchNumber}`, {
              error: response.error,
              status: response.status,
              data: response.data
            });
            
            batch.forEach(id => {
              results[id] = false;
            });
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Erro ao processar lote ${batchNumber}:`, {
            error: error.message,
            stack: error.stack,
            response: error.response?.data
          });
          
          // Em caso de erro, marca todos os IDs do lote como não existentes
          batch.forEach(id => {
            results[id] = false;
          });
        }
      }

      console.log(`[${new Date().toISOString()}] Verificação concluída: ${Object.keys(results).length} IDs processados`);
      return results;

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao verificar IDs externos:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      // Em caso de erro, retorna um objeto com todos os IDs como não existentes
      return externalIds.reduce((acc, id) => {
        if (id != null && id !== '') {
          acc[String(id).trim()] = false;
        }
        return acc;
      }, {});
    }
  },

  /**
   * Busca todos os pontos de coleta ativos com suporte a paginação
   * @param {Object} params - Parâmetros de consulta (opcional)
   * @param {number} [params.page=1] - Número da página (começa em 1)
   * @param {number} [params.perPage=50] - Número de itens por página
   * @param {string} [params.city] - Filtrar por cidade
   * @param {string} [params.state] - Filtrar por estado
   * @param {boolean} [params.all=false] - Se true, busca todos os registros (ignora paginação)
   * @returns {Promise<Object>} Objeto com os dados e metadados de paginação
   */
  async getAll(params = {}) {
    try {
      const { 
        page = 1, 
        perPage = 50, 
        city, 
        state, 
        all = false,
        compatibilidade = false,
        ...otherParams 
      } = params;
      
      const skip = all ? 0 : (page - 1) * perPage;
      const limit = all ? 1000 : perPage; // Limite maior quando buscar todos
      
      // Se for para compatibilidade, retorna um array simples
      if (compatibilidade) {
        const response = await api.get(BATCH_ENDPOINT, {
          params: {
            skip: 0,
            limit: 1000, // Limite alto para pegar todos os registros
            active_only: true
          }
        });
        return Array.isArray(response.data) ? response.data : [];
      }
      
      console.log(`[${new Date().toISOString()}] Buscando pontos de coleta...`, { 
        page,
        perPage,
        skip,
        limit,
        city, 
        state,
        all
      });

      const response = await api.get(BATCH_ENDPOINT, {
        params: {
          skip,
          limit,
          city,
          state,
          active_only: true,
          ...otherParams
        }
      });

      const items = response.data?.items || response.data || [];
      const total = response.data?.total || items.length;
      const totalPages = all ? 1 : Math.ceil(total / perPage);
      const hasMore = all ? false : (page * perPage) < total;
      const nextPage = hasMore ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      console.log(`[${new Date().toISOString()}] Resposta da API:`, {
        status: response.status,
        count: items.length,
        total,
        page,
        totalPages,
        hasMore,
        nextPage,
        prevPage
      });

      return {
        items,
        pagination: {
          page,
          perPage,
          total,
          totalPages,
          hasMore,
          nextPage,
          prevPage
        }
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao buscar pontos de coleta:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        params
      });
      
      // Se for um erro de autenticação, redireciona para o login
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      // Retorna um objeto vazio com estrutura consistente
      return {
        items: [],
        pagination: {
          page: params.page || 1,
          perPage: params.perPage || 50,
          total: 0,
          totalPages: 0,
          hasMore: false,
          nextPage: null,
          prevPage: null
        },
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      };
    }
  },

  /**
   * Busca um ponto de coleta pelo ID
   * @param {number|string} id - ID do ponto de coleta
   * @returns {Promise<Object>} Dados do ponto de coleta
   */
  async getById(id) {
    try {
      if (!id) {
        throw new Error('ID do ponto de coleta não fornecido');
      }

      console.log(`[${new Date().toISOString()}] Buscando ponto de coleta com ID: ${id}`);
      
      const response = await api.get(`${BATCH_ENDPOINT}/${id}`);
      
      console.log(`[${new Date().toISOString()}] Ponto de coleta encontrado:`, response.data);
      
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao buscar ponto de coleta ${id}:`, error);
      
      if (error.response) {
        // Erro da API (4xx, 5xx)
        if (error.response.status === 404) {
          throw new Error('Ponto de coleta não encontrado');
        } else if (error.response.status === 401) {
          // Redireciona para login se não autenticado
          window.location.href = '/login';
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        } else {
          throw new Error(error.response.data?.message || `Erro ao buscar ponto de coleta: ${error.response.status}`);
        }
      } else if (error.request) {
        // Erro de rede
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      } else {
        // Erro ao fazer a requisição
        throw new Error(`Erro ao buscar ponto de coleta: ${error.message}`);
      }
    }
  },

  /**
   * Exclui um ponto de coleta pelo ID
   * @param {number|string} id - ID do ponto de coleta a ser excluído
   * @returns {Promise<Object>} Resposta da API
   */
  async delete(id) {
    try {
      if (!id) {
        throw new Error('ID do ponto de coleta não fornecido');
      }

      console.log(`[${new Date().toISOString()}] Excluindo ponto de coleta com ID: ${id}`);
      
      const response = await api.delete(`${BATCH_ENDPOINT}/${id}`);
      
      console.log(`[${new Date().toISOString()}] Ponto de coleta ${id} excluído com sucesso`);
      
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao excluir ponto de coleta ${id}:`, error);
      
      if (error.response) {
        // Erro da API (4xx, 5xx)
        if (error.response.status === 404) {
          throw new Error('Ponto de coleta não encontrado');
        } else if (error.response.status === 401) {
          // Redireciona para login se não autenticado
          window.location.href = '/login';
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        } else {
          throw new Error(error.response.data?.message || `Erro ao excluir ponto de coleta: ${error.response.status}`);
        }
      } else if (error.request) {
        // Erro de rede
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      } else {
        // Erro ao fazer a requisição
        throw new Error(`Erro ao excluir ponto de coleta: ${error.message}`);
      }
    }
  }
};

/**
 * Cria um novo ponto de coleta
 * @param {Object} pointData - Dados do ponto de coleta a ser criado
 * @returns {Promise<Object>} O ponto de coleta criado
 */
const create = async (pointData) => {
  try {
    console.log('Enviando dados para a API:', pointData);
    const response = await api.post(BATCH_ENDPOINT, pointData);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar ponto de coleta:', error);
    throw error;
  }
};

// Adiciona o método create ao objeto batchService
const collectionPointService = {
  ...batchService,
  create
};

export default collectionPointService;
