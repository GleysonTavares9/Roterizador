import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { interpretFrequency } from '../utils/frequencyParser';
import {
  Card,
  Button,
  Form,
  Alert,
  Spinner,
  Row,
  Col,
  Table,
  Badge,
  ProgressBar,
  Modal
} from 'react-bootstrap';
import {
  FaCheck,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaInfoCircle,
  FaSpinner,
  FaUpload,
  FaCheckCircle,
  FaFileExcel,
  FaFileCsv,
  FaFileAlt,
  FaTrash,
  FaMapMarkedAlt,
  FaSave,
  FaTimes,
  FaFileImport,
  FaDownload as FaFileDownload,
  FaSearchLocation,
  FaMapMarkerAlt
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import api from '../services/api';
import collectionPointService from '../services/collectionPointService';

// Funções de normalização de endereço
const normalizeAddress = (address) => {
  if (!address) return '';
  
  // Remove caracteres especiais e formatações comuns
  return address
    .replace(/(\d+)\.(\d+)/g, '$1$2')  // Remove ponto decimal em números
    .replace(/[,\#\.\-;]+/g, ' ')     // Remove caracteres especiais comuns
    .replace(/\s+/g, ' ')               // Remove múltiplos espaços
    .replace(/(\d+)\s+(\d+)/g, '$1$2') // Remove espaços entre números
    .replace(/\b(?:rua|av|avenida|r\.|av\.?)\b/gi, '') // Remove tipos de via
    .replace(/\b(?:n°?|numero?|nr\.?)\s*\d*/gi, '') // Remove números de endereço
    .trim();
};

const formatSearchAddress = (address, city, state, includeNumber = true) => {
  if (!address) return '';
  
  let formatted = address
    .replace(/(\d+)\.(\d+)/g, '$1$2')  // Remove ponto decimal em números
    .replace(/[,\#\.\-;]+/g, ' ')     // Remove caracteres especiais
    .replace(/\s+/g, ' ')               // Remove múltiplos espaços
    .trim();
  
  // Extrai o número do endereço se existir
  const numberMatch = formatted.match(/(\d+[a-zA-Z]?)/);
  const number = numberMatch ? numberMatch[0] : '';
  
  // Remove o número do endereço principal
  const street = formatted.replace(/\d+.*$/, '').trim();
  
  // Monta o endereço de busca
  let searchAddress = [];
  if (includeNumber && number) {
    searchAddress.push(`${street} ${number}`.trim());
  } else if (street) {
    searchAddress.push(street);
  }
  
  if (city) searchAddress.push(city);
  if (state) searchAddress.push(state);
  
  return searchAddress.join(', ');
};

// Configuração do mapa
const defaultCenter = [-23.5505, -46.6333]; // São Paulo
const defaultZoom = 12;

const GeocodeUploadPage = () => {
  const navigate = useNavigate();

  // Estados do componente
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [data, setData] = useState([]);
  const [progress, setProgress] = useState(0);
  const [columnMapping, setColumnMapping] = useState({
    id: '', // Novo campo para o ID único
    name: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    frequency: '',
    reference: '',
    latitude: '',
    longitude: ''
  });
  const [headers, setHeaders] = useState([]);
  const [geocodingStatus, setGeocodingStatus] = useState('idle'); // idle, geocoding, done, error

  // Função para lidar com o upload de arquivo
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Verifica o tipo do arquivo
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setMessage({
        type: 'danger',
        title: 'Tipo de arquivo inválido',
        text: 'Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.',
        showClose: true
      });
      return;
    }

    // Verifica o tamanho do arquivo (máx. 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setMessage({
        type: 'danger',
        title: 'Arquivo muito grande',
        text: 'O arquivo deve ter no máximo 5MB.',
        showClose: true
      });
      return;
    }

    setFile(file);
    setMessage({
      type: 'success',
      title: 'Arquivo carregado',
      text: `Arquivo '${file.name}' carregado com sucesso!`,
      showClose: true
    });

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Verifica se há planilhas
        if (workbook.SheetNames.length === 0) {
          setMessage({
            type: 'warning',
            title: 'Arquivo sem planilhas',
            text: 'O arquivo não contém nenhuma planilha.',
            showClose: true
          });
          return;
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          setMessage({
            type: 'warning',
            title: 'Dados insuficientes',
            text: 'O arquivo está vazio ou não contém dados suficientes.',
            showClose: true
          });
          return;
        }

        const headers = jsonData[0];
        setHeaders(headers);

        // Tenta detectar automaticamente as colunas comuns
        const detectedColumns = {};
        
        console.log('Cabeçalhos encontrados no arquivo:', headers);
        
        headers.forEach((header, index) => {
          const headerLower = header.toString().toLowerCase().trim();

          // Mapeia os cabeçalhos mais comuns para os campos correspondentes
          if (/id|identificador|código/i.test(headerLower)) {
            detectedColumns.id = index;
          } else if (/nome|name|ponto|local/i.test(headerLower)) {
            detectedColumns.name = index;
          } else if (/endereço|endereco|logradouro|rua|av|avenida|address/i.test(headerLower)) {
            detectedColumns.address = index;
          } else if (/bairro|bairro|neighborhood|district/i.test(headerLower)) {
            detectedColumns.neighborhood = index;
          } else if (/cidade|city|município|municipio/i.test(headerLower)) {
            detectedColumns.city = index;
          } else if (/estado|uf|state/i.test(headerLower)) {
            detectedColumns.state = index;
          } else if (/cep|zip|zipcode/i.test(headerLower)) {
            detectedColumns.zip_code = index;
          } else if (/telefone|phone|fone|contato/i.test(headerLower)) {
            detectedColumns.phone = index;
          } else if (/referência|referencia|reference|ponto de referência/i.test(headerLower)) {
            detectedColumns.reference = index;
          } else if (/frequência|frequencia|frequency|periodicidade/i.test(headerLower)) {
            detectedColumns.frequency = index;
          } else if (/latitude|lat/i.test(headerLower)) {
            detectedColumns.latitude = index;
          } else if (/longitude|long|lng/i.test(headerLower)) {
            detectedColumns.longitude = index;
          }
        });

        // Atualiza o mapeamento de colunas com as detecções
        console.log('Colunas detectadas automaticamente:', detectedColumns);
        
        const newColumnMapping = {
          ...columnMapping,
          ...detectedColumns
        };
        
        console.log('Novo mapeamento de colunas:', newColumnMapping);
        
        setColumnMapping(newColumnMapping);

        setMessage({
          type: 'success',
          title: 'Arquivo processado',
          text: `${jsonData.length - 1} registros encontrados no arquivo.`,
          showClose: true
        });

      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        setMessage({
          type: 'danger',
          title: 'Erro no processamento',
          text: 'Não foi possível processar o arquivo.',
          details: 'Verifique se o arquivo está no formato correto e tente novamente.',
          showClose: true
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Função para normalizar o endereço
  const normalizeAddress = (address) => {
    if (!address) return '';
    return address
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Remove múltiplos espaços
      .trim();
  };

  // Função para formatar o endereço para busca
  const formatSearchAddress = (address, city, state, includeNumber = true) => {
    if (!address) return '';
    
    // Remove acentos e caracteres especiais, converte para minúsculas
    let normalized = address
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove vírgulas e pontos no final
    normalized = normalized.replace(/[.,;:]$/, '').trim();
    
    // Remove números se não devemos incluí-los
    if (!includeNumber) {
      normalized = normalized.replace(/\d+/g, '').trim();
    }
    
    return normalized;
  };

  // Função para processar a periodicidade e extrair dias da semana e semanas do mês
  const processFrequency = (frequencyStr, daysOfWeekStr = '') => {
    // Se a frequência for vazia, retorna valores vazios
    if (!frequencyStr || frequencyStr === '-') {
      return { 
        frequency: '', 
        days_of_week: '', 
        weeks_of_month: '' 
      };
    }
    
    const upperFreq = frequencyStr.toString().toUpperCase().trim();
    
    // Caso especial para o formato "MEN MENSAL 4º QUINTA" ou similar
    const mensalMatch = upperFreq.match(/MEN\s*MENSAL\s*(\d+)[ºª]?\s*(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)/i);
    if (mensalMatch) {
      console.log('Formato "MEN MENSAL Xº DIA" detectado:', mensalMatch[0]);
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
      
      console.log('Processando MEN MENSAL - Semana:', weekNumber, 'Dia:', dayOfWeek);
      
      // Garante que weeks_of_month seja sempre uma string não vazia para frequência mensal
      const weeksOfMonth = weekNumber.toString();
      
      return {
        frequency: 'Mensal',
        days_of_week: dayOfWeek,
        weeks_of_month: weeksOfMonth,
        weekDays: [dayOfWeek],
        weekOfMonth: [weeksOfMonth]
      };
    }
    
    // Se for um número, assume que é um dia da semana (para compatibilidade)
    if (!isNaN(frequencyStr) && frequencyStr !== '') {
      const dayOfWeek = frequencyStr.toString().trim();
      return {
        frequency: 'Mensal',
        days_of_week: dayOfWeek,
        weeks_of_month: '1' // Semana 1 por padrão para frequência mensal
      };
    }
    
    try {
      // Verifica se é uma frequência mensal
      const isMonthly = upperFreq.includes('MENSAL');
      const hasDays = daysOfWeekStr && daysOfWeekStr !== '-';
      
      // Se for mensal e tiver dias da semana, mas não tiver semanas definidas
      if (isMonthly && hasDays) {
        console.log('Frequência mensal com dias da semana detectada');
        // Extrai apenas os números dos dias da semana (1-7)
        const days = daysOfWeekStr
          .split(',')
          .map(d => d.trim())
          .filter(d => d >= 1 && d <= 7)
          .join(',');
          
        // Tenta extrair a semana do mês do texto original
        const weekMatch = upperFreq.match(/(\d+)[ºª]|ÚLTIM[OA]/i);
        const weekNumber = weekMatch ? 
          (weekMatch[1] ? Math.min(parseInt(weekMatch[1]), 4) : 4) : 
          1; // Valor padrão é 1 se não encontrar
          
        // Garante que weeks_of_month seja sempre uma string não vazia para frequência mensal
        const weeksOfMonth = weekNumber.toString();
          
        return {
          frequency: 'Mensal',
          days_of_week: days,
          weeks_of_month: weeksOfMonth,
          weekDays: days.split(',').filter(Boolean),
          weekOfMonth: [weeksOfMonth]
        };
      }
      
      // Verifica se tem formato de semana ordinal (1º, 2º, 3º, 4º, Último)
      const weekOrdinalMatch = upperFreq.match(/(\d+)º|ÚLTIM[OA]/i);
      const weekDayMatch = upperFreq.match(/(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)/i);
      
      if (weekOrdinalMatch && weekDayMatch) {
        console.log('Formato com semana ordinal e dia da semana detectado');
        const weekNumber = weekOrdinalMatch[1] ? 
          (parseInt(weekOrdinalMatch[1]) <= 4 ? weekOrdinalMatch[1] : '4') : '4';
          
        const dayMap = {
          'SEGUNDA': '1',
          'TERCA': '2', 'TERÇA': '2',
          'QUARTA': '3',
          'QUINTA': '4',
          'SEXTA': '5',
          'SABADO': '6', 'SÁBADO': '6',
          'DOMINGO': '7'
        };
        
        const dayOfWeek = dayMap[weekDayMatch[1].toUpperCase()] || '';
        
        return {
          frequency: 'Mensal',
          days_of_week: dayOfWeek,
          weeks_of_month: weekNumber
        };
      }
      
      // Interpreta a frequência usando a função atualizada
      const interpreted = interpretFrequency(frequencyStr.toString().trim());
      
      console.log('Frequência interpretada:', {
        original: frequencyStr,
        interpretado: interpreted,
        daysOfWeekStr
      });
      
      // Usa os dias da semana já processados pelo frequencyParser ou do parâmetro
      let daysOfWeek = '';
      if (interpreted.weekDays && interpreted.weekDays.length > 0) {
        daysOfWeek = interpreted.weekDays.join(',');
      } else if (daysOfWeekStr && daysOfWeekStr !== '-') {
        daysOfWeek = daysOfWeekStr
          .split(',')
          .map(d => d.trim())
          .filter(d => d >= 1 && d <= 7)
          .join(',');
      } else if (interpreted.days_of_week) {
        // Tenta usar os dias da semana diretamente se disponíveis
        daysOfWeek = interpreted.days_of_week;
      }
      
      // Processa as semanas do mês
      let weeksOfMonth = '';
      
      console.log('Processando semanas do mês:', {
        hasWeekOfMonth: !!(interpreted.weekOfMonth && interpreted.weekOfMonth.length > 0),
        weekOfMonth: interpreted.weekOfMonth,
        hasWeeksOfMonth: !!interpreted.weeks_of_month,
        weeksOfMonthValue: interpreted.weeks_of_month,
        isMonthly: interpreted.frequency === 'Mensal',
        hasDays: !!daysOfWeek,
        originalFrequency: frequencyStr
      });
      
      // Tenta extrair a semana do mês do texto original se disponível
      const weekMatch = frequencyStr.toString().toUpperCase().match(/(\d+)[ºª]|ÚLTIM[OA]/i);
      const weekNumber = weekMatch ? 
        (weekMatch[1] ? Math.min(parseInt(weekMatch[1]), 4) : 4) : // Converte 'Último' para 4
        null;
      
      // Prioridade 1: Usa weekOfMonth do interpretado
      if (interpreted.weekOfMonth && interpreted.weekOfMonth.length > 0) {
        weeksOfMonth = interpreted.weekOfMonth
          .map(w => w === 'U' ? '4' : w) // Converte 'U' para '4'
          .filter(w => w >= 1 && w <= 4) // Filtra valores válidos
          .sort((a, b) => parseInt(a) - parseInt(b)) // Ordena
          .join(',');
      } 
      // Prioridade 2: Usa weeks_of_month direto do interpretado
      else if (interpreted.weeks_of_month) {
        weeksOfMonth = interpreted.weeks_of_month;
      }
      // Prioridade 3: Usa a semana extraída do texto original
      else if (weekNumber !== null) {
        weeksOfMonth = weekNumber.toString();
      }
      // Prioridade 4: Para frequência mensal com dias definidos, usa semana 1 como padrão
      else if (interpreted.frequency === 'Mensal' && daysOfWeek) {
        weeksOfMonth = '1';
      }
      
      console.log('Semanas do mês finais:', weeksOfMonth);
      
      // Retorna os campos no formato esperado pelo backend
      return {
        frequency: interpreted.frequency || frequencyStr.toString().trim(),
        days_of_week: daysOfWeek,
        weeks_of_month: weeksOfMonth
      };
    } catch (error) {
      console.warn('Erro ao interpretar periodicidade:', frequencyStr, error);
      // Em caso de erro, retorna os campos vazios
      return {
        frequency: frequencyStr.toString().trim(),
        days_of_week: '',
        weeks_of_month: ''
      };
    }
  };

  // Função para mapear colunas do arquivo enviado
  const handleColumnMapping = () => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Pular o cabeçalho e mapear os dados
        const mappedData = jsonData.slice(1).map((row, index) => {
          const item = {};
          let hasId = false;
          let hasFrequency = false;

          // Primeiro, mapeia todos os campos normais
          console.log('Mapeando colunas para a linha:', index + 2, 'Dados:', row);
          console.log('Mapeamento atual:', columnMapping);
          
          // Log detalhado para cada coluna mapeada
          const columnMappingDetails = {};
          Object.entries(columnMapping).forEach(([key, colIndex]) => {
            columnMappingDetails[key] = {
              columnIndex: colIndex,
              value: row[colIndex],
              type: typeof row[colIndex],
              isSet: colIndex !== '' && row[colIndex] !== undefined && row[colIndex] !== ''
            };
          });
          console.log('Detalhes do mapeamento:', columnMappingDetails);
          
          Object.entries(columnMapping).forEach(([key, colIndex]) => {
            if (colIndex !== '' && row[colIndex] !== undefined && row[colIndex] !== '') {
              // Se for o campo de periodicidade, marca para processar depois
              if (key === 'frequency') {
                hasFrequency = true;
              }
              // Converter para número se for latitude ou longitude
              else if (key === 'latitude' || key === 'longitude') {
                const numValue = parseFloat(row[colIndex].toString().replace(',', '.'));
                item[key] = isNaN(numValue) ? null : numValue;
              } else if (key === 'id') {
                // Se for o campo ID, garantir que seja uma string
                item[key] = row[colIndex].toString().trim();
                hasId = true;
              } else {
                item[key] = row[colIndex];
              }
            }
          });

          // Log dos dados do item antes de processar a frequência
          console.log('Item antes de processar frequência:', {
            index,
            id: item.id,
            address: item.address,
            city: item.city,
            hasFrequency,
            columnMapping: columnMapping.frequency,
            row: row[columnMapping.frequency],
            item: { ...item }
          });
          
          // Processa a periodicidade se existir no mapeamento
          if (columnMapping.frequency !== '' && hasFrequency) {
            const freqValue = row[columnMapping.frequency];
            const daysOfWeekValue = columnMapping.days_of_week !== '' ? 
              (row[columnMapping.days_of_week] || '') : '';
              
            if (freqValue !== undefined && freqValue !== '') {
              try {
                // Processa a periodicidade, passando também os dias da semana se disponíveis
                console.log('Processando frequência:', { 
                  freqValue, 
                  daysOfWeekValue,
                  isMensal: freqValue.toString().toUpperCase().includes('MENSAL')
                });
                
                const freqData = processFrequency(freqValue, daysOfWeekValue);
                
                // Log detalhado dos dados processados
                console.log('Dados processados:', {
                  original: freqValue,
                  daysOfWeekOriginal: daysOfWeekValue,
                  processado: freqData,
                  temWeeks: !!freqData.weeks_of_month,
                  weeksValue: freqData.weeks_of_month
                });
                
                // Atualiza os campos no item com os nomes corretos
                item.frequency = freqData.frequency;
                item.days_of_week = freqData.days_of_week;
                item.weeks_of_month = freqData.weeks_of_month;
                
                // Log do item completo após processamento
                console.log('Item após processamento:', {
                  frequency: item.frequency,
                  days_of_week: item.days_of_week,
                  weeks_of_month: item.weeks_of_month
                });
                
              } catch (error) {
                console.error('Erro ao processar periodicidade:', error);
                // Em caso de erro, mantém o valor original e define os outros campos como vazios
                item.frequency = freqValue.toString().trim();
                item.days_of_week = '';
                item.weeks_of_month = '';
              }
            }
          }

          // Se não tiver ID, usar o índice como fallback
          if (!hasId) {
            item.id = `temp_${Date.now()}_${index}`;
          } else if (item.id) {
            // Garante que o ID seja uma string
            item.id = item.id.toString().trim();
          }

          // Se já tiver latitude e longitude, marca como success
          const hasCoords = item.latitude !== null && item.longitude !== null;

          // Log dos dados do item antes de retornar
          console.log('Item processado:', {
            index,
            id: item.id,
            address: item.address,
            city: item.city,
            hasCoords,
            item: JSON.parse(JSON.stringify(item)) // Clona o objeto para evitar referências
          });

          return {
            ...item,
            status: hasCoords ? 'success' : 'aguardando geolocalização',
            latitude: item.latitude || null,
            longitude: item.longitude || null,
            geocodeError: hasCoords ? null : item.geocodeError
          };
        });

        setData(mappedData);
        setMessage({
          type: 'success',
          title: 'Mapeamento concluído',
          text: `${mappedData.length} registros prontos para geocodificação.`,
          details: 'Revise os dados mapeados e clique em "Geocodificar Endereços" para obter as coordenadas.',
          showClose: true
        });

      } catch (error) {
        console.error('Erro ao mapear colunas:', error);
        setMessage({
          type: 'danger',
          title: 'Erro no mapeamento',
          text: 'Não foi possível mapear as colunas do arquivo.',
          details: 'Verifique se as colunas foram mapeadas corretamente e tente novamente.',
          showClose: true
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Função para geocodificar endereços usando a API do OpenStreetMap Nominatim
  const geocodeAddresses = useCallback(async () => {
    if (data.length === 0) return;

    // Configurações de batch otimizadas para grande volume
    const BATCH_SIZE = 3; // Mantém o tamanho do lote
    const BATCH_DELAY_MS = 1000; // AJUSTADO: Reduzindo o atraso entre lotes para 1 segundo
    const MAX_RETRIES = 3; // Número máximo de tentativas por endereço

    // Estados locais para controle do processo
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const totalItems = data.length;

    // Contador de requisições para evitar rate limiting
    let requestCount = 0;
    const RATE_LIMIT = 30; // Limite de requisições por minuto (Nominatim tem limite de 1 por segundo)
    const RATE_LIMIT_WINDOW = 60000; // Janela de 1 minuto
    let rateLimitReset = Date.now() + RATE_LIMIT_WINDOW;

    // Inicia o processo
    const startTime = Date.now();
    setLoading(true);
    setGeocodingStatus('geocoding');

    console.log('Iniciando processo de geocodificação...', {
      totalItens: totalItems,
      tamanhoLote: BATCH_SIZE,
      atrasoEntreLotes: BATCH_DELAY_MS,
      maxTentativas: MAX_RETRIES
    });

    // Mostra mensagem informativa para o usuário
    setMessage({
      type: 'info',
      title: 'Processando...',
      text: `Iniciando geocodificação de ${totalItems} endereços. Este processo pode levar alguns minutos.`,
      showClose: false
    });

    // Função para verificar e respeitar o rate limiting
    const checkRateLimit = async () => {
      // Se excedeu o limite de requisições, espera até o reset
      if (requestCount >= RATE_LIMIT) {
        const now = Date.now();
        if (now < rateLimitReset) {
          const waitTime = rateLimitReset - now + 1000; // Adiciona 1 segundo de margem
          console.warn(`Rate limit atingido. Aguardando ${Math.ceil(waitTime/1000)} segundos...`);

          setMessage({
            type: 'warning',
            title: 'Aguarde',
            text: `Limite de requisições atingido. Aguardando ${Math.ceil(waitTime/1000)} segundos...`,
            showClose: false
          });

          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Reseta o contador
        requestCount = 0;
        rateLimitReset = Date.now() + RATE_LIMIT_WINDOW;
      }
    };

    // Função para fazer uma requisição de geocodificação com retry
    const fetchWithRetry = async (url, maxRetries = 3, delay = 1000) => {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Verifica o rate limit antes de cada tentativa
          await checkRateLimit();

          console.log(`Tentativa ${attempt}/${maxRetries} para:`, url);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout de 15 segundos

          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'SistemaDeRoteirizacao/1.0 (contato@empresa.com)', // CERTIFIQUE-SE DE MUDAR ESTE E-MAIL PARA UM VÁLIDO!
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': window.location.origin
              },
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Incrementa o contador de requisições
            requestCount++;

            // Verifica se a resposta foi bem-sucedida
            if (!response.ok) {
              // Se receber 429 (Too Many Requests), espera e tenta novamente
              if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 5;
                console.warn(`Rate limit atingido. Tentando novamente em ${retryAfter} segundos...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
              }
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || data.length === 0) {
              throw new Error('Nenhum resultado encontrado');
            }

            return data;

          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }

        } catch (error) {
          lastError = error;
          console.warn(`Tentativa ${attempt} falhou:`, error.message);

          // Se for um erro de rede ou timeout, espera um pouco mais
          const isNetworkError = error.name === 'AbortError' ||
                               error.message.includes('network') ||
                               error.message.includes('timeout');

          const waitTime = isNetworkError ? 3000 : delay * attempt;

          // Aguarda um tempo antes de tentar novamente
          if (attempt < maxRetries) {
            console.log(`Aguardando ${waitTime/1000} segundos antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      throw lastError || new Error('Falha ao geocodificar endereço após várias tentativas');
    };

    // Função para formatar mensagens de erro de forma mais amigável
    const formatGeocodeError = (error) => {
      if (!error) return 'Erro desconhecido';

      const errorMessage = error.message || String(error);

      // Mapeia mensagens de erro comuns para mensagens mais amigáveis
      const errorMap = {
        'Failed to fetch': 'Falha na conexão com o servidor de geocodificação',
        'network request failed': 'Falha na conexão de rede',
        'timeout': 'Tempo limite de conexão excedido',
        'Nenhum resultado encontrado': 'Endereço não encontrado',
        'Dados insuficientes': 'Dados de endereço incompletos',
        'address': 'Endereço inválido ou incompleto'
      };

      // Encontra a mensagem de erro mais adequada
      for (const [key, value] of Object.entries(errorMap)) {
        if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
          return value;
        }
      }

      return `Erro: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`;
    };

    // Utiliza a função normalizeAddress já definida no escopo global

    // Função para processar um único item
    const processItem = async (item) => {
      // Se já tiver coordenadas, retorna o item como está
      if (item.latitude && item.longitude) {
        return {
          ...item,
          status: 'success',
          geocodeError: null,
          _processed: true,
          _geocodeSource: 'existing',
          _processedAt: new Date().toISOString()
        };
      }

      // Verifica se o item tem dados mínimos para processamento
      console.log('Verificando campos obrigatórios para o item:', {
        id: item.id,
        address: item.address,
        city: item.city,
        item: item
      });
      
      const requiredFields = [
        { field: 'address', label: 'Endereço' },
        { field: 'city', label: 'Cidade' }
      ];

      const missingFields = requiredFields
        .filter(({ field }) => !item[field]?.trim())
        .map(({ label }) => label);

      console.log('Campos faltando:', missingFields);

      if (missingFields.length > 0) {
        console.log('Item ignorado por falta de campos obrigatórios:', {
          id: item.id,
          missingFields,
          item
        });
        return {
          ...item,
          status: 'skipped',
          geocodeError: `Dados insuficientes: ${missingFields.join(', ')}`,
          _processed: true,
          _geocodeSource: 'validation',
          _missingFields: missingFields,
          _processedAt: new Date().toISOString()
        };
      }

      try {
        // Tenta diferentes combinações de endereço para melhorar a taxa de acerto
        const addressVariations = [
          // Formato: Endereço com número, Cidade, Estado
          {
            parts: [
              formatSearchAddress(item.address, item.city, item.state, true)
            ],
            type: 'full_address',
            priority: 1,
            minLength: 1
          },
          // Formato: Endereço sem número, Cidade, Estado
          {
            parts: [
              formatSearchAddress(item.address, item.city, item.state, false)
            ],
            type: 'address_no_number',
            priority: 2,
            minLength: 1
          },
          // Formato: Endereço, Cidade, Estado (formato tradicional)
          {
            parts: [
              item.address.replace(/\s+/g, ' ').trim(),
              item.city,
              item.state
            ],
            type: 'address_city_state',
            priority: 3,
            minLength: 2
          },
          // Formato: Endereço, Bairro, Cidade, Estado
          {
            parts: [
              item.address.replace(/\s+/g, ' ').trim(),
              item.neighborhood,
              item.city,
              item.state
            ].filter(Boolean),
            type: 'full_with_neighborhood',
            priority: 4,
            minLength: 2
          },
          // Formato: Nome do local, Cidade, Estado
          {
            parts: [
              item.name,
              item.city,
              item.state
            ].filter(Boolean),
            type: 'name_city_state',
            priority: 5,
            minLength: 2
          },
          // Apenas cidade e estado
          {
            parts: [
              item.city,
              item.state
            ].filter(Boolean),
            type: 'city_state',
            priority: 6,
            minLength: 1
          },
          // Apenas endereço e cidade
          {
            parts: [
              item.address.replace(/\s+/g, ' ').trim(),
              item.city
            ],
            type: 'address_city',
            priority: 7,
            minLength: 2
          }
        ]
        // Ordena por prioridade (menor número = maior prioridade)
        .sort((a, b) => a.priority - b.priority)
        // Remove variações duplicadas
        .filter((variation, index, self) => {
          const key = variation.parts.join(',');
          return index === self.findIndex(v => v.parts.join(',') === key);
        });
        
        console.log('Variações de endereço a serem testadas:', addressVariations.map(v => ({
          type: v.type,
          parts: v.parts,
          priority: v.priority
        })));

        let lastError;
        let lastResponse;

        // Tenta cada variação de endereço até encontrar uma que funcione
        for (const { parts, type, minLength = 2 } of addressVariations) {
          const filteredParts = parts.filter(part => part && part.trim().length > 0);

          // Se não tiver partes suficientes, pula para a próxima variação
          if (filteredParts.length < minLength) {
            console.log(`Pulando variação ${type} - partes insuficientes:`, filteredParts);
            continue;
          }

          const address = filteredParts.join(', ').replace(/\s+/g, ' ').trim();

          try {
            console.log(`Tentando geocodificar (${type}):`, address);

            // Prepara a URL de busca
            const searchParams = new URLSearchParams({
              q: address,
              format: 'json',
              limit: '5',  // Aumenta o limite para pegar mais resultados
              countrycodes: 'br',
              addressdetails: '1',
              'accept-language': 'pt-BR,pt;q=0.9',
              namedetails: '1',
              extratags: '1',
              polygon_geojson: '0',
              dedupe: '1',
              // Adiciona parâmetros extras para melhorar a qualidade dos resultados
              'email': 'contato@empresa.com',  // Substitua por um email válido
              'extratags': '1',
              'addressdetails': '1',
              'namedetails': '1',
              'bounded': '1',
              'viewbox': '-50.0,-25.0,-34.0,5.0',  // Limita a busca ao Brasil
              'bounded': '1'
            });
            
            // Adiciona log detalhado da query
            console.log(`Buscando endereço (${type}):`, {
              query: address,
              params: Object.fromEntries(searchParams)
            });

            const url = `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`;
            lastResponse = await fetchWithRetry(url);

            if (lastResponse && lastResponse.length > 0) {
              // Ordena os resultados por importância (maior primeiro) e tipo
              const sortedResults = [...lastResponse]
                .filter(r => r.lat && r.lon) // Filtra resultados com coordenadas válidas
                .map(result => {
                  // Calcula uma pontuação baseada em vários fatores
                  const importance = parseFloat(result.importance) || 0;
                  const address = result.address || {};
                  
                  // Pontuação baseada no tipo de resultado
                  let typeScore = 0;
                  const resultType = (result.type || '').toLowerCase();
                  const resultClass = (result.class || '').toLowerCase();
                  
                  // Prioriza resultados mais específicos
                  if (resultClass === 'building' || resultType === 'house') {
                    typeScore = 1.0;
                  } else if (resultClass === 'amenity' || resultClass === 'shop') {
                    typeScore = 0.9;
                  } else if (resultClass === 'highway' || resultClass === 'place') {
                    typeScore = 0.8;
                  } else if (resultClass === 'boundary') {
                    typeScore = 0.7;
                  } else if (resultClass === 'place') {
                    typeScore = 0.6;
                  }
                  
                  // Penaliza resultados de baixa qualidade
                  if (importance < 0.3) {
                    typeScore *= 0.5;
                  }
                  
                  // Verifica se o resultado contém a cidade e estado corretos
                  const hasCity = item.city && 
                    (address.city === item.city || 
                     address.town === item.city ||
                     address.village === item.city ||
                     address.municipality === item.city);
                     
                  const hasState = item.state && 
                    (address.state === item.state ||
                     address.state_code === item.state);
                     
                  const locationMatchScore = (hasCity ? 0.2 : 0) + (hasState ? 0.1 : 0);
                  
                  // Pontuação final (importância + tipo + localização)
                  const score = (importance * 0.7) + (typeScore * 0.3) + locationMatchScore;
                  
                  return { ...result, _score: score };
                })
                .sort((a, b) => b._score - a._score); // Ordena por pontuação
              
              // Pega o melhor resultado
              const result = sortedResults[0];
              
              if (!result) {
                throw new Error('Nenhum resultado válido encontrado');
              }
              
              console.log('Geocodificação bem-sucedida:', { 
                type, 
                result,
                allResults: sortedResults,
                selectedIndex: 0,
                totalResults: sortedResults.length,
                score: result._score
              });

              // Verifica a qualidade do resultado baseado na pontuação
              const isHighQuality = result._score >= 0.5;
              const resultType = result.type || '';
              const resultClass = result.class || '';
              
              // Log detalhado sobre a qualidade do resultado
              console.log('Qualidade do resultado:', {
                importance: result.importance,
                type: resultType,
                class: resultClass,
                displayName: result.display_name,
                isHighQuality,
                address: result.address,
                score: result._score
              });
              
              // Se a qualidade for baixa, continua para a próxima variação
              if (!isHighQuality) {
                console.warn('Resultado de baixa qualidade, tentando próxima variação...', {
                  score: result._score,
                  type: resultType,
                  class: resultClass,
                  importance: result.importance,
                  displayName: result.display_name
                });
                lastError = new Error(`Resultado de baixa qualidade (score: ${result._score.toFixed(2)})`);
                continue;
              }

              return {
                ...item,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                status: 'success',
                geocodeError: null,
                _geocodeAddress: result.display_name,
                _geocodeSource: `nominatim_${type}`,
                _geocodeQuality: isHighQuality ? 'high' : 'low',
                _geocodeType: resultType,
                _geocodeClass: resultClass,
                _processedAt: new Date().toISOString()
              };
            }
          } catch (error) {
            const errorDetails = {
              type,
              address,
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack
              },
              response: lastResponse,
              timestamp: new Date().toISOString()
            };
            
            console.warn(`Falha ao geocodificar endereço (${type}):`, errorDetails);
            
            // Se for um erro de limite de taxa, aguarda mais tempo
            if (error.message.includes('Too Many Requests') || 
                error.message.includes('Rate Limited')) {
              console.log('Limite de requisições atingido, aguardando 5 segundos...');
              await new Promise(resolve => setTimeout(resolve, 5000));
            }

            lastError = error;

            // Se for um erro de timeout ou de rede, espera um pouco antes da próxima tentativa
            if (error.name === 'AbortError' || error.message.includes('network') || error.message.includes('timeout')) {
              const waitTime = 3000; // 3 segundos para erros de rede
              console.warn(`Erro de rede/timeout, aguardando ${waitTime/1000}s...`, {
                error: error.message,
                type
              });
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            // Se a API retornar um erro de limite de taxa, espera mais tempo
            if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
              const waitTime = 10000; // 10 segundos para rate limit
              console.warn(`Limite de taxa excedido. Aguardando ${waitTime/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            
            console.warn(`Erro ao processar variação ${type}:`, error.message);
            lastError = error;
          }
        }

        // Se chegou aqui, todas as variações falharam
        const errorMessage = lastError ?
          formatGeocodeError(lastError) :
          'Não foi possível geocodificar o endereço com os dados fornecidos';
          
        console.error('Todas as variações falharam:', { 
          itemId: item.id, 
          error: errorMessage,
          lastTriedAddress: addressVariations[addressVariations.length - 1]?.parts.join(', '),
          totalVariationsTried: addressVariations.length,
          timestamp: new Date().toISOString()
        });

        return {
          ...item,
          status: 'error',
          geocodeError: errorMessage,
          _processed: true,
          _geocodeSource: 'failed',
          _processedAt: new Date().toISOString(),
          _errorDetails: {
            message: lastError?.message,
            type: lastError?.name,
            stack: lastError?.stack,
            lastResponse: lastResponse,
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        console.error('Erro inesperado ao processar item:', {
          itemId: item.id,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        
        return {
          ...item,
          status: 'error',
          geocodeError: `Erro inesperado: ${error.message}`,
          _processed: true,
          _geocodeSource: 'error',
          _processedAt: new Date().toISOString(),
          _errorDetails: {
            message: error.message,
            type: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        };
      }
    };

    try {
      // Processa os itens em lotes controlados
      const totalBatches = Math.ceil(totalItems / BATCH_SIZE);

      // Processa os lotes sequencialmente com um pequeno atraso entre eles
      for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
        const batchStartTime = Date.now();

        // Verifica se o usuário cancelou o processo
        if (geocodingStatus === 'cancelled') {
          setMessage({
            type: 'warning',
            title: 'Processo cancelado',
            text: `Processamento interrompido pelo usuário. ${processed} de ${totalItems} endereços processados.`,
            showClose: true,
            details: `Sucessos: ${successful} | Falhas: ${failed} | Ignorados: ${skipped}`
          });
          return;
        }

        // Processa o lote atual
        const startIdx = batchNumber * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalItems);
        const batch = data.slice(startIdx, endIdx);

        try {
          console.log(`Processando lote ${batchNumber + 1}/${totalBatches} (itens ${startIdx + 1}-${endIdx})`);

          // Log dos itens do lote antes do processamento
          console.log(`Processando lote ${batchNumber + 1}/${totalBatches} (itens ${startIdx + 1}-${endIdx}):`, {
            tamanhoLote: batch.length,
            itens: batch.map(item => ({
              id: item.id,
              address: item.address,
              city: item.city,
              hasLatLng: !!(item.latitude && item.longitude)
            }))
          });
          
          // Processa os itens do lote em paralelo
          const batchPromises = batch.map(item => {
            console.log('Iniciando processamento do item:', { id: item.id, address: item.address, city: item.city });
            return processItem(item);
          });
          
          const batchResults = await Promise.all(batchPromises);

          // Log dos resultados do lote
          console.log(`Resultados do lote ${batchNumber + 1}:`, {
            total: batchResults.length,
            success: batchResults.filter(r => r.status === 'success').length,
            skipped: batchResults.filter(r => r.status === 'skipped').length,
            error: batchResults.filter(r => r.status === 'error').length,
            itens: batchResults.map(r => ({
              id: r.id,
              status: r.status,
              error: r.geocodeError,
              address: r.address,
              city: r.city
            }))
          });

          // Atualiza contadores
          const batchSuccess = batchResults.filter(r => r.status === 'success').length;
          const batchSkipped = batchResults.filter(r => r.status === 'skipped').length;
          const batchFailed = batchResults.filter(r => r.status === 'error').length;

          successful += batchSuccess;
          failed += batchFailed;
          skipped += batchSkipped;
          processed += batchResults.length;

          // Atualiza o estado com os resultados do lote
          setData(prevData => {
            const newData = [...prevData];
            batchResults.forEach((result, idx) => {
              const itemIndex = startIdx + idx;
              if (itemIndex < newData.length) {
                newData[itemIndex] = result;
              }
            });
            return newData;
          });

          // Calcula estatísticas
          const successRate = Math.round((successful / processed) * 100) || 0;
          const remainingBatches = totalBatches - batchNumber - 1;
          const avgTimePerBatch = (Date.now() - startTime) / (batchNumber + 1);
          const estimatedTimeRemaining = Math.round((remainingBatches * avgTimePerBatch) / 1000);

          // Formata o tempo restante
          const formatTime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return [
              hours > 0 ? `${hours}h` : '',
              minutes > 0 ? `${minutes}m` : '',
              `${secs}s`
            ].filter(Boolean).join(' ');
          };

          // Atualiza o progresso
          const newProgress = Math.round((processed / totalItems) * 100);
          setProgress(newProgress);

          // Atualiza a mensagem de status a cada 1% de progresso ou a cada lote
          if (batchNumber % 1 === 0 || newProgress % 1 === 0) {
            const statusMessage = {
              type: 'info',
              title: 'Processando...',
              text: `Geocodificação em andamento: ${processed} de ${totalItems} (${newProgress}%)`,
              details: [
                `✅ Sucessos: ${successful} (${successRate}%)`,
                `❌ Falhas: ${failed}`,
                `⏩ Ignorados: ${skipped}`,
                `⏱️ Tempo restante: ${formatTime(estimatedTimeRemaining)}`
              ].join(' | '),
              showClose: false
            };

            console.log(statusMessage.text, statusMessage.details);
            setMessage(statusMessage);
          }

          // Log detalhado do lote
          const batchTime = Date.now() - batchStartTime;
          console.log(`Lote ${batchNumber + 1}/${totalBatches} concluído em ${batchTime}ms`, {
            sucessos: batchSuccess,
            falhas: batchFailed,
            ignorados: batchSkipped,
            tempo: `${batchTime}ms`,
            'tempo/requisicao': `${Math.round(batchTime / batchResults.length)}ms`
          });

        } catch (error) {
          console.error(`Erro no lote ${batchNumber + 1}/${totalBatches}:`, error);

          // Incrementa os contadores de falha
          const failedInBatch = Math.min(BATCH_SIZE, totalItems - processed);
          failed += failedInBatch;
          processed += failedInBatch;

          // Atualiza a mensagem de erro
          setMessage({
            type: 'warning',
            title: 'Aviso durante o processamento',
            text: `Erro no processamento do lote ${batchNumber + 1}/${totalBatches}. Continuando...`,
            details: `Erro: ${error.message}\nProcessados: ${processed}/${totalItems} | Falhas: ${failed} | Sucessos: ${successful}`,
            showClose: true
          });

          // Se for um erro de rede ou timeout, espera um pouco mais
          const isNetworkError = error.name === 'AbortError' ||
                               error.message.includes('network') ||
                               error.message.includes('timeout');

          if (isNetworkError) {
            const waitTime = 5000; // 5 segundos de espera para erros de rede
            console.warn(`Erro de rede detectado. Aguardando ${waitTime/1000} segundos...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        // Aguarda um tempo entre lotes para evitar sobrecarga
        if (batchNumber < totalBatches - 1) {
          const waitTime = Math.max(1000, BATCH_DELAY_MS - (Date.now() - batchStartTime));
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      // Processamento concluído
      setGeocodingStatus('done');

      // Mensagem final com resumo
      const successRate = Math.round((successful / totalItems) * 100) || 0;

      setMessage({
        type: failed > 0 ? (successRate > 50 ? 'warning' : 'danger') : 'success',
        title: 'Geocodificação concluída',
        text: `Processamento finalizado: ${successful} de ${totalItems} endereços processados com sucesso (${successRate}%).`,
        details: failed > 0 ? `${failed} endereços não puderam ser processados.` : 'Todos os endereços foram processados com sucesso!',
        showClose: true
      });

    } catch (error) {
      console.error('Erro crítico durante a geocodificação:', error);
      setGeocodingStatus('error');
      setMessage({
        type: 'danger',
        title: 'Erro crítico',
        text: 'Ocorreu um erro durante o processamento. O processo foi interrompido.',
        details: error.message,
        showClose: true
      });
    } finally {
      setLoading(false);
    }
  }, [data, geocodingStatus]); // Adicionando dependências necessárias

  // Estados para os modais e gerenciamento de pontos
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saveResults, setSaveResults] = useState(null);
  const [pointsToSave, setPointsToSave] = useState([]);
  const [savedPoints, setSavedPoints] = useState([]);
  const [showSavedPoints, setShowSavedPoints] = useState(false);
  const [loadingSavedPoints, setLoadingSavedPoints] = useState(false);

  // Função para validar um ponto de coleta
  const validatePoint = (point) => {
    const errors = [];

    // Campos obrigatórios
    if (!point.name?.trim()) {
      errors.push('O campo Nome é obrigatório');
    }

    if (!point.address?.trim()) {
      errors.push('O campo Endereço é obrigatório');
    }

    if (!point.city?.trim()) {
      errors.push('O campo Cidade é obrigatório');
    }

    if (!point.state?.trim()) {
      errors.push('O campo Estado é obrigatório');
    }

    // Validação de coordenadas (apenas aviso, não impede o salvamento)
    if (point.latitude === undefined || point.longitude === undefined ||
        isNaN(parseFloat(point.latitude)) || isNaN(parseFloat(point.longitude)) ||
        point.latitude < -90 || point.latitude > 90 ||
        point.longitude < -180 || point.longitude > 180) {
      // Não adiciona ao array de erros, apenas loga um aviso
      console.warn('Coordenadas inválidas ou ausentes para o ponto:', point);
    }

    return errors;
  };

  // Função para preparar os pontos para salvar
  const preparePointsToSave = () => {
    console.log('Dados disponíveis para salvar:', data.map(item => ({
      name: item.name,
      status: item.status,
      hasCoords: !!(item.latitude && item.longitude),
      geocodeQuality: item._geocodeQuality
    })));

    // Filtra pontos com status 'success' ou 'aguardando geolocalização'
    const filtered = data.filter(item => {
      // Para pontos com status 'success', verifica se as coordenadas são válidas
      if (item.status === 'success') {
        const hasValidCoords = item.latitude !== undefined && item.longitude !== undefined &&
                             !isNaN(parseFloat(item.latitude)) && !isNaN(parseFloat(item.longitude)) &&
                             item.latitude >= -90 && item.latitude <= 90 &&
                             item.longitude >= -180 && item.longitude <= 180;
        return hasValidCoords;
      }

      // Para pontos com status 'aguardando geolocalização', não verifica coordenadas
      return item.status === 'aguardando geolocalização';
    });

    console.log('Pontos após filtro:', filtered.length);

    return filtered
      .map((item, index) => {
        // Se o ID começar com 'temp_', não inclui no payload
        const pointData = {
          name: (item.name || '').toString().trim(),
          address: (item.address || '').toString().trim(),
          neighborhood: (item.neighborhood || '').toString().trim(),
          city: (item.city || '').toString().trim(),
          state: (item.state || '').toString().trim(),
          zip_code: item.zip_code?.toString().replace(/\D/g, '') || '', // Remove formatação do CEP
          phone: item.phone?.toString().replace(/\D/g, '') || '', // Remove formatação do telefone
          reference: (item.reference || '').toString().trim(),
          frequency: item.frequency || 'semanal',
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          is_active: true,
          _index: index + 1 // Para referência em mensagens de erro
        };

        // Inclui o external_id apenas se não for um ID temporário
        if (item.id && !item.id.toString().startsWith('temp_')) {
          pointData.external_id = item.id.toString().trim();
        }

        // Valida o ponto
        const errors = validatePoint(pointData);
        if (errors.length > 0) {
          return {
            ...pointData,
            _errors: errors,
            _isValid: false
          };
        }

        return {
          ...pointData,
          _isValid: true
        };
      });
  };

  // Função para formatar mensagem de erros de validação
  const formatValidationErrors = (invalidPoints) => {
    if (invalidPoints.length === 0) return '';

    const errorMessages = [];
    const errorCounts = {};

    // Conta a ocorrência de cada tipo de erro
    invalidPoints.forEach(point => {
      if (point._errors) {
        point._errors.forEach(error => {
          errorCounts[error] = (errorCounts[error] || 0) + 1;
        });
      }
    });

    // Formata as mensagens de erro
    for (const [error, count] of Object.entries(errorCounts)) {
      errorMessages.push(`• ${count} ponto(s) com: ${error}`);
    }

    return errorMessages.join('\n');
  };

  // Função para exibir o modal de confirmação
  const confirmSave = () => {
    console.log('Botão salvar clicado - Iniciando confirmSave');
    const pointsToSave = preparePointsToSave();

    console.log('Pontos preparados para salvar:', {
      count: pointsToSave.length,
      sample: pointsToSave.slice(0, 2)
    });

    if (pointsToSave.length === 0) {
      console.log('Nenhum ponto válido para salvar');
      setMessage({
        type: 'warning',
        title: 'Nenhum ponto para salvar',
        text: 'Não há pontos válidos para salvar no momento.',
        details: 'Verifique se há pontos com status de sucesso e coordenadas válidas.',
        showClose: true
      });
      return;
    }

    // Separa pontos válidos e inválidos
    const validPoints = pointsToSave.filter(p => p._isValid);
    const invalidPoints = pointsToSave.filter(p => !p._isValid);

    // Se não houver pontos válidos, mostra mensagem de erro
    if (validPoints.length === 0) {
      const errorMessage = invalidPoints.length > 0
        ? `Todos os ${invalidPoints.length} pontos possuem erros de validação.\n\n${formatValidationErrors(invalidPoints)}`
        : 'Nenhum ponto válido para salvar.';

      setMessage({
        type: 'danger',
        title: 'Erro de Validação',
        text: errorMessage,
        showClose: true
      });
      return;
    }

    // Se houver pontos inválidos, pergunta se deseja continuar
    if (invalidPoints.length > 0) {
      const confirmMessage =
        `⚠️ ${invalidPoints.length} de ${pointsToSave.length} pontos possuem erros de validação.\n\n` +
        `📋 Erros encontrados:\n${formatValidationErrors(invalidPoints)}\n\n` +
        `✅ ${validPoints.length} pontos estão prontos para serem salvos.\n\n` +
        `Deseja continuar salvando apenas os pontos válidos?`;

      if (window.confirm(confirmMessage)) {
        // Atualiza os pontos para salvar com apenas os válidos
        setPointsToSave(validPoints);
        setShowConfirmModal(true);
      }
      return;
    }

    // Se chegou aqui, todos os pontos são válidos
    setPointsToSave(validPoints);
    setShowConfirmModal(true);
  };

  // Função para preparar os dados para envio ao backend (remove campos internos e garante campos obrigatórios)
  const prepareForApi = (points) => {
    return points.map(({ _index, _errors, _isValid, status, geocodeError, week_days, week_of_month, ...point }) => {
      // Cria um novo objeto com os campos formatados
      const formattedPoint = { ...point };
      
      // Garante que a frequência seja uma string e em maiúsculas para comparação
      if (formattedPoint.frequency === undefined) {
        formattedPoint.frequency = '';
      } else {
        formattedPoint.frequency = formattedPoint.frequency.toString().trim().toUpperCase();
      }
      
      // Mapeia os nomes dos campos para os nomes esperados pelo backend
      if (week_days !== undefined) {
        // Se veio como prop separada (nome antigo)
        formattedPoint.days_of_week = Array.isArray(week_days) ? week_days.join(',') : week_days;
      } else if (formattedPoint.week_days !== undefined) {
        // Se veio dentro do objeto point (nome antigo)
        formattedPoint.days_of_week = Array.isArray(formattedPoint.week_days) 
          ? formattedPoint.week_days.join(',') 
          : formattedPoint.week_days;
      }
      
      // Define weeks_of_month como '1,2,3,4,5' para frequências SEMANAL ou DIÁRIA
      if (['SEMANAL', 'DIÁRIA'].includes(formattedPoint.frequency)) {
        formattedPoint.weeks_of_month = '1,2,3,4,5';
      } else if (week_of_month !== undefined) {
        // Se veio como prop separada (nome antigo) e não é SEMANAL/DIÁRIA
        formattedPoint.weeks_of_month = Array.isArray(week_of_month) ? week_of_month.join(',') : week_of_month;
      } else if (formattedPoint.week_of_month !== undefined) {
        // Se veio dentro do objeto point (nome antigo) e não é SEMANAL/DIÁRIA
        formattedPoint.weeks_of_month = Array.isArray(formattedPoint.week_of_month) 
          ? formattedPoint.week_of_month.join(',') 
          : formattedPoint.week_of_month;
      }
      
      // Se for um ponto 'aguardando geolocalização', garante que latitude e longitude sejam nulos
      if (status === 'aguardando geolocalização') {
        formattedPoint.latitude = null;
        formattedPoint.longitude = null;
      }
      
      // Remove campos vazios para não enviar lixo para a API
      Object.keys(formattedPoint).forEach(key => {
        if (formattedPoint[key] === '' || formattedPoint[key] === null || formattedPoint[key] === undefined) {
          delete formattedPoint[key];
        }
      });
      
      return formattedPoint;
    });
  };

  // Função para buscar os pontos de coleta do servidor
  const fetchCollectionPoints = async () => {
    try {
      console.log('Buscando pontos de coleta...');
      const response = await collectionPointService.getAll();
      console.log('Pontos de coleta carregados:', response.length);
      return response;
    } catch (error) {
      console.error('Erro ao buscar pontos de coleta:', error);
      setMessage({
        type: 'error',
        title: 'Erro',
        text: 'Não foi possível carregar os pontos de coleta. Por favor, atualize a página e tente novamente.',
        showClose: true
      });
      return [];
    }
  };

  // Função para salvar os dados geocodificados no banco de dados
  const saveToDatabase = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    
    // Configura um timeout para a operação de salvamento (5 minutos)
    const SAVE_TIMEOUT = 5 * 60 * 1000; // 5 minutos em milissegundos
    let saveTimeout;
    
    try {
      // Configura o timeout
      const timeoutPromise = new Promise((_, reject) => {
        saveTimeout = setTimeout(() => {
          reject(new Error('Tempo limite excedido ao salvar os pontos de coleta. Por favor, tente novamente com um arquivo menor ou verifique sua conexão.'));
        }, SAVE_TIMEOUT);
      });
      
      // Atualiza a mensagem com mais detalhes
      setMessage({
        type: 'info',
        title: 'Processando',
        text: `Salvando ${pointsToSave.length} pontos de coleta...`,
        details: 'Isso pode levar alguns minutos. Por favor, aguarde.',
        showClose: false
      });
      
      // Executa a operação de salvamento com timeout
      await Promise.race([
        performSaveOperation(),
        timeoutPromise
      ]);
      
    } catch (error) {
      handleSaveError(error);
    } finally {
      // Limpa o timeout
      if (saveTimeout) clearTimeout(saveTimeout);
      setLoading(false);
    }
  };
  
  // Função para tratar erros durante o salvamento
  const handleSaveError = (error) => {
    console.error('Erro durante o salvamento:', error);
    
    let errorMessage = 'Ocorreu um erro ao tentar salvar os pontos de coleta.';
    let errorDetails = [];
    
    // Tratamento específico para erros de timeout
    if (error.message.includes('Tempo limite excedido')) {
      errorMessage = 'Tempo limite excedido';
      errorDetails = [
        'A operação de salvamento está demorando mais que o esperado.',
        'Por favor, tente novamente com um arquivo menor ou verifique sua conexão com a internet.'
      ];
    } 
    // Tratamento para erros de rede
    else if (error.message === 'Network Error' || !error.response) {
      errorMessage = 'Erro de conexão';
      errorDetails = [
        'Não foi possível conectar ao servidor.',
        'Verifique sua conexão com a internet e tente novamente.'
      ];
    }
    // Tratamento para erros de validação
    else if (error.response?.status === 422) {
      errorMessage = 'Erro de validação';
      errorDetails = [
        'Alguns dados não atenderam às regras de validação.',
        'Por favor, verifique os dados e tente novamente.'
      ];
    }
    // Tratamento para erros de autenticação
    else if (error.response?.status === 401) {
      errorMessage = 'Sessão expirada';
      errorDetails = [
        'Sua sessão expirou. Por favor, faça login novamente.'
      ];
      // Redireciona para a página de login após 3 segundos
      setTimeout(() => {
        // navigate('/login'); // Descomente se estiver usando react-router
      }, 3000);
    }
    
    // Atualiza a mensagem de erro
    setMessage({
      type: 'error',
      title: errorMessage,
      text: errorDetails.join('\n'),
      showClose: true
    });
  };
  
  // Função que contém a lógica principal de salvamento
  const performSaveOperation = async () => {
    console.log('Iniciando operação de salvamento...');

    try {
      // Verifica se há pontos para salvar
      if (!pointsToSave || pointsToSave.length === 0) {
        setMessage({
          type: 'warning',
          title: 'Atenção',
          text: 'Nenhum ponto válido para salvar. Verifique se os dados foram processados corretamente.',
          showClose: true
        });
        setLoading(false);
        return;
      }

      // Prepara os dados para envio (remove campos internos)
      const pointsForApi = prepareForApi(pointsToSave);

      // Verifica quais pontos já existem no banco de dados usando verificação em lote
      const pointsToProcess = pointsForApi.filter(point => point.external_id && point.external_id.toString().trim() !== '');
      const externalIds = [...new Set(pointsToProcess.map(point => point.external_id.toString().trim()))];
      
      console.log(`Iniciando verificação em lote para ${externalIds.length} IDs externos únicos...`);
      
      let existingPointsMap = {};
      const pointsToSkip = [];
      const BATCH_SIZE = 100; // Aumentado de 50 para 100 para melhor performance

      if (externalIds.length > 0) {
        console.log(`Verificando existência de ${externalIds.length} IDs externos em lotes de ${BATCH_SIZE}...`);
        
        // Processa os IDs em lotes menores
        for (let i = 0; i < externalIds.length; i += BATCH_SIZE) {
          const batch = externalIds.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(externalIds.length / BATCH_SIZE);
          
          console.log(`Verificando lote ${batchNumber}/${totalBatches} com ${batch.length} IDs...`);
          
          try {
            // Tenta verificar o lote até 3 vezes em caso de falha
            let retries = 0;
            const maxRetries = 3;
            let batchResults = {};
            let lastError = null;
            
            while (retries < maxRetries) {
              try {
                console.log(`Tentativa ${retries + 1}/${maxRetries} para lote ${batchNumber}...`);
                batchResults = await collectionPointService.checkExistingExternalIds(batch);
                lastError = null;
                break; // Sai do loop se bem-sucedido
              } catch (error) {
                lastError = error;
                console.warn(`Tentativa ${retries + 1} falhou para lote ${batchNumber}:`, error.message);
                
                // Aumenta o tempo de espera a cada tentativa (backoff exponencial)
                const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Máximo de 10 segundos
                console.log(`Aguardando ${delay}ms antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
              }
            }
            
            if (lastError) {
              console.error(`Falha ao verificar lote ${batchNumber} após ${maxRetries} tentativas:`, lastError);
              // Marca os pontos como não existentes para evitar falha na importação
              batch.forEach(id => {
                existingPointsMap[id] = false;
              });
              pointsToSkip.push(...batch);
            } else {
              // Mescla os resultados bem-sucedidos
              existingPointsMap = { ...existingPointsMap, ...batchResults };
              console.log(`Lote ${batchNumber}/${totalBatches}: Verificação concluída para ${Object.keys(batchResults).length} IDs`);
            }
            
            // Pequena pausa entre lotes para evitar sobrecarga
            if (i + BATCH_SIZE < externalIds.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
          } catch (batchError) {
            console.error(`Erro inesperado no lote ${batchNumber}:`, batchError);
            // Em caso de erro inesperado, marca o lote como falha mas continua o processo
            batch.forEach(id => {
              existingPointsMap[id] = false;
              pointsToSkip.push(id);
            });
          }
        }
        
        // Loga quantos pontos foram encontrados
        const existingCount = Object.values(existingPointsMap).filter(exists => exists).length;
        console.log(`Verificação em lote concluída: ${existingCount} pontos existentes de ${externalIds.length} verificados`);
      }

      // Filtra os pontos duplicados
      const duplicatedPoints = pointsToProcess.filter(point => 
        point.external_id && existingPointsMap[point.external_id] === true
      );

      console.log(`Encontrados ${duplicatedPoints.length} pontos duplicados de ${pointsToProcess.length} processados`);
      
      // Log detalhado dos pontos duplicados (apenas os primeiros 5 para não poluir o console)
      if (duplicatedPoints.length > 0) {
        console.log('IDs dos pontos duplicados (amostra):', 
          duplicatedPoints.slice(0, 5).map(p => p.external_id)
        );
      }
      
      // Se houver pontos para pular, exibe um aviso detalhado
      if (pointsToSkip.length > 0) {
        console.warn(`Atenção: ${pointsToSkip.length} pontos não puderam ser verificados e serão ignorados.`);
        
        // Adiciona mensagem para o usuário
        setMessage({
          type: 'warning',
          title: 'Atenção',
          text: `${pointsToSkip.length} pontos não puderam ser verificados e serão ignorados.`,
          details: `IDs: ${pointsToSkip.slice(0, 10).join(', ')}${pointsToSkip.length > 10 ? `... (mais ${pointsToSkip.length - 10} itens)` : ''}`,
          showClose: true
        });
      }

      // Se houver pontos duplicados, pergunta se deseja removê-los
      if (duplicatedPoints.length > 0) {
        const confirmRemove = window.confirm(
          `Atenção: ${duplicatedPoints.length} pontos já existem no banco de dados.\n\n` +
          `Deseja remover os pontos existentes antes de salvar os novos?\n\n` +
          `IDs dos pontos duplicados:\n` +
          duplicatedPoints.map(p => p.external_id || p.id).join('\n') +
          `\n\nClique em OK para remover os pontos existentes e continuar.\n` +
          `Clique em Cancelar para cancelar a operação.`
        );

        if (confirmRemove) {
          console.log('Usuário optou por remover pontos duplicados:', duplicatedPoints.length);
          setMessage({
            type: 'info',
            title: 'Processando',
            text: 'Removendo pontos duplicados...',
            showClose: false
          });

          try {
            // Remove os pontos duplicados do banco de dados em lote
            const BATCH_SIZE = 10; // Tamanho do lote para remoção
            const removalResults = [];
            
            // Processa os pontos em lotes para evitar sobrecarga
            for (let i = 0; i < duplicatedPoints.length; i += BATCH_SIZE) {
              const batch = duplicatedPoints.slice(i, i + BATCH_SIZE);
              console.log(`Processando lote de remoção ${i / BATCH_SIZE + 1} com ${batch.length} itens`);
              
              const batchResults = await Promise.all(
                batch.map(async (point) => {
                  try {
                    await collectionPointService.deleteByExternalId(point.external_id);
                    console.log(`Ponto ${point.external_id} removido com sucesso`);
                    return { 
                      success: true, 
                      external_id: point.external_id,
                      message: 'Removido com sucesso'
                    };
                  } catch (error) {
                    console.error(`Erro ao remover ponto ${point.external_id}:`, error);
                    return {
                      success: false,
                      external_id: point.external_id,
                      error: {
                        message: error.message,
                        status: error.response?.status,
                        detail: error.response?.data?.detail
                      },
                      message: `Erro ao remover: ${error.message}`
                    };
                  }
                })
              );
              
              removalResults.push(...batchResults);
              
              // Pequena pausa entre lotes para evitar sobrecarga
              if (i + BATCH_SIZE < duplicatedPoints.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            // Verifica se houve erros na remoção
            const failedRemovals = removalResults.filter(r => !r.success);
            if (failedRemovals.length > 0) {
              const errorMsg = `Não foi possível remover ${failedRemovals.length} de ${duplicatedPoints.length} pontos. ` +
                'Deseja continuar mesmo assim?';
              
              const shouldContinue = window.confirm(
                errorMsg + '\n\n' +
                'IDs com erro: ' + failedRemovals.map(r => r.external_id).join(', ')
              );
              
              if (!shouldContinue) {
                setMessage({
                  type: 'warning',
                  title: 'Operação cancelada',
                  text: 'A remoção de pontos foi cancelada. Nenhum dado foi alterado.',
                  showClose: true
                });
                setLoading(false);
                return;
              }
            }

            console.log('Pontos duplicados removidos, continuando com o salvamento...');
          } catch (error) {
            console.error('Erro ao remover pontos duplicados:', error);
            setMessage({
              type: 'error',
              title: 'Erro',
              text: `Ocorreu um erro ao tentar remover pontos duplicados: ${error.message}`,
              showClose: true
            });
            setLoading(false);
            return;
          }
        } else {
          // Usuário optou por não remover os pontos duplicados
          setMessage({
            type: 'warning',
            title: 'Operação cancelada',
            text: 'A importação foi cancelada, pois existem pontos duplicados que não foram removidos.',
            showClose: true
          });
          setLoading(false);
          return;
        }
      }

      // Se chegou até aqui, pode prosseguir com o salvamento dos pontos
      setMessage({
        type: 'info',
        title: 'Processando',
        text: `Salvando ${pointsForApi.length} pontos de coleta no banco de dados...`,
        showClose: false
      });

      try {
        console.log('Iniciando salvamento de', pointsForApi.length, 'pontos...');
        
        // Chama o serviço para processar os pontos em lote
        const saveResults = await collectionPointService.processPoints(pointsForApi, {
          onProgress: (progress) => {
            // Atualiza o progresso na interface
            const percent = Math.round((progress.current / progress.total) * 100);
            setProgress(percent);
            
            setMessage({
              type: 'info',
              title: 'Processando',
              text: `Salvando pontos de coleta... (${progress.current}/${progress.total})`,
              showClose: false
            });
          }
        });
        
        console.log('Resultado do processamento em lote:', saveResults);
        
        // Formata o resultado para compatibilidade com o código existente
        const formattedResults = {
          success: saveResults.errors === 0,
          total: saveResults.total,
          processed: saveResults.processed,
          created: saveResults.details.results.filter(r => r.status === 'created').length,
          updated: saveResults.details.results.filter(r => r.status === 'updated').length,
          errors: saveResults.errors,
          details: saveResults.details
        };
        
        if (formattedResults.success) {
          const message = `Foram processados com sucesso ${formattedResults.processed} pontos de coleta!\n` +
                         `- ${formattedResults.created} novos pontos criados\n` +
                         `- ${formattedResults.updated} pontos atualizados`;
          
          console.log('Salvamento concluído com sucesso:', message);
          
          setMessage({
            type: 'success',
            title: 'Sucesso',
            text: message,
            showClose: true
          });
          
          // Limpa o estado após salvar
          setData([]);
          setFile(null);
          setHeaders([]);
          setColumnMapping({});
          setGeocodingStatus('idle');
          setProgress(0);
          setPointsToSave([]);
          
          // Log dos pontos que foram salvos
          console.log('Pontos salvos com sucesso:', {
            total: formattedResults.total,
            created: formattedResults.created,
            updated: formattedResults.updated,
            errors: formattedResults.errors
          });
          
          // Notifica o usuário do sucesso
          setMessage({
            type: 'success',
            title: 'Sucesso!',
            text: `Foram processados ${formattedResults.processed} pontos de coleta com sucesso!\n` +
                  `- ${formattedResults.created} novos pontos criados\n` +
                  `- ${formattedResults.updated} pontos atualizados` +
                  (formattedResults.errors > 0 ? `\n- ${formattedResults.errors} erros encontrados` : ''),
            showClose: true
          });
          
          // Atualiza a lista de pontos após salvar
          try {
            await fetchCollectionPoints();
            console.log('Lista de pontos atualizada com sucesso');
          } catch (error) {
            console.error('Erro ao atualizar a lista de pontos:', error);
            // Não interrompe o fluxo, apenas registra o erro
          }
          
          // Retorna para evitar a execução do bloco finally
          return;
          
        } else {
          const errorMessage = saveResults?.message || 'Erro desconhecido ao salvar os pontos de coleta';
          console.error('Erro ao salvar pontos:', errorMessage, saveResults);
          throw new Error(errorMessage);
        }
        
      } catch (error) {
        console.error('Erro ao salvar pontos de coleta:', error);
        
        // Define as variáveis de erro
        let errorMessage = 'Ocorreu um erro ao tentar salvar os pontos de coleta';
        let errorDetails = [];
        let shouldResetForm = false;
        
        // Verifica se é um erro de autenticação expirada
        if (error.response?.status === 401) {
          shouldResetForm = true;
          // Redireciona para a página de login após mostrar a mensagem
          setTimeout(() => {
            // navigate('/login'); // Descomente se estiver usando react-router
          }, 3000);
        }
        
        // Tenta extrair detalhes do erro da resposta da API
        if (error.response) {
          console.error('Detalhes da resposta de erro:', error.response.data);
          
          // Se for um erro de validação do servidor (422)
          if (error.response.status === 422) {
            errorMessage = 'Erro de validação nos dados';
            
            // Tenta extrair detalhes de validação
            if (error.response.data?.detail) {
              const details = error.response.data.detail;
              
              if (typeof details === 'string') {
                errorDetails = [details];
              } else if (Array.isArray(details)) {
                errorDetails = details.map(d => 
                  `- ${d.msg || JSON.stringify(d.loc || d) || 'Erro de validação'}`
                );
              } else if (typeof details === 'object') {
                // Se for um objeto com erros de validação
                if (details.errors && Array.isArray(details.errors)) {
                  errorDetails = details.errors.map(e => 
                    `- ${e.error || 'Erro desconhecido'} (Ponto ${e.index}: ${e.name || 'sem nome'})`
                  );
                } else {
                  errorDetails = [JSON.stringify(details)];
                }
              }
            }
          } 
          // Outros erros da API
          else if (error.response.data?.detail) {
            const detail = error.response.data.detail;
            if (typeof detail === 'string') {
              errorDetails = [detail];
            } else if (typeof detail === 'object') {
              errorDetails = [detail.message || JSON.stringify(detail)];
            }
          } 
          // Erro de autenticação
          else if (error.response.status === 401) {
            errorMessage = 'Falha na autenticação';
            errorDetails = ['Sua sessão expirou. Por favor, faça login novamente.'];
            shouldResetForm = true;
            // Redireciona para a página de login após mostrar a mensagem
            setTimeout(() => {
              // navigate('/login'); // Descomente se estiver usando react-router
            }, 3000);
          }
          // Erro de permissão
          else if (error.response.status === 403) {
            errorMessage = 'Permissão negada';
            errorDetails = ['Você não tem permissão para realizar esta ação.'];
            shouldResetForm = true;
          }
          // Erro de servidor
          else if (error.response.status >= 500) {
            errorMessage = 'Erro no servidor';
            errorDetails = ['Ocorreu um erro no servidor. Por favor, tente novamente mais tarde.'];
          }
        } 
        // Erro de rede
        else if (error.message === 'Network Error') {
          errorMessage = 'Erro de conexão';
          errorDetails = [
            'Não foi possível conectar ao servidor.',
            'Verifique sua conexão com a internet e tente novamente.'
          ];
        }
        // Outros erros
        else if (error.message) {
          errorDetails = [error.message];
        }
        
        // Adiciona detalhes à mensagem de erro
        if (errorDetails.length > 0) {
          errorMessage += '\n\n' + errorDetails.join('\n');
        }
        
        setMessage({
          type: 'error',
          title: 'Erro',
          text: errorMessage,
          showClose: true
        });
        
        // Reseta o formulário se necessário
        if (shouldResetForm) {
          setTimeout(() => {
            setData([]);
            setFile(null);
            setHeaders([]);
            setColumnMapping({});
            setGeocodingStatus('idle');
            setProgress(0);
            setPointsToSave([]);
          }, 500);
        }
      }

    } catch (error) {
      console.error('Erro ao salvar pontos de coleta:', error);

      let errorMessage = 'Erro ao salvar os pontos de coleta. Tente novamente.';
      let errorTitle = 'Erro';
      const errorDetails = [];

      if (error.response) {
        // Erros de validação do servidor
        if (error.response.status === 422) {
          errorTitle = 'Erro de Validação';
          errorMessage = 'Alguns dados não atenderam às regras de validação.';

          // Processa erros de validação do Pydantic
          if (error.response.data?.detail) {
            const details = Array.isArray(error.response.data.detail)
              ? error.response.data.detail
              : [error.response.data.detail];

            errorDetails.push(...details.map((err, idx) => ({
              index: err.loc ? parseInt(err.loc[1]) || idx : idx,
              name: pointsToSave[err.loc ? parseInt(err.loc[1]) : idx]?.name || 'Ponto sem nome',
              external_id: pointsToSave[err.loc ? parseInt(err.loc[1]) : idx]?.external_id || null,
              error: err.msg || 'Dados inválidos',
              field: err.loc ? err.loc[err.loc.length - 1] : 'geral'
            })));
          }
        }
        else if (error.response.status === 400) {
          errorTitle = 'Dados Inválidos';
          errorMessage = 'Verifique os campos obrigatórios e tente novamente.';
        }
        else if (error.response.status === 401) {
          errorTitle = 'Não Autorizado';
          errorMessage = 'Sua sessão expirou. Por favor, faça login novamente.';
        }
        else if (error.response.status === 500) {
          errorTitle = 'Erro no Servidor';
          errorMessage = 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.';
        }

        // Se houver mensagem de erro direta
        if (error.response.data?.detail && !Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail;
        }
      } else if (error.message === 'Network Error') {
        errorTitle = 'Erro de Conexão';
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
      }

      setSaveResults({
        success: false,
        total: pointsToSave?.length || 0,
        created: 0,
        updated: 0,
        errors: errorDetails.length || 1,
        error_details: errorDetails,
        error_message: errorMessage
      });

      setMessage({
        type: 'danger',
        title: errorTitle,
        text: errorMessage,
        details: errorDetails.length > 0
          ? 'Verifique os detalhes dos erros abaixo.'
          : 'Tente novamente ou entre em contato com o suporte se o problema persistir.',
        showClose: true
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para consultar pontos salvos no banco de dados
  const fetchSavedPoints = async () => {
    try {
      setLoadingSavedPoints(true);
      const response = await collectionPointService.getAll();

      console.log('Pontos recuperados do banco de dados:', {
        total: response.length,
        sample: response.slice(0, 3) // Mostra os 3 primeiros para debug
      });

      setSavedPoints(response);
      setShowSavedPoints(true);

      setMessage({
        type: 'success',
        title: 'Consulta realizada',
        text: `Foram encontrados ${response.length} pontos no banco de dados.`,
        showClose: true
      });

      return response;
    } catch (error) {
      console.error('Erro ao buscar pontos salvos:', error);

      setMessage({
        type: 'danger',
        title: 'Erro ao buscar pontos',
        text: 'Não foi possível carregar os pontos salvos.',
        details: error.message,
        showClose: true
      });

      return [];
    } finally {
      setLoadingSavedPoints(false);
    }
  };

  // Função para baixar o modelo de importação
  const downloadTemplate = () => {
    const templateData = [
      ['id_externo', 'nome', 'endereco', 'bairro', 'cidade', 'estado', 'cep', 'telefone', 'referencia', 'frequencia'],
      ['PONTO001', 'Exemplo 1', 'Rua Exemplo 123', 'Centro', 'São Paulo', 'SP', '01001000', '11999999999', 'Próximo ao mercado', 'semanal'],
      ['PONTO002', 'Exemplo 2', 'Avenida Teste 456', 'Vila Mariana', 'São Paulo', 'SP', '04001000', '11888888888', 'Em frente ao banco', 'quinzenal']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_pontos.xlsx');
  };

  // Função para obter o rótulo em português do campo
  const getFieldLabel = (field) => {
    const labels = {
      id: 'ID Único',
      name: 'Nome',
      address: 'Endereço',
      neighborhood: 'Bairro',
      city: 'Cidade',
      state: 'Estado',
      zip_code: 'CEP',
      phone: 'Telefone',
      frequency: 'Periodicidade',
      reference: 'Referência',
      latitude: 'Latitude',
      longitude: 'Longitude'
    };
    return labels[field] || field.replace('_', ' ');
  };

  // Função para formatar detalhes de erro para exibição
  const formatErrorDetails = (error) => {
    if (!error) return null;

    // Se for um objeto de erro completo
    if (error.message && error.stack) {
      return `${error.message}\n\n${error.stack}`;
    }

    // Se for uma string simples
    if (typeof error === 'string') {
      return error;
    }

    // Se for um objeto, tenta converter para string
    try {
      return JSON.stringify(error, null, 2);
    } catch (e) {
      return 'Erro desconhecido';
    }
  };

  // Função para renderizar a mensagem de status
  const renderStatusMessage = () => {
    if (!message) return null;

    // Estilos personalizados para diferentes tipos de mensagem
    const alertStyles = {
      success: {
        icon: <FaCheckCircle className="me-2" />,
        className: 'alert-success',
      },
      error: {
        icon: <FaExclamationCircle className="me-2" />,
        className: 'alert-danger',
      },
      warning: {
        icon: <FaExclamationTriangle className="me-2" />,
        className: 'alert-warning',
      },
      info: {
        icon: <FaInfoCircle className="me-2" />,
        className: 'alert-info',
      },
    };

    const style = alertStyles[message.type] || alertStyles.info;
    const details = message.details ? formatErrorDetails(message.details) : null;

    return (
      <Alert
        variant={message.type}
        onClose={() => setMessage({})}
        dismissible={!!message.showClose}
        className={`mt-3 ${style.className}`}
      >
        <div className="d-flex align-items-center">
          {style.icon}
          <Alert.Heading className="mb-0">{message.title || 'Mensagem'}</Alert.Heading>
        </div>
        <div className="mt-2">
          <p className="mb-1">{message.text}</p>
          {details && (
            <div className="mt-2">
              <Button
                variant="link"
                size="sm"
                className="p-0 text-decoration-none"
                onClick={() => {
                  const detailsElement = document.getElementById('error-details');
                  if (detailsElement) {
                    detailsElement.style.display =
                      detailsElement.style.display === 'none' ? 'block' : 'none';
                  }
                }}
              >
                {message.type === 'error' ? 'Ver detalhes do erro' : 'Ver detalhes'}
              </Button>
              <pre
                id="error-details"
                className="mt-2 mb-0 p-2 bg-dark text-white rounded"
                style={{
                  display: 'none',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {details}
              </pre>
            </div>
          )}
        </div>
      </Alert>
    );
  };

  // Estilos para a tabela
  const tableStyles = {
    '--bs-table-bg': 'transparent',
    '--bs-table-striped-bg': 'rgba(0, 0, 0, 0.02)',
    fontSize: '0.875rem'
  };

  // Estilos para as células de coordenadas
  const coordCellStyle = {
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    padding: '0.5rem'
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Importar e Geocodificar Pontos de Coleta</h2>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => navigate('/collection-points')}
        >
          Voltar para Lista de Pontos
        </Button>
      </div>

      {message.text && renderStatusMessage()}

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Importar Arquivo</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <Form.Label>Selecione um arquivo Excel (.xlsx, .xls, .csv)</Form.Label>
                {!file ? (
                  <div className="border rounded p-4 text-center bg-light">
                    <div className="mb-2">
                      <FaUpload size={32} className="text-muted" />
                    </div>
                    <Form.Control
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      disabled={loading}
                      className="d-none"
                      id="file-upload"
                    />
                    <Form.Label htmlFor="file-upload" className="btn btn-outline-primary btn-sm mb-0">
                      Selecionar Arquivo
                    </Form.Label>
                    <p className="small text-muted mt-2 mb-0">
                      Arraste um arquivo aqui ou clique para selecionar
                    </p>
                  </div>
                ) : (
                  <div className="border rounded p-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <FaFileImport className="me-2" />
                        <strong>{file.name}</strong>
                        <div className="small text-muted">
                          {Math.round(file.size / 1024)} KB
                        </div>
                      </div>
                      <Button
                        variant="link"
                        className="text-danger p-0"
                        onClick={() => setFile(null)}
                        disabled={loading}
                      >
                        <FaTimes />
                      </Button>
                    </div>
                  </div>
                )}
                <Form.Text className="text-muted d-block mt-2">
                  <p className="mb-1">O arquivo deve conter colunas para: Nome, Endereço, Bairro, Cidade, Estado, CEP, Telefone, Referência e Frequência.</p>
                  <p className="mb-0 small">
                    <strong>Dica:</strong> Inclua uma coluna com o ID único (ID Externo) para evitar duplicações.
                    Se não for fornecido, um ID temporário será gerado automaticamente.
                  </p>
                </Form.Text>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={downloadTemplate}
                  disabled={loading}
                >
                  <FaFileDownload className="me-1" />
                  Baixar Template
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleColumnMapping}
                  disabled={!file || loading}
                >
                  <FaUpload className="me-1" />
                  Mapear Colunas
                </Button>
              </div>
            </Col>

            <Col md={6}>
              <div className="p-3 bg-light rounded">
                <h6>Instruções:</h6>
                <ol className="small">
                  <li>Baixe o template e preencha com os dados dos pontos de coleta</li>
                  <li>Faça o upload do arquivo preenchido</li>
                  <li>Mapeie as colunas corretamente</li>
                  <li>Execute a geocodificação para obter as coordenadas</li>
                  <li>Revise os resultados e salve no banco de dados</li>
                </ol>
                <p className="text-muted small mb-0">
                  <FaInfoCircle className="me-1" />
                  A geocodificação pode levar alguns minutos dependendo da quantidade de endereços.
                </p>
              </div>
            </Col>
          </Row>

          {headers.length > 0 && (
            <div className="mt-4">
              <h5>Mapeamento de Colunas</h5>
              <p className="text-muted small mb-3">
                <FaInfoCircle className="me-1" />
                Mapeie as colunas do seu arquivo para os campos correspondentes.
                O campo <strong>ID Único</strong> é opcional, mas recomendado para evitar duplicações.
              </p>
              <Row className="g-3">
                {Object.entries(columnMapping).map(([field, value]) => (
                  <Col md={field === 'id' ? 12 : 6} key={field}>
                    <Form.Group className={field === 'id' ? 'border-top border-bottom py-3' : ''}>
                      <Form.Label className={field === 'id' ? 'fw-bold' : ''}>
                        {getFieldLabel(field)}
                        {field === 'id' && (
                          <Badge bg="info" className="ms-2">Opcional</Badge>
                        )}
                        {['name', 'address', 'city', 'state'].includes(field) && (
                          <span className="text-danger">*</span>
                        )}
                      </Form.Label>
                      {field === 'id' && (
                        <Form.Text className="d-block small text-muted mb-2">
                          Identificador único para evitar duplicações. Se não mapeado, um ID temporário será gerado.
                        </Form.Text>
                      )}
                      <Form.Select
                        size="sm"
                        value={columnMapping[field]}
                        onChange={(e) => setColumnMapping({
                          ...columnMapping,
                          [field]: e.target.value
                        })}
                      >
                        <option value="">Selecione a coluna...</option>
                        {headers.map((header, index) => (
                          <option key={index} value={index}>
                            {header} (Coluna {index + 1})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </Card.Body>
      </Card>

      {data.length > 0 && (
        <Card className="mb-4">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Pré-visualização dos Dados</h5>
            <div>
              <Button
                variant="primary"
                size="sm"
                className="me-2"
                onClick={geocodeAddresses}
                disabled={loading || geocodingStatus === 'geocoding'}
              >
                <FaSearchLocation className="me-1" />
                {geocodingStatus === 'geocoding' ? 'Geocodificando...' : 'Iniciar Geocodificação'}
              </Button>

              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  console.log('Botão clicado - Estado atual:', {
                    loading,
                    geocodingStatus,
                    isDisabled: loading || geocodingStatus !== 'done',
                    pointsToSave: preparePointsToSave().length
                  });
                  confirmSave();
                }}
                disabled={loading || geocodingStatus !== 'done'}
                title={geocodingStatus !== 'done'
                  ? 'Conclua a geocodificação primeiro'
                  : loading ? 'Processando...' : 'Salvar pontos no banco de dados'}
              >
                <FaSave className="me-1" />
                Salvar no Banco de Dados
              </Button>
            </div>
          </Card.Header>

          <Card.Body>
            {geocodingStatus === 'geocoding' && (
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>Progresso da Geocodificação</small>
                  <small>{progress}%</small>
                </div>
                <ProgressBar now={progress} animated />
              </div>
            )}

            <div className="table-responsive">
              <Table striped bordered hover size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Único</th>
                    <th>Nome</th>
                    <th>Endereço</th>
                    <th>Bairro</th>
                    <th>Cidade/UF</th>
                    <th>Frequência</th>
                    <th>Dias da Semana</th>
                    <th>Semanas do Mês</th>
                    <th>Status</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Mapa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '120px' }} title={item.id || item.external_id || '-'}>
                          {item.id && !item.id.toString().startsWith('temp_')
                            ? item.id
                            : item.external_id || '-'}
                        </div>
                      </td>
                      <td>{item.name || '-'}</td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }} title={item.address}>
                          {item.address || '-'}
                        </div>
                      </td>
                      <td>{item.neighborhood || '-'}</td>
                      <td>
                        {item.city} {item.state && `- ${item.state}`}
                      </td>
                      <td>
                        {item.frequency || '-'}
                      </td>
                      <td>
                        {item.days_of_week || '-'}
                      </td>
                      <td>
                        {item.frequency && ['SEMANAL', 'DIÁRIA'].includes(item.frequency.toUpperCase()) ? (
                          '1,2,3,4,5'
                        ) : item.weeks_of_month ? (
                          item.weeks_of_month.split(',').map((w, i, arr) => {
                            // Se for frequência quinzenal, mostra 1,3 ou 2,4
                            if (item.frequency === 'quinzenal') {
                              const weeks = item.weeks_of_month.split(',').map(n => n.trim());
                              // Se tiver a semana 1, mostra 1,3, senão mostra 2,4
                              const quinzenalWeeks = weeks.includes('1') ? '1, 3' : '2, 4';
                              return i === 0 ? quinzenalWeeks : '';
                            }
                            // Para outras frequências, mostra os números sem formatação ordinal
                            return (
                              <span key={i}>
                                {w.trim() === 'U' ? 'Última' : w.trim()}
                                {i < arr.length - 1 ? ', ' : ''}
                              </span>
                            );
                          })
                        ) : '-'}
                      </td>
                      <td>
                        {item.status === 'success' ? (
                          item._geocodeQuality === 'high' ? (
                            <Badge bg="success" title="Geocodificação de alta qualidade">
                              <FaCheck className="me-1" /> OK
                            </Badge>
                          ) : (
                            <Badge bg="warning" title="Geocodificação de baixa qualidade">
                              <FaExclamationTriangle className="me-1" /> Baixa Qualidade
                            </Badge>
                          )
                        ) : item.status === 'error' ? (
                          <Badge bg="danger" title={item.geocodeError}>
                            <FaTimes className="me-1" /> Erro
                          </Badge>
                        ) : (
                          <Badge bg="secondary">Pendente</Badge>
                        )}
                      </td>
                      <td style={coordCellStyle}>
                        {item.latitude ? Number(item.latitude).toFixed(6) : '-'}
                      </td>
                      <td style={coordCellStyle}>
                        {item.longitude ? Number(item.longitude).toFixed(6) : '-'}
                      </td>
                      <td className="text-center">
                        {item.latitude && item.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                            title="Abrir no Google Maps"
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem',
                              borderRadius: '50%',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                              e.currentTarget.querySelector('svg').style.transform = 'scale(1.2)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '';
                              e.currentTarget.querySelector('svg').style.transform = '';
                            }}
                          >
                            <FaMapMarkerAlt className="text-danger" style={{ fontSize: '1.1em' }} />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="small text-muted">
                Total: {data.length} |
                Sucesso: {data.filter(i => i.status === 'success').length} |
                Erros: {data.filter(i => i.status === 'error').length}
              </div>

              <div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2"
                  onClick={() => {
                    setData([]);
                    setFile(null);
                    setProgress(0);
                    setGeocodingStatus('idle');
                  }}
                >
                  Limpar Tudo
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Modal de confirmação de salvamento */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Salvamento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Deseja salvar os seguintes pontos no banco de dados?</p>

          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ID Único</th>
                  <th>Nome</th>
                  <th>Endereço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pointsToSave.slice(0, 5).map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <div title={item.id || item.external_id || '-'}>
                        {item.id && !item.id.toString().startsWith('temp_') ? item.id : item.external_id || '-'}
                      </div>
                    </td>
                    <td>{item.name || '-'}</td>
                    <td>{item.address || '-'}</td>
                    <td>
                      {item.status === 'success' ? (
                        <Badge bg="success">OK</Badge>
                      ) : (
                        <Badge bg="warning">Aviso</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {pointsToSave.length > 5 && (
              <div className="text-muted text-center mt-2">
                + {pointsToSave.length - 5} mais...
              </div>
            )}

            <div className="mt-3">
              <p className="mb-1"><strong>Total de pontos a serem salvos:</strong> {pointsToSave.length}</p>
              <p className="mb-0 text-muted">
                Esta operação pode levar alguns instantes. Não feche a página até a conclusão.
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={saveToDatabase}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" size="sm" animation="border" role="status" className="me-2" />
                Salvando...
              </>
            ) : (
              'Confirmar e Salvar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>



      {/* Modal de resultados */}
      <Modal show={Boolean(saveResults)} onHide={() => setSaveResults(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {saveResults?.success ? (
              <span className="text-success"><FaCheckCircle className="me-2" /> Processo concluído com sucesso!</span>
            ) : (
              <span className="text-danger"><FaExclamationTriangle className="me-2" /> Erro ao salvar os pontos</span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant={saveResults?.success ? 'success' : 'danger'}>
            <h5>
              {saveResults?.success ? (
                <><FaCheck className="me-2" /> Processo concluído com sucesso!</>
              ) : (
                <><FaExclamationTriangle className="me-2" /> Ocorreram erros durante o processo</>
              )}
            </h5>
            <div className="mt-2">
              <p className="mb-1">Total de pontos processados: <strong>{saveResults?.total || 0}</strong></p>
              {saveResults?.created > 0 && (
                <p className="mb-1">
                  Novos pontos criados: <strong className="text-success">{saveResults.created}</strong>
                </p>
              )}
              {saveResults?.updated > 0 && (
                <p className="mb-1">
                  Pontos atualizados: <strong className="text-info">{saveResults.updated}</strong>
                </p>
              )}

              {/* Tabela com os pontos criados/atualizados */}
              {(saveResults?.created > 0 || saveResults?.updated > 0) && (
                <div className="mt-3">
                  <h6>Resumo dos Pontos:</h6>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm" className="small">
                      <thead>
                        <tr>
                          <th>ID Único</th>
                          <th>Nome</th>
                          <th>Endereço</th>
                          <th>Cidade/UF</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data
                          .filter(item => item.status === 'success')
                          .slice(0, 5) // Mostra apenas os primeiros 5 itens
                          .map((item, index) => (
                            <tr key={index}>
                              <td>
                                <div className="text-truncate" style={{ maxWidth: '120px' }} title={item.id || item.external_id || '-'}>
                                  {item.id && !item.id.toString().startsWith('temp_')
                                    ? item.id
                                    : item.external_id || '-'}
                                </div>
                              </td>
                              <td>{item.name || '-'}</td>
                              <td>{item.address || '-'}</td>
                              <td>{item.city} {item.state && `- ${item.state}`}</td>
                              <td>
                                <Badge bg="success">
                                  <FaCheck className="me-1" /> Sucesso
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </div>

                  {data.filter(item => item.status === 'success').length > 5 && (
                    <p className="text-muted small mt-2 mb-0">
                      + {data.filter(item => item.status === 'success').length - 5} itens não exibidos
                    </p>
                  )}
                </div>
              )}

              {saveResults?.errors > 0 && (
                <p className="mb-1 text-danger">
                  Erros encontrados: <strong>{saveResults?.errors || 0}</strong>
                </p>
              )}
            </div>
          </Alert>

          {saveResults?.error_details?.length > 0 && (
            <div className="mt-3">
              <h6>Detalhes dos erros:</h6>
              <div className="alert alert-warning p-2">
                <Table striped bordered hover size="sm" className="small">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>ID Único</th>
                      <th>Nome</th>
                      <th>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saveResults.error_details.map((error, idx) => {
                      // Encontra o item correspondente na lista de dados
                      const item = data[error.index];
                      const externalId = item?.id && !item.id.toString().startsWith('temp_')
                        ? item.id
                        : '-';

                      return (
                        <tr key={idx}>
                          <td>{error.index + 1}</td>
                          <td>
                            <div className="text-truncate" style={{ maxWidth: '120px' }} title={externalId}>
                              {externalId}
                            </div>
                          </td>
                          <td>{item?.name || '-'}</td>
                          <td>{error.error}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSaveResults(null)}>
            Fechar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSaveResults(null);
              navigate('/collection-points');
            }}
          >
            Ver Lista de Pontos
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GeocodeUploadPage;