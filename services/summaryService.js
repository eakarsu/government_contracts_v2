const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const https = require('https');

// Create a custom axios instance with conservative connection handling
const axiosInstance = axios.create({
  timeout: 60000, // Reduced to 1 minute to prevent hanging
  httpsAgent: new https.Agent({
    keepAlive: false, // Disable keep-alive to prevent connection pooling issues
    timeout: 60000,
    maxSockets: 5, // Reduced to prevent connection exhaustion
    maxFreeSockets: 2, // Minimal free sockets
  }),
  headers: {
    'Connection': 'close', // Force close connection after each request
  }
});
const { processPDF } = require('./pdfProcessor');
const { estimateTokens } = require('./contentUtils');

// Load environment variables
require('dotenv').config();





// Optimized summarization function - sends all content in one request using middle-out transform
async function summarizeContent(content, apiKey, options = {}) {
  const { isMultiPart = false, partInfo = '', signal } = options;
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  // Check content size but don't chunk - middle-out transform handles up to 280K tokens
  const contentTokens = estimateTokens(content);
  console.log(`📊 [DEBUG] Content size: ${content.length} chars, ~${contentTokens} tokens`);
  console.log(`📊 [DEBUG] Sending entire content in one request using middle-out transform (supports up to 280K tokens)`);
  
  const prompt = `TASK: Analyze government contract document and generate comprehensive RFP response sections.

${isMultiPart ? `SECTION: ${partInfo}` : ''}

CONTRACT DOCUMENT:
"""
${content}
"""

Generate a comprehensive analysis and RFP response content in JSON format. Include all relevant sections that would be needed for a complete RFP response, such as:

- Executive summary with overview and key points
- Technical approach and specifications  
- Management plan and project approach
- Past performance and relevant experience
- Scope of work and deliverables
- Compliance requirements and standards
- Performance metrics and quality measures
- Risk analysis and mitigation strategies
- Implementation guidance and coordination

Structure the response as a JSON object with descriptive field names. Provide detailed, professional content suitable for government contracting. Each section should be comprehensive and address the specific requirements found in the contract document.`;

  try {
    const promptTokens = estimateTokens(prompt);
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🚀 [OPENROUTER-${timestamp}] Starting API request - ${promptTokens.toLocaleString()} tokens`);
    
    const response = await axiosInstance.post(url, {
      model: 'openai/gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'Expert government contract attachment analyst. Return ONLY valid JSON. Follow schema exactly. 10-page depth (~6000 words total).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 32000,
      temperature: 0.2,
      transforms: ["middle-out"],
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'Government Contract Attachment Analyzer'
      },
      timeout: 120000, // Reduced to 2 minutes
      signal // Pass abort signal to axios
    });
    
    const responseTimestamp = new Date().toLocaleTimeString();
    console.log(`✅ [OPENROUTER-${responseTimestamp}] API response received, status: ${response.status}`);

    // Check if response has expected structure
    if (!response.data) {
      console.error('❌ No response data received from API');
      return {
        success: false,
        error: 'No response data from API',
        rawResponse: response
      };
    }

    // Handle case where API returns direct string content (not OpenAI format)
    if (typeof response.data === 'string') {
      console.log('📝 API returned direct string content');
      let cleanedResult = response.data.trim();
      
      // Check if the string is just whitespace
      if (!cleanedResult || cleanedResult.length < 10) {
        console.error('❌ API returned empty or whitespace-only content:', JSON.stringify(response.data));
        return {
          success: false,
          error: 'API returned empty content',
          rawResponse: response.data
        };
      }
      
      // Try to parse as JSON
      try {
        const parsedJSON = JSON.parse(cleanedResult);
        return {
          success: true,
          result: parsedJSON
        };
      } catch (parseError) {
        console.error('❌ Failed to parse direct string response as JSON:', parseError.message);
        return {
          success: false,
          error: 'Direct string response is not valid JSON',
          rawContent: cleanedResult
        };
      }
    }

    // Handle standard OpenAI API format
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error('❌ Unexpected API response structure:', JSON.stringify(response.data, null, 2));
      return {
        success: false,
        error: 'Invalid API response structure - missing choices array',
        rawResponse: response.data
      };
    }

    // Clean the JSON response from OpenAI format
    let cleanedResult = response.data.choices[0].message.content;
    console.log(`📝 Raw API content length: ${cleanedResult ? cleanedResult.length : 0}`);
    console.log(`📝 First 200 chars: ${cleanedResult ? cleanedResult.substring(0, 200) : 'null'}`);
    
    // Check if content is empty or just whitespace
    if (!cleanedResult || cleanedResult.trim().length === 0) {
      console.error('❌ API returned empty message content');
      return {
        success: false,
        error: 'API returned empty message content',
        rawResponse: response.data
      };
    }
    
    cleanedResult = cleanedResult
      .replace(/^.*\s*```json/i,'')
      .replace(/^.*\s*```/,'')
      .replace(/```\s*$/, '')
      .trim();
    
    console.log(`📝 Cleaned result length: ${cleanedResult.length}`);
    console.log(`📝 Cleaned result preview: ${cleanedResult.substring(0, 200)}`);

    try {
      const parsedJSON = JSON.parse(cleanedResult);
      return {
        success: true,
        result: parsedJSON
      };
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      console.error('❌ Content that failed to parse:', cleanedResult.substring(0, 500));
      
      // Try to fix common JSON issues and retry parsing
      let fixedResult = cleanedResult;
      
      try {
        // Fix common JSON formatting issues
        fixedResult = fixedResult
          // Fix unquoted property names
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
          // Fix single quotes
          .replace(/'/g, '"')
          // Fix trailing commas
          .replace(/,\s*([}\]])/g, '$1')
          // Fix escaped quotes issues
          .replace(/\\"/g, '"')
          // Remove any markdown formatting that might have leaked
          .replace(/```json\s*/gi, '')
          .replace(/```\s*$/gi, '')
          // Fix missing commas between properties
          .replace(/"\s*\n\s*"/g, '",\n"')
          // Fix incomplete objects at the end
          .replace(/"\s*$/, '"}')
          // Ensure proper closing
          .trim();
        
        // If it doesn't end with } or ], try to close it
        if (!fixedResult.endsWith('}') && !fixedResult.endsWith(']')) {
          if (fixedResult.includes('{')) {
            fixedResult += '}';
          }
        }
        
        console.log('🔧 Attempting to parse fixed JSON...');
        const parsedFixed = JSON.parse(fixedResult);
        console.log('✅ JSON parsing successful after fixes');
        
        return {
          success: true,
          result: parsedFixed,
          fixed: true
        };
      } catch (fixError) {
        console.error('❌ JSON fixing attempt also failed:', fixError.message);
        
        // Final fallback: try to extract any valid JSON objects from the text
        try {
          const jsonMatch = cleanedResult.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
          if (jsonMatch) {
            const extractedJSON = JSON.parse(jsonMatch[0]);
            console.log('✅ Extracted partial JSON successfully');
            return {
              success: true,
              result: extractedJSON,
              partial: true
            };
          }
        } catch (extractError) {
          // Continue to return error
        }
        
        // Last resort: return a fallback structure to prevent queue crash
        console.warn('⚠️ Creating fallback JSON structure to prevent queue crash');
        const fallbackResult = {
          executive_summary: "AI response parsing failed - document processed but summary unavailable",
          technical_approach: "Content extraction completed but detailed analysis failed due to response format issues",
          error_details: {
            original_error: parseError.message,
            fix_attempt_error: fixError.message,
            content_preview: cleanedResult.substring(0, 200)
          }
        };
        
        return {
          success: true, // Return success to prevent queue crash
          result: fallbackResult,
          fallback: true,
          warning: 'Used fallback structure due to JSON parsing failure'
        };
      }
    }
  } catch (error) {
    console.error('❌ OpenRouter API Error:', error.message);
    if (error.response) {
      console.error('❌ API Response Status:', error.response.status);
      console.error('❌ API Response Headers:', error.response.headers);
      console.error('❌ API Response Data:', error.response.data);
    }
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timed out after 90 seconds');
    }
    
    return {
      success: false,
      error: error.response?.data || error.message,
      errorType: error.code || 'unknown',
      statusCode: error.response?.status
    };
  }
}



// Export all functions for use in your app
module.exports = {
  // Main functions
  processPDF,
  summarizeContent
};
