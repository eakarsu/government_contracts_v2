// Table detection utilities extracted from summaryService.js
// Functions for detecting and formatting table content in PDF documents

function hasSentenceStructure(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasPeriods = /\.s+[A-Z]/.test(fullText);
  const hasMultipleSentences = (fullText.match(/\./g) || []).length > 1;
  const hasLongSentences = fullText.length > 150;
  const hasConjunctions = /\b(and|but|or|however|therefore|because|since|although|while|when|if|unless|until)\b/i.test(fullText);
  const hasArticles = /\b(the|a|an)\b/gi.test(fullText) && (fullText.match(/\b(the|a|an)\b/gi) || []).length > 2;
  const hasPrepositions = /\b(in|on|at|by|for|with|from|to|of|about|through|during|before|after)\b/gi.test(fullText);
  return hasPeriods || hasMultipleSentences || (hasLongSentences && (hasConjunctions || hasArticles || hasPrepositions));
}

function hasWordRelationships(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasExplanations = /\b(based on|analysis of|there is|this is|that is|which is|where the|in order to|due to|as a result|according to)\b/i.test(fullText);
  const hasReferences = /\b(figure|section|page|above|below|following|previous|next|chapter|appendix|table \d+\-\d+)\b/i.test(fullText);
  const hasDescriptive = /\b(very|substantially|significantly|approximately|less than|more than|greater than|similar to|different from|compared to)\b/i.test(fullText);
  const hasComplexPhrases = /\b(construction|development|assessment|evaluation|implementation|consideration|recommendation|conclusion)\b/i.test(fullText);
  return hasExplanations || hasReferences || hasDescriptive || hasComplexPhrases;
}

function isDefinitelyText(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasQuestions = /\?/.test(fullText);
  const hasQuotations = /["']/.test(fullText);
  const hasParentheses = /\([^)]{10,}\)/.test(fullText);
  const hasListItems = /\b(first|second|third|finally|additionally|furthermore|moreover|also)\b/i.test(fullText);
  const hasLongWords = (fullText.match(/\b\w{8,}\b/g) || []).length > 3;
  return hasQuestions || hasQuotations || hasParentheses || hasListItems || hasLongWords;
}

function isTableRow(row) {
  if (!Array.isArray(row)) return false;
  if (hasSentenceStructure(row) || hasWordRelationships(row) || isDefinitelyText(row)) {
    return false;
  }
  const cellCount = row.filter(cell => cell && cell.trim()).length;
  if (cellCount < 2) return false;
  
  const hasTableKeywords = row.some(cell =>
    /^(table|segment|ratio|los|period|us|ky|highway|v\/c)$/i.test(cell.toString().trim())
  );
  const hasNumericData = row.some(cell =>
    /^\d+\.\d+$|^[A-Z]$|^(US|KY)\s*\d+$/.test(cell.toString().trim())
  );
  const hasShortCells = row.every(cell =>
    cell.toString().trim().length < 25
  );
  const cellsAreDisconnected = row.length >= 3 && row.every(cell =>
    cell.toString().trim().split(' ').length <= 2
  );
  const allCellsVeryShort = row.every(cell =>
    cell.toString().trim().length < 15
  );
  const strongTableIndicators = hasTableKeywords || hasNumericData || (cellsAreDisconnected && allCellsVeryShort);
  return strongTableIndicators && hasShortCells && cellCount >= 2;
}

function formatTableContent(rows) {
  let content = '';
  let inTable = false;
  let tableCount = 0;
  let currentTableRows = [];
  
  rows.forEach((row, index) => {
    const isTable = isTableRow(row);
    if (isTable) {
      if (!inTable) {
        tableCount++;
        inTable = true;
        currentTableRows = [];
      }
      currentTableRows.push(row);
    } else {
      if (inTable) {
        if (currentTableRows.length >= 2) {
          content += `\n=== Table ${tableCount} ===\n`;
          currentTableRows.forEach(tableRow => {
            const cleanedCells = tableRow
              .filter(cell => cell && cell.trim())
              .map(cell => cell.toString().trim());
            content += cleanedCells.join(' | ') + '\n';
          });
          content += '\n';
        } else {
          tableCount--;
          currentTableRows.forEach(tableRow => {
            const textContent = Array.isArray(tableRow) ? tableRow.join(' ') : tableRow.toString();
            const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
            if (cleanedText) {
              content += cleanedText + '\n';
            }
          });
        }
        inTable = false;
        currentTableRows = [];
      }
      const textContent = Array.isArray(row) ? row.join(' ') : row.toString();
      const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedText) {
        content += cleanedText + '\n';
      }
    }
  });
  
  if (inTable && currentTableRows.length >= 2) {
    content += `\n=== Table ${tableCount} ===\n`;
    currentTableRows.forEach(tableRow => {
      const cleanedCells = tableRow
        .filter(cell => cell && cell.trim())
        .map(cell => cell.toString().trim());
      content += cleanedCells.join(' | ') + '\n';
    });
  } else if (inTable && currentTableRows.length > 0) {
    currentTableRows.forEach(tableRow => {
      const textContent = Array.isArray(tableRow) ? tableRow.join(' ') : tableRow.toString();
      const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedText) {
        content += cleanedText + '\n';
      }
    });
  }
  return content;
}

module.exports = {
  hasSentenceStructure,
  hasWordRelationships,
  isDefinitelyText,
  isTableRow,
  formatTableContent
};