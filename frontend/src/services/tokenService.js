// Serviço para gerenciar o token de autenticação
export const getToken = () => {
  return localStorage.getItem('token');
};

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const clearToken = () => {
  localStorage.removeItem('token');
};

// Callback para quando o token for atualizado
let onTokenRefreshed = null;

export const setOnTokenRefreshed = (callback) => {
  onTokenRefreshed = callback;
};

export const notifyTokenRefreshed = (newToken) => {
  if (onTokenRefreshed) {
    onTokenRefreshed(newToken);
  }
};
