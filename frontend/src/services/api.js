import axios from 'axios';
import { getToken } from './tokenService';
import authService from './authService';

// Cria uma instância do axios
// Define a URL base da API
let baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Remove barras finais múltiplas e espaços em branco
baseURL = baseURL.trim().replace(/\/+$/, '');

// Se a URL já contiver /api/v1, não adiciona novamente
const apiBaseURL = baseURL.includes('/api/v1') ? baseURL : `${baseURL}/api/v1`;

// Timeout global de 30 minutos (em milissegundos)
const GLOBAL_TIMEOUT = 30 * 60 * 1000; // 30 minutos

console.log('[api.js] Configurando API com baseURL:', apiBaseURL);

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false, // Desativa o envio de credenciais para evitar problemas de CORS
  timeout: GLOBAL_TIMEOUT, // 30 minutos de timeout global
});

// Flag para evitar múltiplas renovações de token simultâneas
let isRefreshing = false;
let failedQueue = [];

// Adiciona o método optimizeRoutes à instância do axios
api.optimizeRoutes = async function(data, onProgress) {
    try {
        console.log('[API] Enviando requisição de otimização...', {
            points: data.points?.length || 0,
            vehicles: data.vehicles?.length || 0
        });
        
        // Configuração da requisição
        const requestConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${getToken()}`,
                'X-Request-Timeout': String(GLOBAL_TIMEOUT)
            },
            withCredentials: false,
            timeout: GLOBAL_TIMEOUT
        };
        
        // Log da URL completa para debug
        console.log('[API] URL completa:', `${api.defaults.baseURL}/optimize`);
        
        // Se não houver callback de progresso, faz uma requisição normal
        if (!onProgress) {
            const response = await api.post('/optimize', data, requestConfig);
            console.log('[API] Resposta recebida com sucesso');
            return response.data;
        }
        
        // Se houver callback de progresso, usa o novo endpoint assíncrono
        console.log('[API] Iniciando otimização assíncrona...');
        const startResponse = await api.post('/optimize', data, requestConfig);
        const requestId = startResponse.data.request_id;
        
        if (!requestId) {
            const errorMsg = 'Não foi possível obter o ID da requisição de otimização';
            console.error('[API]', errorMsg, { response: startResponse.data });
            throw new Error(errorMsg);
        }
        
        console.log(`[API] Otimização assíncrona iniciada com ID: ${requestId}`);
        
        // Função para verificar o status
        const checkStatus = async () => {
            try {
                console.log(`[API] Verificando status da otimização ${requestId}...`);
                const statusResponse = await api.get(`/optimize/${requestId}/status`, {
                    headers: requestConfig.headers,
                    timeout: 30000 // Timeout menor para as verificações de status
                });
                
                console.log(`[API] Resposta de status recebida:`, statusResponse.data);
                const statusData = statusResponse.data;
                
                // Chama o callback de progresso com os dados atualizados
                if (onProgress) {
                    console.log(`[API] Atualizando progresso:`, statusData);
                    onProgress({
                        ...statusData,
                        requestId: requestId,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Se ainda estiver processando, agenda a próxima verificação
                if (statusData.status === 'processing' || statusData.status === 'pending') {
                    console.log(`[API] Otimização em andamento (${statusData.progress || 0}%)`);
                    return new Promise(resolve => {
                        setTimeout(() => {
                            checkStatus().then(resolve);
                        }, 5000); // Verifica a cada 5 segundos para reduzir carga no servidor
                    });
                }
                
                // Se terminou, retorna o resultado
                if (statusData.status === 'completed') {
                    console.log('[API] Otimização concluída com sucesso!');
                    return statusData.result || statusData;
                }
                
                // Se houve erro, lança exceção
                if (statusData.status === 'error' || statusData.status === 'failed') {
                    const errorMsg = statusData.error || 'Erro durante a otimização';
                    console.error('[API] Erro na otimização:', errorMsg);
                    throw new Error(errorMsg);
                }
                
                // Estado inesperado
                const unexpectedStatus = `Status inesperado: ${statusData.status}`;
                console.error('[API]', unexpectedStatus);
                throw new Error(unexpectedStatus);
                
            } catch (error) {
                const errorDetails = {
                    message: error.message,
                    code: error.code,
                    status: error.response?.status,
                    data: error.response?.data,
                    config: error.config?.url ? {
                        url: error.config.url,
                        method: error.config.method,
                        timeout: error.config.timeout
                    } : undefined
                };
                
                console.error('[API] Erro ao verificar status da otimização:', errorDetails);
                
                if (onProgress) {
                    onProgress({
                        status: 'error',
                        error: error.message,
                        requestId: requestId,
                        timestamp: new Date().toISOString(),
                        details: errorDetails
                    });
                }
                
                throw error;
            }
        };
        
        // Inicia a verificação de status e retorna uma Promise
        return checkStatus();
        
    } catch (error) {
        console.error('[API] Erro na requisição de otimização:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            data: error.response?.data
        });
        
        // Melhora as mensagens de erro para o usuário
        if (error.code === 'ECONNABORTED') {
            throw new Error('A requisição demorou muito para ser processada. Tente novamente mais tarde.');
        }
        
        if (error.response?.data?.detail) {
            throw new Error(error.response.data.detail);
        }
        
        throw error;
    }
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Adiciona um interceptor para incluir o token de autenticação em cada requisição
api.interceptors.request.use(
  async (config) => {
    // Não adiciona token para rotas públicas
    const publicEndpoints = ['/auth/token', '/auth/refresh', '/auth/forgot-password', '/auth/register'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url.endsWith(endpoint));
    
    if (isPublicEndpoint) {
      // Remove o header de autorização para rotas públicas
      delete config.headers['Authorization'];
      return config;
    }
    
    // Verifica se o token está expirado e tenta renovar se necessário
    const isTokenValid = await authService.checkAndRenewToken();
    
    if (!isTokenValid) {
      return Promise.reject(new Error('Sessão expirada. Por favor, faça login novamente.'));
    }
    
    // Obtém o token do serviço de autenticação
    const token = authService.getToken();
    
    // Se o token existir, adiciona o token de autenticação em todas as requisições, exceto nas rotas públicas
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log de requisição em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase() || 'GET'} ${config.url}`, {
        params: config.params,
        data: config.data,
        headers: config.headers
      });
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Erro no interceptor de requisição:', error);
    return Promise.reject(error);
  }
);

// Adiciona um interceptor para tratar erros de resposta
api.interceptors.response.use(
  (response) => {
    // Log de resposta em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Resposta ${response.status} de ${response.config?.url}`, {
        data: response.data,
        headers: response.headers
      });
    }
    return response;
  },
  async (error) => {
    // Configuração original da requisição
    const originalRequest = error.config;
    
    // Se for um erro de rede
    if (error.message === 'Network Error') {
      console.error('[API] Erro de rede. Verifique sua conexão com a internet.');
      return Promise.reject({
        message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
        isNetworkError: true
      });
    }
    
    // Se for um erro de timeout
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Timeout da requisição', originalRequest?.url);
      return Promise.reject({
        message: 'A requisição demorou muito para ser processada. Tente novamente mais tarde.',
        isTimeout: true
      });
    }
    
    // Se não houver resposta do servidor
    if (!error.response) {
      console.error('[API] Sem resposta do servidor', error);
      return Promise.reject({
        message: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.',
        isServerError: true
      });
    }
    
    const { status, data } = error.response;
    let errorMessage = 'Ocorreu um erro ao processar sua solicitação';
    
    // Tratamento de erros específicos
    switch (status) {
      case 400:
        errorMessage = data.detail || data.message || 'Dados inválidos fornecidos';
        break;
      case 401:
        // Se for erro de autenticação e não for uma tentativa de refresh
        if (originalRequest.url.includes('/auth/refresh')) {
          // Se falhar o refresh, faz logout
          authService.logout();
          return Promise.reject({ 
            message: 'Sua sessão expirou. Por favor, faça login novamente.',
            isUnauthorized: true 
          });
        }
        
        // Se não tiver tentado renovar o token ainda
        if (!originalRequest._retry) {
          originalRequest._retry = true;
          
          // Se já estiver renovando, adiciona a requisição na fila
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
            .then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch(err => {
              return Promise.reject(err);
            });
          }
          
          // Tenta renovar o token
          isRefreshing = true;
          
          try {
            const token = authService.getToken();
            if (!token) throw new Error('Nenhum token disponível para renovação');
            
            const response = await api.post('/auth/refresh');
            const { access_token: newToken } = response.data;
            
            if (!newToken) {
              throw new Error('Token de renovação inválido');
            }
            
            // Atualiza o token
            authService.setAuthToken(newToken);
            
            // Reprocessa a fila de requisições pendentes
            processQueue(null, newToken);
            
            // Tenta a requisição original novamente
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            console.error('Erro ao renovar token:', refreshError);
            processQueue(refreshError, null);
            authService.logout();
            return Promise.reject({
              message: 'Sua sessão expirou. Por favor, faça login novamente.',
              isUnauthorized: true
            });
          } finally {
            isRefreshing = false;
          }
        }
        
        // Se já tentou renovar e falhou novamente
        authService.logout();
        return Promise.reject({ 
          message: 'Sua sessão expirou. Por favor, faça login novamente.',
          isUnauthorized: true 
        });
      
      case 403:
        errorMessage = 'Você não tem permissão para acessar este recurso';
        break;
      case 404:
        errorMessage = 'Recurso não encontrado';
        break;
      case 409:
        errorMessage = data.detail || data.message || 'Conflito na operação solicitada';
        break;
      case 422:
        errorMessage = data.detail || data.message || 'Erro de validação. Verifique os dados fornecidos.';
        break;
      case 500:
        errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        break;
      default:
        errorMessage = data.message || data.detail || `Erro ${status}: ${error.response.statusText}`;
    }
    
    // Se for uma resposta de blob com erro, converte para texto
    if (originalRequest?.responseType === 'blob' && data instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          let errorData;
          try {
            errorData = JSON.parse(reader.result);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch (e) {
            console.error('Erro ao processar resposta de blob:', e);
          }
          reject({
            message: errorMessage,
            status,
            data: errorData || data,
            isBlobError: true
          });
        };
        reader.onerror = () => {
          reject({
            message: 'Erro ao processar a resposta do servidor',
            status,
            isBlobError: true
          });
        };
        reader.readAsText(data);
      });
    }
    
    // Rejeita com a mensagem de erro formatada
    return Promise.reject({
      message: errorMessage,
      status,
      data,
      isApiError: true
    });
  }
);

export default api;
