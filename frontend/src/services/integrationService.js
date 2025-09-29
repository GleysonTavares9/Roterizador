import api from './api';

const integrationService = {
  // Obtém as configurações de integração
  async getIntegrationSettings() {
    try {
      const response = await api.get('/integrations');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar configurações de integração:', error);
      throw error;
    }
  },

  // Atualiza as configurações de integração
  async updateIntegrationSettings(settings) {
    try {
      const response = await api.put('/integrations', settings);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar configurações de integração:', error);
      throw error;
    }
  },

  // Testa a conexão com o serviço de email
  async testEmailConnection(settings) {
    try {
      const response = await api.post('/integrations/test-email', settings);
      return response.data;
    } catch (error) {
      console.error('Erro ao testar conexão de email:', error);
      throw error;
    }
  },

  // Testa a chave da API do Google Maps
  async testGoogleMapsApiKey(apiKey) {
    try {
      const response = await api.post('/integrations/test-google-maps', { api_key: apiKey });
      return response.data;
    } catch (error) {
      console.error('Erro ao testar chave da API do Google Maps:', error);
      throw error;
    }
  }
};

export default integrationService;
