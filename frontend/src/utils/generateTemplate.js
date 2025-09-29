import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const generateTemplate = () => {
  try {
    // Cria uma nova planilha com cabeçalhos e dados de exemplo
    const data = [
      ['Nome', 'Endereço', 'Latitude', 'Longitude', 'Quantidade', 'Peso (kg)', 'Volume (m³)', 'Início da Janela', 'Fim da Janela'],
      ['Ponto 1', 'Rua Exemplo, 123', -23.5505, -46.6333, 1, 1, 0.1, '08:00', '17:00'],
      ['Ponto 2', 'Avenida Teste, 456', -23.5510, -46.6340, 2, 1.5, 0.15, '09:00', '18:00']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Ajusta a largura das colunas
    ws['!cols'] = [
      { wch: 20 }, // Nome
      { wch: 30 }, // Endereço
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
      { wch: 12 }, // Quantidade
      { wch: 12 }, // Peso
      { wch: 15 }, // Volume
      { wch: 15 }, // Início da Janela
      { wch: 15 }  // Fim da Janela
    ];

    // Adiciona estilo de cabeçalho
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'D9D9D9' } }
    };

    // Aplica o estilo ao cabeçalho
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = { c: C, r: 0 };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      ws[cellRef].s = headerStyle;
    }

    // Cria um novo workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pontos de Coleta');

    // Gera o buffer do arquivo Excel
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Cria um blob e faz o download
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(dataBlob, 'modelo_pontos_coleta.xlsx');
    
  } catch (error) {
    console.error('Erro ao gerar o modelo:', error);
    alert('Ocorreu um erro ao gerar o modelo. Por favor, tente novamente.');
  }
};
