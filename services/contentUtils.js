// Content utilities extracted from summaryService.js
// Functions for token estimation and content splitting for AI API calls

// Estimate the number of tokens in a text string
function estimateTokens(text) {
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

// Split content into chunks based on token limits
function splitContentByTokens(content, maxTokens = 100000) {
  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    if (currentTokens + lineTokens > maxTokens && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
      currentTokens = lineTokens;
    } else {
      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

module.exports = {
  estimateTokens,
  splitContentByTokens
};