/**
 * Safe JSON parsing utilities
 * Provides robust error handling for JSON.parse operations
 */

const logger = require('../config/logger');

/**
 * Safely parse JSON with fallback value
 * @param {string} jsonString - The JSON string to parse
 * @param {any} fallbackValue - Value to return if parsing fails (default: null)
 * @param {string} context - Context description for logging (optional)
 * @returns {any} Parsed JSON or fallback value
 */
function safeJsonParse(jsonString, fallbackValue = null, context = 'Unknown') {
  try {
    if (!jsonString || typeof jsonString !== 'string' || jsonString.trim() === '') {
      return fallbackValue;
    }
    return JSON.parse(jsonString);
  } catch (parseError) {
    logger.warn(`JSON parsing failed in ${context}:`, parseError.message);
    logger.warn(`Invalid JSON content:`, jsonString?.substring(0, 200) + '...');
    return fallbackValue;
  }
}

/**
 * Parse JSON array with fallback to empty array
 * @param {string} jsonString - The JSON string to parse
 * @param {string} context - Context description for logging (optional)
 * @returns {Array} Parsed array or empty array
 */
function safeJsonParseArray(jsonString, context = 'Unknown') {
  return safeJsonParse(jsonString, [], context);
}

/**
 * Parse JSON object with fallback to empty object
 * @param {string} jsonString - The JSON string to parse
 * @param {string} context - Context description for logging (optional)
 * @returns {Object} Parsed object or empty object
 */
function safeJsonParseObject(jsonString, context = 'Unknown') {
  return safeJsonParse(jsonString, {}, context);
}

/**
 * Extract and parse JSON from AI response content
 * Handles markdown formatting and extracts JSON blocks
 * @param {string} content - AI response content
 * @param {any} fallbackValue - Value to return if parsing fails
 * @param {string} context - Context description for logging
 * @returns {any} Parsed JSON or fallback value
 */
function parseAIResponseJson(content, fallbackValue = null, context = 'AI Response') {
  try {
    if (!content || typeof content !== 'string') {
      return fallbackValue;
    }

    // Clean up markdown formatting
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract JSON block
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return safeJsonParse(jsonMatch[0], fallbackValue, context);
    }

    // If no JSON block found, try parsing the whole content
    return safeJsonParse(cleanContent, fallbackValue, context);
  } catch (error) {
    logger.warn(`AI response JSON extraction failed in ${context}:`, error.message);
    return fallbackValue;
  }
}

module.exports = {
  safeJsonParse,
  safeJsonParseArray,
  safeJsonParseObject,
  parseAIResponseJson
};