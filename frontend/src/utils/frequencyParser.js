// Mapeamento de dias da semana para números (1=segunda, 7=domingo)
const WEEK_DAY_NUMBERS = {
  'SEGUNDA': '1',
  'SEG': '1',
  'TERÇA': '2',
  'TERCA': '2',
  'TER': '2',
  'QUARTA': '3',
  'QUA': '3',
  'QUINTA': '4',
  'QUI': '4',
  'SEXTA': '5',
  'SEX': '5',
  'SABADO': '6',
  'SÁBADO': '6',
  'SAB': '6',
  'DOMINGO': '7',
  'DOM': '7'
};

// Mapeamento de códigos de frequência para nomes amigáveis
const FREQUENCY_NAMES = {
  'DIA': 'Diário',
  'SEM': 'Semanal',
  'QZ': 'Quinzenal',
  'MEN': 'Mensal',
  'BIM': 'Bimestral',
  'TRI': 'Trimestral'
};

// Função para extrair dias da semana de uma string (retorna string com números separados por vírgula)
export const extractWeekDays = (text) => {
  if (!text) return '';
  
  const days = new Set();
  const upperText = text.toUpperCase();
  
  // Verifica por dias específicos
  Object.entries(WEEK_DAY_NUMBERS).forEach(([day, number]) => {
    if (upperText.includes(day)) {
      days.add(number);
    }
  });
  
  // Verifica por intervalos
  if (upperText.includes('SEGUNDA A SEXTA') || upperText.includes('SEG A SEX')) {
    ['1', '2', '3', '4', '5'].forEach(day => days.add(day));
  }
  
  if (upperText.includes('SEGUNDA A SÁBADO') || upperText.includes('SEGUNDA A SABADO') || 
      upperText.includes('SEG A SÁB') || upperText.includes('SEG A SAB')) {
    ['1', '2', '3', '4', '5', '6'].forEach(day => days.add(day));
  }
  
  // Ordena os dias da semana (segunda=1 até domingo=7)
  const sortedDays = Array.from(days).sort((a, b) => parseInt(a) - parseInt(b));
  
  return sortedDays.join(','); // Retorna como string separada por vírgula
};

// Função para extrair semanas do mês (retorna string com números separados por vírgula)
export const extractWeeksOfMonth = (text) => {
  if (!text) return '';
  
  const weeks = new Set();
  const upperText = text.toUpperCase();
  
  // Verifica por padrões como "4º" ou "4ª"
  const weekMatch = upperText.match(/(\d+)[ºª]/);
  if (weekMatch) {
    const weekNum = parseInt(weekMatch[1]);
    if (weekNum >= 1 && weekNum <= 4) {
      weeks.add(weekNum.toString());
    }
  }
  
  // Verifica por semanas específicas
  if (weeks.size === 0) {
    if (upperText.includes('1') || upperText.includes('1º') || upperText.includes('1ª') || 
        upperText.includes('PRIMEIR')) {
      weeks.add('1');
    }
    if (upperText.includes('2') || upperText.includes('2º') || upperText.includes('2ª') || 
        upperText.includes('SEGUND')) {
      weeks.add('2');
    }
    if (upperText.includes('3') || upperText.includes('3º') || upperText.includes('3ª') || 
        upperText.includes('TERCEIR')) {
      weeks.add('3');
    }
    if (upperText.includes('4') || upperText.includes('4º') || upperText.includes('4ª') || 
        upperText.includes('QUART')) {
      weeks.add('4');
    }
  }
  if (upperText.includes('ÚLTIM') || upperText.includes('ULTIM')) {
    weeks.add('U');
  }
  
  // Se for quinzenal, define semanas 1,3 ou 2,4
  if (upperText.includes('QUINZENAL') || upperText.includes('QZ')) {
    if (upperText.includes('1') && upperText.includes('3')) {
      weeks.clear();
      weeks.add('1');
      weeks.add('3');
    } else if (upperText.includes('2') && upperText.includes('4')) {
      weeks.clear();
      weeks.add('2');
      weeks.add('4');
    } else if (weeks.size === 0) {
      // Padrão para quinzenal se não especificado
      weeks.add('1');
      weeks.add('3');
    }
  }
  
  // Se for semanal e não tiver semanas definidas, assume todas as semanas
  if ((upperText.includes('SEMANAL') || upperText.includes('SEM')) && weeks.size === 0) {
    weeks.add('1');
    weeks.add('2');
    weeks.add('3');
    weeks.add('4');
  }
  
  // Ordena as semanas
  const sortedWeeks = Array.from(weeks).sort((a, b) => {
    if (a === 'U') return 1;
    if (b === 'U') return -1;
    return parseInt(a) - parseInt(b);
  });
  
  return sortedWeeks.join(','); // Retorna como string separada por vírgula
};

// Função para extrair o tipo de frequência (retorna o nome amigável)
export const extractFrequencyType = (text) => {
  if (!text) return '';
  
  const upperText = text.toUpperCase();
  
  // Tenta encontrar pelo código
  for (const [code, name] of Object.entries(FREQUENCY_NAMES)) {
    if (upperText.startsWith(code) || upperText.includes(code)) {
      return name; // Retorna o nome amigável (ex: 'Semanal')
    }
  }
  
  // Se não encontrar pelo código, tenta pelo nome completo
  if (upperText.includes('DIÁRIO') || upperText.includes('DIARIO') || upperText.includes('DIA ')) {
    return 'Diário';
  } else if (upperText.includes('SEMANAL') || upperText.includes('SEM ')) {
    return 'Semanal';
  } else if (upperText.includes('QUINZENAL') || upperText.includes('QZ ')) {
    return 'Quinzenal';
  } else if (upperText.includes('MENSAL') || upperText.includes('MEN ')) {
    return 'Mensal';
  } else if (upperText.includes('BIMESTRAL') || upperText.includes('BIM ')) {
    return 'Bimestral';
  } else if (upperText.includes('TRIMESTRAL') || upperText.includes('TRI ')) {
    return 'Trimestral';
  }
  
  // Se não identificar, retorna vazio
  return '';
};

// Função principal para interpretar uma linha de frequência
export const interpretFrequency = (frequencyLine) => {
  if (!frequencyLine || typeof frequencyLine !== 'string') {
    return {
      frequency: '',
      days_of_week: '',
      weeks_of_month: '',
      original: '',
      type: 'OUTROS',
      code: '',
      description: '',
      weekDays: [],
      weekOfMonth: []
    };
  }
  
  const upperLine = frequencyLine.toUpperCase().trim();
  const result = {
    frequency: '',
    days_of_week: '',
    weeks_of_month: '',
    original: frequencyLine,
    type: 'OUTROS',
    code: '',
    description: '',
    weekDays: [],
    weekOfMonth: []
  };
  
  // Caso especial para o formato "MEN MENSAL 4º QUINTA" ou similar
  const mensalMatch = upperLine.match(/MEN\s*MENSAL\s*(\d+)[ºª]?\s*(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)/i);
  if (mensalMatch) {
    console.log('Formato "MEN MENSAL Xº DIA" detectado no parser:', mensalMatch[0]);
    const weekNumber = Math.min(parseInt(mensalMatch[1]) || 1, 4); // Garante que seja no máximo 4
    
    const dayMap = {
      'SEGUNDA': '1',
      'TERCA': '2', 'TERÇA': '2',
      'QUARTA': '3',
      'QUINTA': '4',
      'SEXTA': '5',
      'SABADO': '6', 'SÁBADO': '6',
      'DOMINGO': '7'
    };
    
    const dayOfWeek = dayMap[mensalMatch[2].toUpperCase()] || '1';
    
    result.frequency = 'Mensal';
    result.type = 'MENSAL';
    result.code = 'MEN';
    result.weekDays = [dayOfWeek];
    result.days_of_week = dayOfWeek;
    result.weekOfMonth = [weekNumber.toString()];
    result.weeks_of_month = weekNumber.toString();
    result.description = `Mensal - ${weekNumber}ª ${mensalMatch[2]}`;
    
    console.log('Resultado do parser para MEN MENSAL:', result);
    return result;
  }
  
  // Tenta extrair o código de frequência (primeiras 2-3 letras)
  const codeMatch = upperLine.match(/^([A-Z]{2,3})/);
  if (codeMatch) {
    result.code = codeMatch[1];
    
    // Define o tipo de frequência com base no código
    if (result.code === 'DIA') {
      result.frequency = 'Diário';
      result.type = 'DIÁRIO';
      result.weekDays = ['1','2','3','4','5','6','7'];
      result.days_of_week = '1,2,3,4,5,6,7';
    } else if (result.code === 'SEM') {
      result.frequency = 'Semanal';
      result.type = 'SEMANAL';
      // Por padrão, segunda a sexta para frequência semanal
      result.weekDays = ['1','2','3','4','5'];
      result.days_of_week = '1,2,3,4,5';
    } else if (result.code === 'QZ') {
      result.frequency = 'Quinzenal';
      result.type = 'QUINZENAL';
      // Por padrão, semanas 1 e 3 para frequência quinzenal
      result.weekOfMonth = ['1','3'];
      result.weeks_of_month = '1,3';
    } else if (result.code === 'MEN') {
      result.frequency = 'Mensal';
      result.type = 'MENSAL';
      // Por padrão, primeira semana para frequência mensal
      result.weekOfMonth = ['1'];
      result.weeks_of_month = '1';
      
      // Tenta extrair semana e dia da frequência mensal (ex: MEN MENSAL 4º QUINTA)
      const mensalMatch = upperLine.match(/MEN\s*MENSAL\s*(\d+)[ºª]?\s*(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)/i);
      if (mensalMatch) {
        const weekNumber = Math.min(parseInt(mensalMatch[1]) || 1, 4);
        const dayMap = {
          'SEGUNDA': '1',
          'TERCA': '2', 'TERÇA': '2',
          'QUARTA': '3',
          'QUINTA': '4',
          'SEXTA': '5',
          'SABADO': '6', 'SÁBADO': '6',
          'DOMINGO': '7'
        };
        const dayOfWeek = dayMap[mensalMatch[2].toUpperCase()] || '1';
        
        result.weekOfMonth = [weekNumber.toString()];
        result.weeks_of_month = weekNumber.toString();
        result.weekDays = [dayOfWeek];
        result.days_of_week = dayOfWeek;
        result.description = `Mensal - ${weekNumber}ª ${mensalMatch[2]}`;
      }
    } else if (result.code === 'BIM') {
      result.frequency = 'Bimestral';
      result.type = 'BIMESTRAL';
    } else if (result.code === 'TRI') {
      result.frequency = 'Trimestral';
      result.type = 'TRIMESTRAL';
    }
  }
  
  // Extrai dias da semana
  const days = [];
  Object.entries(WEEK_DAY_NUMBERS).forEach(([day, number]) => {
    if (upperLine.includes(day)) {
      days.push(number);
    }
  });
  
  // Verifica por intervalos
  if (upperLine.includes('SEGUNDA A SEXTA') || upperLine.includes('SEG A SEX')) {
    result.weekDays = ['1','2','3','4','5'];
    result.days_of_week = '1,2,3,4,5';
  } else if (upperLine.includes('SEGUNDA A SÁBADO') || upperLine.includes('SEGUNDA A SABADO') || 
             upperLine.includes('SEG A SAB')) {
    result.weekDays = ['1','2','3','4','5','6'];
    result.days_of_week = '1,2,3,4,5,6';
  } else if (days.length > 0) {
    result.weekDays = [...new Set(days)].sort();
    result.days_of_week = result.weekDays.join(',');
  }
  
  // Extrai semanas do mês
  const weeks = [];
  const weekMatch = upperLine.match(/(\d+)[ºª]/g) || [];
  weekMatch.forEach(w => {
    const num = w.match(/\d+/)[0];
    if (num >= 1 && num <= 4) weeks.push(num);
  });
  
  if (upperLine.includes('ULTIM')) {
    weeks.push('U');
  }
  
  if (weeks.length > 0) {
    result.weekOfMonth = [...new Set(weeks)].sort((a, b) => {
      if (a === 'U') return 1;
      if (b === 'U') return -1;
      return parseInt(a) - parseInt(b);
    });
    result.weeks_of_month = result.weekOfMonth.join(',');
  }
  
  // Define a descrição
  if (result.frequency === 'Mensal' && result.weekOfMonth.length > 0 && result.weekDays.length > 0) {
    const weekDesc = result.weekOfMonth.map(w => w === 'U' ? 'Última' : `${w}ª`).join('/');
    const dayDesc = result.weekDays.map(d => {
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return dayNames[parseInt(d) - 1];
    }).join('/');
    result.description = `Mensal - ${weekDesc} ${dayDesc}`;
  } else if (result.frequency) {
    result.description = result.frequency;
  } else {
    result.description = frequencyLine;
  }
  
  return result;
};

// Lista completa de frequências
export const FREQUENCY_OPTIONS = [
  'DIA DIARIO SEGUNDA A SEXTA',
  'DIA SEGUNDA A SABADO',
  'DIA DIARIO',
  'SEM SEMANAL SEGUNDA QUARTA E SEXTA',
  'SEM SEMANAL TERÇA E SEXTA FEIRA',
  'SEM SEMANAL TERCA E QUINTA',
  'SEM SEMANAL SEGUNDA FEIRA',
  'SEM SEMANAL TERCA FEIRA',
  'SEM SEMANAL SABADO',
  'SEM SEMANAL QUARTA FEIRA',
  'SEM SEMANAL QUINTA FEIRA',
  'SEM SEMANAL SEXTA FEIRA',
  'SEM SEMANAL SEGUNDA A SABADO',
  'SEM SEMANAL SEGUNDA E QUINTA',
  'SEM SEMANAL SEGUNDA E SEXTA',
  'SEM SEMANAL QUARTA E SEXTA',
  'SEM SEMANAL SEGUNDA A SEXTA',
  'SEM SEMANAL SEGUNDA E QUARTA',
  'SEM SEMANAL TERCA QUINTA E SABADO',
  'SEM TERÇA QUINTA E SEXTA',
  'SEM SEMANAL TERCA E SABADO',
  'SEM SEGUNDA TERÇA E SEXTA',
  'SEM SEMANAL SEGUNDA FEIRA QUINTA E SEXTA',
  'SEM SEMANAL TERCA QUARTA E SEXTA',
  'SEM SEGUNDA, TERÇA E QUINTA',
  'QZ QUINZENAL 2 E 4º SEGUNDA',
  'QZ QUINZENAL 1º E 3º QUINTA',
  'QZ QUINZENAL 1º E 3º SEGUNDA',
  'QZ QUINZENAL 2º E 4º TERÇA',
  'QZ QUINZENAL 1º E 3º TERÇA',
  'QZ QUINZENAL 2º E 4º QUINTA',
  'QZ QUINZENAL 2º E 4º QUARTA',
  'QZ QUINZENAL 1º E 3º QUARTA',
  'QZ QUINZENAL 1º E 3º SEXTA',
  'QZ QUINZENAL 2º E 4º SEXTA',
  'QZ QUINZENAL 1º E 3º SABADO',
  'MEN MENSAL 1º SEGUNDA',
  'MEN MENSAL 4º SEGUNDA',
  'MEN MENSAL 3º SEGUNDA',
  'MEN MENSAL 2º SEGUNDA',
  'MEN MENSAL 2º TERÇA',
  'MEN MENSAL 4º QUARTA',
  'MEN MENSAL 1ª QUINTA',
  'MEN MENSAL 3º QUINTA',
  'MEN MENSAL 4º TERÇA',
  'MEN MENSAL 1º QUARTA',
  'MEN MENSAL 3º QUARTA',
  'MEN MENSAL 1º TERÇA',
  'MEN MENSAL 2º QUARTA',
  'MEN MENSAL 2º QUINTA',
  'MEN MENSAL ULTIMA SEXTA',
  'MEN MENSAL 3º SEXTA FEIRA',
  'MEN MENSAL 1º SEXTA',
  'MEN MENSAL ULTIMA QUARTA',
  'MEN MENSAL 4º SEXTA',
  'MEN MENSAL 4º QUINTA',
  'MEN MENSAL 3º TERÇA',
  'MEN MENSAL ULTIMA SEGUNDA',
  'MEN MENSAL 2º SEXTA',
  'MEN MENSAL ULTIMA QUINTA',
  'MEN MENSAL ULTIMA TERÇA',
  'MEN MENSAL 4º SEXTA',
  'MEN MENSAL 3º SABADO',
  'BIM BIMESTRAL 1º SEGUNDA',
  'TRI TRIMESTRAL',
  'CONTRATO PRINCIPAL - SEM COLETA'
].map(interpretFrequency);

// Função para agrupar opções por tipo
export const groupOptionsByType = () => {
  const groups = {};
  
  FREQUENCY_OPTIONS.forEach(option => {
    if (!groups[option.type]) {
      groups[option.type] = [];
    }
    groups[option.type].push(option);
  });
  
  return groups;
};

// Função para formatar dias da semana como string
export const formatWeekDays = (days) => {
  if (!days || days.length === 0) return '';
  return days.join(', ');
};

// Função para formatar semanas do mês como string
export const formatWeeksOfMonth = (weeks) => {
  if (!weeks || weeks.length === 0) return '';
  return weeks.map(w => w === 'U' ? 'ÚLTIMA' : `${w}ª`).join(', ');
};
