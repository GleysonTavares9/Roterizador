import { useState, useCallback } from 'react';
import { Button, Modal, Form, Alert, Spinner, Table } from 'react-bootstrap';
import { FaUpload, FaCheck, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import * as XLSX from 'xlsx';

const PointImporter = ({ show, onHide, onImport }) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    quantity: '',
    weight: '',
    volume: '',
    timeWindowStart: '',
    timeWindowEnd: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState([]);

  // Processa o arquivo quando selecionado
  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    // Lê o arquivo
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error('O arquivo deve conter pelo menos um cabeçalho e uma linha de dados');
        }

        const headers = jsonData[0].map(h => h?.toString().trim() || '');
        const rows = jsonData.slice(1).filter(row => row.length > 0);
        
        setHeaders(headers);
        setData(rows);
        setPreviewData(rows.slice(0, 5)); // Mostra apenas as primeiras 5 linhas para pré-visualização
        
        // Tenta fazer um mapeamento automático
        const autoMapping = {};
        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('nome') || lowerHeader.includes('name')) {
            autoMapping.name = index;
          } else if (lowerHeader.includes('endereço') || lowerHeader.includes('address')) {
            autoMapping.address = index;
          } else if (lowerHeader.includes('lat') || lowerHeader.includes('latitude')) {
            autoMapping.lat = index;
          } else if (lowerHeader.includes('lng') || lowerHeader.includes('longitude') || lowerHeader.includes('long')) {
            autoMapping.lng = index;
          } else if (lowerHeader.includes('quantidade') || lowerHeader.includes('qtd') || lowerHeader.includes('quantity')) {
            autoMapping.quantity = index;
          } else if (lowerHeader.includes('peso') || lowerHeader.includes('weight')) {
            autoMapping.weight = index;
          } else if (lowerHeader.includes('volume') || lowerHeader.includes('cubagem')) {
            autoMapping.volume = index;
          } else if (lowerHeader.includes('inicio') || lowerHeader.includes('início') || lowerHeader.includes('start')) {
            autoMapping.timeWindowStart = index;
          } else if (lowerHeader.includes('fim') || lowerHeader.includes('end')) {
            autoMapping.timeWindowEnd = index;
          }
        });
        
        setMapping(autoMapping);
      } catch (err) {
        console.error('Erro ao processar o arquivo:', err);
        setError('Erro ao processar o arquivo. Certifique-se de que é um arquivo Excel ou CSV válido.');
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo. Tente novamente.');
    };
    reader.readAsArrayBuffer(selectedFile);
  }, []);

  // Atualiza o mapeamento de colunas
  const handleMappingChange = (field, value) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === '' ? '' : parseInt(value, 10)
    }));
  };

  // Valida se todos os campos obrigatórios estão mapeados
  const validateMapping = () => {
    if (mapping.name === '' || mapping.lat === '' || mapping.lng === '') {
      setError('Por favor, mapeie pelo menos as colunas Nome, Latitude e Longitude');
      return false;
    }
    return true;
  };

  // Processa os dados e chama a função de importação
  const handleImport = () => {
    if (!validateMapping()) return;

    const processedData = data.map(row => {
      // Função auxiliar para converter valores para número com fallback
      const toNumber = (value, fallback = 0) => {
        const num = parseFloat(value);
        return isNaN(num) ? fallback : num;
      };

      // Função auxiliar para formatar horário
      const formatTime = (timeValue, defaultValue) => {
        if (!timeValue && timeValue !== 0) return defaultValue;
        const str = timeValue.toString().trim();
        // Tenta converter para horário no formato HH:MM
        if (/^\d{1,2}:\d{2}$/.test(str)) return str;
        // Se for um número, assume que é hora
        if (/^\d+$/.test(str)) return `${str.padStart(2, '0')}:00`;
        return defaultValue;
      };

      return {
        name: row[mapping.name]?.toString() || 'Sem nome',
        address: mapping.address !== '' && row[mapping.address] ? row[mapping.address].toString() : '',
        lat: parseFloat(row[mapping.lat]),
        lng: parseFloat(row[mapping.lng]),
        quantity: mapping.quantity !== '' && row[mapping.quantity] !== undefined ? toNumber(row[mapping.quantity], 1) : 1,
        weight: mapping.weight !== '' && row[mapping.weight] !== undefined ? toNumber(row[mapping.weight], 0) : 0,
        volume: mapping.volume !== '' && row[mapping.volume] !== undefined ? toNumber(row[mapping.volume], 0.1) : 0.1,
        timeWindow: {
          start: mapping.timeWindowStart !== '' && row[mapping.timeWindowStart] !== undefined ? 
            formatTime(row[mapping.timeWindowStart], '08:00') : '08:00',
          end: mapping.timeWindowEnd !== '' && row[mapping.timeWindowEnd] !== undefined ? 
            formatTime(row[mapping.timeWindowEnd], '18:00') : '18:00'
        }
      };
    });

    onImport(processedData);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Importar Pontos de Coleta</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Form.Group className="mb-3">
          <Form.Label>Selecione o arquivo (Excel ou CSV)</Form.Label>
          <Form.Control 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleFileChange}
          />
          <Form.Text className="text-muted">
            O arquivo deve conter colunas para Nome, Latitude e Longitude. 
            Os outros campos são opcionais.
          </Form.Text>
        </Form.Group>

        {headers.length > 0 && (
          <>
            <h5 className="mt-4">Mapear Colunas</h5>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Nome</Form.Label>
                  <Form.Select 
                    value={mapping.name} 
                    onChange={(e) => handleMappingChange('name', e.target.value)}
                    className={mapping.name === '' ? 'border-danger' : 'border-success'}
                  >
                    <option value="">Selecione a coluna</option>
                    {headers.map((header, index) => (
                      <option key={`name-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Endereço (Opcional)</Form.Label>
                  <Form.Select 
                    value={mapping.address} 
                    onChange={(e) => handleMappingChange('address', e.target.value)}
                  >
                    <option value="">Não usar</option>
                    {headers.map((header, index) => (
                      <option key={`addr-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Latitude</Form.Label>
                  <Form.Select 
                    value={mapping.lat} 
                    onChange={(e) => handleMappingChange('lat', e.target.value)}
                    className={mapping.lat === '' ? 'border-danger' : 'border-success'}
                  >
                    <option value="">Selecione a coluna</option>
                    {headers.map((header, index) => (
                      <option key={`lat-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              {/* Longitude */}
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Longitude *</Form.Label>
                  <Form.Select 
                    value={mapping.lng} 
                    onChange={(e) => handleMappingChange('lng', e.target.value)}
                    className={mapping.lng === '' ? 'border-danger' : 'border-success'}
                  >
                    <option value="">Selecione a coluna</option>
                    {headers.map((header, index) => (
                      <option key={`lng-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              
              {/* Quantidade */}
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>Quantidade (Padrão: 1)</Form.Label>
                  <Form.Select 
                    value={mapping.quantity} 
                    onChange={(e) => handleMappingChange('quantity', e.target.value)}
                  >
                    <option value="">Não usar (usar 1)</option>
                    {headers.map((header, index) => (
                      <option key={`qty-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              
              {/* Peso */}
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>Peso (kg) (Padrão: 0)</Form.Label>
                  <Form.Select 
                    value={mapping.weight} 
                    onChange={(e) => handleMappingChange('weight', e.target.value)}
                  >
                    <option value="">Não usar (usar 0)</option>
                    {headers.map((header, index) => (
                      <option key={`wgt-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              
              {/* Volume */}
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>Volume (m³) (Padrão: 0.1)</Form.Label>
                  <Form.Select 
                    value={mapping.volume} 
                    onChange={(e) => handleMappingChange('volume', e.target.value)}
                  >
                    <option value="">Não usar (usar 0.1)</option>
                    {headers.map((header, index) => (
                      <option key={`vol-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              
              {/* Janela de Tempo - Início */}
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Início da Janela (Padrão: 08:00)</Form.Label>
                  <Form.Select 
                    value={mapping.timeWindowStart} 
                    onChange={(e) => handleMappingChange('timeWindowStart', e.target.value)}
                  >
                    <option value="">Não usar (usar 08:00)</option>
                    {headers.map((header, index) => (
                      <option key={`start-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              
              {/* Janela de Tempo - Fim */}
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Fim da Janela (Padrão: 18:00)</Form.Label>
                  <Form.Select 
                    value={mapping.timeWindowEnd} 
                    onChange={(e) => handleMappingChange('timeWindowEnd', e.target.value)}
                  >
                    <option value="">Não usar (usar 18:00)</option>
                    {headers.map((header, index) => (
                      <option key={`end-${index}`} value={index}>
                        {header} (Coluna {index + 1})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <h5 className="mt-4">Pré-visualização</h5>
            <div className="table-responsive">
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Nome</th>
                    {mapping.address !== '' && <th>Endereço</th>}
                    <th>Latitude</th>
                    <th>Longitude</th>
                    {mapping.quantity !== '' && <th>Quantidade</th>}
                    {mapping.weight !== '' && <th>Peso (kg)</th>}
                    {mapping.volume !== '' && <th>Volume (m³)</th>}
                    {(mapping.timeWindowStart !== '' || mapping.timeWindowEnd !== '') && (
                      <th>Janela de Tempo</th>
                    )}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, rowIndex) => (
                    <tr key={`prev-${rowIndex}`}>
                      <td>{row[mapping.name]?.toString() || <span className="text-muted">-</span>}</td>
                      {mapping.address !== '' && (
                        <td>{row[mapping.address]?.toString() || <span className="text-muted">-</span>}</td>
                      )}
                      <td className={isNaN(parseFloat(row[mapping.lat])) ? 'text-danger' : ''}>
                        {mapping.lat !== '' ? row[mapping.lat] : '?'}
                      </td>
                      <td className={isNaN(parseFloat(row[mapping.lng])) ? 'text-danger' : ''}>
                        {mapping.lng !== '' ? row[mapping.lng] : '?'}
                      </td>
                      {mapping.quantity !== '' && (
                        <td>{row[mapping.quantity] ?? '1'}</td>
                      )}
                      {mapping.weight !== '' && (
                        <td>{row[mapping.weight] ?? '0'}</td>
                      )}
                      {mapping.volume !== '' && (
                        <td>{row[mapping.volume] ?? '0.1'}</td>
                      )}
                      {(mapping.timeWindowStart !== '' || mapping.timeWindowEnd !== '') && (
                        <td>
                          {mapping.timeWindowStart !== '' ? (row[mapping.timeWindowStart] || '08:00') : '08:00'}
                          {' - '}
                          {mapping.timeWindowEnd !== '' ? (row[mapping.timeWindowEnd] || '18:00') : '18:00'}
                        </td>
                      )}
                      <td>
                        {mapping.name !== '' && 
                         mapping.lat !== '' && 
                         mapping.lng !== '' &&
                         !isNaN(parseFloat(row[mapping.lat])) && 
                         !isNaN(parseFloat(row[mapping.lng])) ? (
                          <FaCheck className="text-success" />
                        ) : (
                          <FaTimes className="text-danger" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {previewData.length < data.length && (
              <div className="text-muted small">
                Mostrando {previewData.length} de {data.length} pontos
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button 
          variant="primary" 
          onClick={handleImport}
          disabled={headers.length === 0 || mapping.name === '' || mapping.lat === '' || mapping.lng === ''}
        >
          {loading ? <Spinner animation="border" size="sm" /> : 'Importar Pontos'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PointImporter;
