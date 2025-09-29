const fs = require('fs');
const path = require('path');

// Diretório raiz do projeto frontend
const rootDir = path.join(__dirname, 'src');

// Função para remover console.log de um arquivo
function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove linhas que contêm apenas console.log e variáveis não utilizadas
    let newContent = content
      .split('\n')
      .filter(line => {
        // Remove linhas que contêm console.log
        if (line.trim().startsWith('console.log')) {
          return false;
        }
        // Remove variáveis não utilizadas (opcional, descomente se necessário)
        // if (line.includes('// eslint-disable-next-line no-unused-vars') || 
        //     line.includes('eslint-disable-next-line no-unused-vars')) {
        //   return false;
        // }
        return true;
      })
      .join('\n');
    
    // Remove múltiplas quebras de linha consecutivas
    newContent = newContent.replace(/\n{3,}/g, '\n\n');
    
    // Escreve o conteúdo de volta ao arquivo se houve alterações
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Logs removidos de: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Erro ao processar o arquivo ${filePath}:`, error);
    return false;
  }
}

// Função para percorrer diretórios
function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  let count = 0;
  
  files.forEach(file => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Ignora a pasta node_modules
      if (file !== 'node_modules') {
        count += processDirectory(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      if (removeConsoleLogs(fullPath)) {
        count++;
      }
    }
  });
  
  return count;
}

console.log('Iniciando remoção de logs...');
const filesProcessed = processDirectory(rootDir);
console.log(`\n✅ Concluído! ${filesProcessed} arquivos foram processados.`);
