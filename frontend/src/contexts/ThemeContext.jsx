import React, { createContext, useContext, useEffect, useState } from 'react';

// Criar o contexto do tema
const ThemeContext = createContext();

// Hook personalizado para usar o contexto do tema
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Verificar se há um tema salvo no localStorage
    const savedTheme = localStorage.getItem('theme');
    // Se não houver tema salvo, usar o tema do sistema
    if (!savedTheme) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return savedTheme;
  });

  // Efeito para aplicar o tema ao carregar o componente e quando o tema mudar
  useEffect(() => {
    const root = document.documentElement;
    
    // Aplicar o tema atual
    root.setAttribute('data-theme', theme);
    
    // Salvar a preferência do tema no localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Função para alternar entre os temas
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Valor do contexto
  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Componente para alternar o tema
export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button 
      onClick={toggleTheme} 
      className="theme-toggle"
      aria-label={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
    >
      {theme === 'light' ? (
        <i className="fas fa-moon"></i>
      ) : (
        <i className="fas fa-sun"></i>
      )}
    </button>
  );
};
