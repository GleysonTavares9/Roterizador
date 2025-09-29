/**
 * Handles API errors consistently across the application
 * @param {Error} error - The error object from the API call
 * @param {string} defaultMessage - Default error message to show if no specific message is found
 * @returns {string} - User-friendly error message
 */
export const handleApiError = (error, defaultMessage = 'Ocorreu um erro inesperado') => {
  console.error('API Error:', error);
  
  // Handle network errors
  if (!error.response) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
  }
  
  const { status, data } = error.response;
  
  // Handle different HTTP status codes
  switch (status) {
    case 400:
      return data.message || 'Requisição inválida. Verifique os dados e tente novamente.';
      
    case 401:
      // Don't show a message for 401 as we'll handle redirects in the interceptor
      return 'Sessão expirada. Por favor, faça login novamente.';
      
    case 403:
      return 'Você não tem permissão para acessar este recurso.';
      
    case 404:
      return 'Recurso não encontrado.';
      
    case 422:
      // Handle validation errors
      if (data.detail && Array.isArray(data.detail)) {
        return data.detail.map(err => `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`).join('\n');
      }
      return 'Dados inválidos. Verifique os campos do formulário.';
      
    case 500:
      return 'Erro interno do servidor. Por favor, tente novamente mais tarde.';
      
    case 503:
      return 'Serviço indisponível no momento. Por favor, tente novamente mais tarde.';
      
    default:
      return data?.message || data?.detail || defaultMessage;
  }
};

/**
 * Extracts error message from different error response formats
 * @param {any} error - The error object or response data
 * @returns {string} - Extracted error message
 */
export const extractErrorMessage = (error) => {
  if (!error) return 'Erro desconhecido';
  
  // Handle string errors
  if (typeof error === 'string') return error;
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message || 'Ocorreu um erro';
  }
  
  // Handle API response objects
  if (error.response) {
    const { data } = error.response;
    if (data) {
      if (typeof data === 'string') return data;
      if (data.message) return data.message;
      if (data.detail) return data.detail;
      if (Array.isArray(data)) return data.join('\n');
    }
    return error.response.statusText || 'Erro na requisição';
  }
  
  // Handle objects with message property
  if (error.message) {
    return error.message;
  }
  
  // Handle objects with error property
  if (error.error) {
    return typeof error.error === 'string' 
      ? error.error 
      : JSON.stringify(error.error);
  }
  
  // Default fallback
  return 'Ocorreu um erro inesperado';
};
