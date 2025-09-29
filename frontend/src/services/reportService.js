import api from './api';

// Função auxiliar para baixar arquivo
const downloadFile = (data, filename, contentType) => {
  const blob = new Blob([data], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const reportService = {
  /**
   * Gera relatório de rotas
   * @param {string} format - Formato do relatório (json, csv, excel)
   * @param {Date} startDate - Data de início para filtro (opcional)
   * @param {Date} endDate - Data de fim para filtro (opcional)
   */
  async generateRouteReport(format = 'json', startDate = null, endDate = null) {
    console.log('Gerando relatório de rotas com parâmetros:', { format, startDate, endDate });
    
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
    
    try {
      console.log('Fazendo requisição para:', `/reports/routes?${params.toString()}`);
      
      const response = await api.get(`/reports/routes?${params.toString()}`, {
        responseType: format === 'json' ? 'json' : 'blob'
      });
      
      console.log('Resposta recebida:', response);
      
      if (format === 'json') {
        return response.data;
      } else {
        // Para downloads de arquivo
        const contentDisposition = response.headers['content-disposition'] || '';
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const fileName = fileNameMatch ? fileNameMatch[1] : `relatorio_rotas_${new Date().toISOString().split('T')[0]}.${format}`;
        
        console.log('Iniciando download do arquivo:', fileName);
        downloadFile(response.data, fileName, response.headers['content-type']);
        
        return { success: true, fileName };
      }
    } catch (error) {
      console.error('Erro ao gerar relatório de rotas:', error);
      
      // Se for um erro de resposta da API, tenta extrair a mensagem de erro
      if (error.response) {
        console.error('Detalhes do erro:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        // Se for um blob (como um arquivo de erro), tenta ler o conteúdo
        if (error.response.data instanceof Blob) {
          try {
            const errorText = await error.response.data.text();
            console.error('Conteúdo do erro:', errorText);
            throw new Error(`Erro ao gerar relatório: ${errorText}`);
          } catch (blobError) {
            console.error('Erro ao ler blob de erro:', blobError);
          }
        }
        
        throw new Error(error.response.data?.detail || 'Erro ao gerar o relatório');
      }
      
      throw error;
    }
  },

  /**
   * Gera relatório de desempenho de veículos
   * @param {string} format - Formato do relatório (json, csv, excel)
   * @param {Date} startDate - Data de início para filtro (opcional)
   * @param {Date} endDate - Data de fim para filtro (opcional)
   */
  async generateVehiclePerformanceReport(format = 'json', startDate = null, endDate = null) {
    console.log('Gerando relatório de desempenho de veículos com parâmetros:', { format, startDate, endDate });
    
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
    
    try {
      console.log('Fazendo requisição para relatório de desempenho de veículos:', `/reports/vehicles/performance?${params.toString()}`);
      
      const response = await api.get(`/reports/vehicles/performance?${params.toString()}`, {
        responseType: format === 'json' ? 'json' : 'blob'
      });
      
      console.log('Resposta recebida:', response);
      
      if (format === 'json') {
        return response.data;
      } else {
        // Para downloads de arquivo
        const contentDisposition = response.headers['content-disposition'] || '';
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const fileName = fileNameMatch ? fileNameMatch[1] : `desempenho_veiculos_${new Date().toISOString().split('T')[0]}.${format}`;
        
        console.log('Iniciando download do arquivo:', fileName);
        downloadFile(response.data, fileName, response.headers['content-type']);
        
        return { success: true, fileName };
      }
    } catch (error) {
      console.error('Erro ao gerar relatório de desempenho de veículos:', error);
      
      if (error.response) {
        console.error('Detalhes do erro:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        if (error.response.data instanceof Blob) {
          try {
            const errorText = await error.response.data.text();
            console.error('Conteúdo do erro:', errorText);
            throw new Error(`Erro ao gerar relatório: ${errorText}`);
          } catch (blobError) {
            console.error('Erro ao ler blob de erro:', blobError);
          }
        }
        
        throw new Error(error.response.data?.detail || 'Erro ao gerar o relatório de desempenho de veículos');
      }
      
      throw error;
    }
  },

  /**
   * Gera relatório de histórico de coletas
   * @param {string} format - Formato do relatório (json, csv, excel)
   * @param {Date} startDate - Data de início para filtro (opcional)
   * @param {Date} endDate - Data de fim para filtro (opcional)
   */
  async generateCollectionHistoryReport(format = 'json', startDate = null, endDate = null) {
    console.log('Gerando relatório de histórico de coletas com parâmetros:', { format, startDate, endDate });
    
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (startDate) params.append('start_date', startDate.toISOString().split('T')[0]);
    if (endDate) params.append('end_date', endDate.toISOString().split('T')[0]);
    
    try {
      console.log('Fazendo requisição para relatório de histórico de coletas:', `/reports/collections/history?${params.toString()}`);
      
      const response = await api.get(`/reports/collections/history?${params.toString()}`, {
        responseType: format === 'json' ? 'json' : 'blob'
      });
      
      console.log('Resposta recebida:', response);
      
      if (format === 'json') {
        return response.data;
      } else {
        // Para downloads de arquivo
        const contentDisposition = response.headers['content-disposition'] || '';
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const fileName = fileNameMatch ? fileNameMatch[1] : `historico_coletas_${new Date().toISOString().split('T')[0]}.${format}`;
        
        console.log('Iniciando download do arquivo:', fileName);
        downloadFile(response.data, fileName, response.headers['content-type']);
        
        return { success: true, fileName };
      }
    } catch (error) {
      console.error('Erro ao gerar relatório de histórico de coletas:', error);
      
      if (error.response) {
        console.error('Detalhes do erro:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        if (error.response.data instanceof Blob) {
          try {
            const errorText = await error.response.data.text();
            console.error('Conteúdo do erro:', errorText);
            throw new Error(`Erro ao gerar relatório: ${errorText}`);
          } catch (blobError) {
            console.error('Erro ao ler blob de erro:', blobError);
          }
        }
        
        throw new Error(error.response.data?.detail || 'Erro ao gerar o relatório de histórico de coletas');
      }
      
      throw error;
    }
  }
};

export default reportService;
