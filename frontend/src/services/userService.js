import api from './api';

const userService = {
  // Obtém os dados do usuário atual
  async getCurrentUser() {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      throw error;
    }
  },

  // Atualiza os dados do usuário
  async updateUser(userData) {
    try {
      const response = await api.put('/users/me', userData);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  },

  // Altera a senha do usuário
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.post('/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  }
};

export default userService;
