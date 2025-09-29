import api from './api';

const routeService = {
  // Busca o status de uma otimização específica
  async getOptimizationStatus(requestId) {
    try {
      const response = await api.get(`/optimize/${requestId}/status`, {
        timeout: 30000, // 30 segundos
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar status da otimização:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar status da otimização');
    }
  },
  
  // Método para compatibilidade com código existente
  async getAll() {
    console.warn('O método getAll() está obsoleto. Use getOptimizationStatus(requestId) em vez disso.');
    return [];
  },

  // Gera uma nova rota otimizada (versão assíncrona)
  async generateAsync(data, onProgress) {
    try {
      // Primeiro, inicia o processamento assíncrono
      const startResponse = await api.post('/optimize', data, {
        timeout: 30000, // 30 segundos para iniciar o processamento
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const { request_id: taskId } = startResponse.data;
      if (!taskId) {
        throw new Error('Não foi possível iniciar o processamento assíncrono');
      }

      // Função para verificar o status
      const checkStatus = async () => {
        try {
          const statusResponse = await api.get(`/optimize/${taskId}/status`, {
            timeout: 30000 // 30 segundos
          });
          
          const { status, result, progress: taskProgress, message } = statusResponse.data;
          
          // Atualiza o progresso
          if (onProgress && taskProgress !== undefined) {
            onProgress({
              status,
              progress: taskProgress,
              message: message || 'Processando...'
            });
          }

          // Verifica o status
          if (status === 'completed') {
            return { success: true, data: result };
          } else if (status === 'failed') {
            throw new Error(message || 'Falha ao processar a rota');
          } else {
            // Aguarda um pouco e tenta novamente
            await new Promise(resolve => setTimeout(resolve, 2000));
            return checkStatus();
          }
        } catch (error) {
          console.error('Erro ao verificar status:', error);
          throw error;
        }
      };

      // Inicia a verificação de status
      return await checkStatus();
      
    } catch (error) {
      console.error('Erro ao gerar rota assíncrona:', error);
      throw new Error(error.response?.data?.message || 'Erro ao processar a rota');
    }
  },

  // Gera uma nova rota otimizada (versão síncrona - mantida para compatibilidade)
  async generate(data, onProgress) {
    try {
      // Configuração da requisição
      const config = {
        timeout: 300000, // 5 minutos de timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Timeout': '300000'
        },
        onUploadProgress: (progressEvent) => {
          // Calcula o progresso do upload (0-50%)
          const progress = Math.round((progressEvent.loaded * 50) / (progressEvent.total || 1));
          if (onProgress) {
            onProgress({ status: 'uploading', progress });
          }
        },
        onDownloadProgress: (progressEvent) => {
          // Calcula o progresso do download (50-100%)
          const progress = 50 + Math.round((progressEvent.loaded * 50) / (progressEvent.total || 1));
          if (onProgress) {
            onProgress({ status: 'processing', progress });
          }
        }
      };

      // Faz a requisição síncrona
      const response = await api.post('/optimize', data, config);
      
      // Notifica conclusão
      if (onProgress) {
        onProgress({ status: 'completed', progress: 100 });
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao gerar rota:', error);
      if (onProgress) {
        onProgress({ 
          status: 'error', 
          error: error.response?.data?.message || 'Erro ao gerar rota',
          progress: 0
        });
      }
      throw error;
    }
  },
  
  // Verifica o status de um processamento assíncrono
  async checkStatus(taskId) {
    try {
const response = await api.get(`/optimize/${taskId}/status`, {
        timeout: 30000 // 30 segundos
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      throw new Error(error.response?.data?.message || 'Erro ao verificar status');
    }
  },
  
  // Cancela um processamento em andamento
  async cancelTask(taskId) {
    try {
      const response = await api.post(`/optimize/${taskId}/cancel`, {}, {
        timeout: 10000 // 10 segundos
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao cancelar tarefa:', error);
      throw new Error(error.response?.data?.message || 'Erro ao cancelar tarefa');
    }
  }
};

export default routeService;
