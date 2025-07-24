const { PrismaClient } = require('@prisma/client');
const nlpService = require('./nlpService');

// Use shared Prisma client instance
const prisma = new PrismaClient();

class ContractSimilarityEngine {
  constructor() {
    this.similarityCache = new Map();
  }

  async findSimilarContracts(targetContract, limit = 5) {
    try {
      // Convert contract ID to integer if it's a string
      const targetId = typeof targetContract.id === 'string' ? parseInt(targetContract.id) : targetContract.id;
      
      // Skip database query if targetId is invalid
      if (!targetId || isNaN(targetId)) {
        console.warn('Invalid target contract ID for similarity search:', targetContract.id);
        return { matches: [], summary: { totalMatches: 0 } };
      }
      
      // Get all contracts for comparison
      const allContracts = await prisma.contract.findMany({
        where: {
          id: { not: targetId },
          postedDate: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
        },
        select: {
          id: true,
          noticeId: true,
          title: true,
          description: true,
          agency: true,
          naicsCode: true,
          setAsideCode: true,
          postedDate: true,
          resourceLinks: true,
          indexedAt: true
        }
      });

      // Calculate similarity scores
      const similarities = await this.calculateSimilarities(targetContract, allContracts);
      
      // Sort by similarity score
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      // Return top matches with additional insights
      const topMatches = similarities.slice(0, limit);
      
      return {
        matches: topMatches,
        summary: this.generateSimilaritySummary(topMatches),
        insights: this.generateContractInsights(topMatches)
      };
    } catch (error) {
      console.error('Error finding similar contracts:', error);
      return { matches: [], summary: {}, insights: [] };
    }
  }

  async calculateSimilarities(target, contracts) {
    const similarities = [];
    
    for (const contract of contracts) {
      const similarity = await this.calculateSimilarityScore(target, contract);
      similarities.push({
        contract,
        similarity: similarity.overall,
        factors: similarity.factors,
        keyMatches: similarity.keyMatches
      });
    }
    
    return similarities;
  }

  async calculateSimilarityScore(target, comparison) {
    const factors = {
      title: await this.calculateTextSimilarity(target.title, comparison.title),
      description: await this.calculateTextSimilarity(target.description, comparison.description),
      agency: this.calculateAgencySimilarity(target.agency, comparison.agency),
      naics: this.calculateNaicsSimilarity(target.naicsCode, comparison.naicsCode),
      setAside: this.calculateSetAsideSimilarity(target.setAsideCode, comparison.setAsideCode),
      size: this.calculateSizeSimilarity(target.awardAmount, comparison.awardAmount),
      temporal: this.calculateTemporalProximity(target.postedDate, comparison.postedDate)
    };

    // Weight the factors
    const weights = {
      title: 0.25,
      description: 0.30,
      agency: 0.15,
      naics: 0.15,
      setAside: 0.10,
      size: 0.10,
      temporal: 0.05
    };

    let overallScore = 0;
    Object.keys(factors).forEach(key => {
      overallScore += factors[key] * weights[key];
    });

    // Identify key matches
    const keyMatches = this.identifyKeyMatches(target, comparison, factors);

    return {
      overall: Math.round(overallScore * 100),
      factors,
      keyMatches
    };
  }

  async calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Simple TF-IDF based similarity
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    // Remove common words
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an']);
    const filtered1 = words1.filter(word => !stopWords.has(word) && word.length > 2);
    const filtered2 = words2.filter(word => !stopWords.has(word) && word.length > 2);
    
    // Calculate Jaccard similarity
    const set1 = new Set(filtered1);
    const set2 = new Set(filtered2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  calculateAgencySimilarity(agency1, agency2) {
    if (!agency1 || !agency2) return 0;
    
    const normalized1 = agency1.toLowerCase().replace(/[^a-z]/g, '');
    const normalized2 = agency2.toLowerCase().replace(/[^a-z]/g, '');
    
    if (normalized1 === normalized2) return 1;
    
    // Check for department matches
    const deptMap = {
      'defense': ['dod', 'army', 'navy', 'airforce', 'marines'],
      'homeland': ['dhs', 'fema', 'cbp', 'ice'],
      'commerce': ['doc', 'census', 'noaa'],
      'energy': ['doe', 'nnsa'],
      'health': ['hhs', 'cdc', 'fda', 'nih']
    };
    
    for (const [dept, agencies] of Object.entries(deptMap)) {
      if (agencies.some(a => normalized1.includes(a)) && agencies.some(a => normalized2.includes(a))) {
        return 0.8;
      }
    }
    
    return 0;
  }

  calculateNaicsSimilarity(naics1, naics2) {
    if (!naics1 || !naics2) return 0;
    
    const str1 = naics1.toString();
    const str2 = naics2.toString();
    
    // Exact match
    if (str1 === str2) return 1;
    
    // Same 4-digit prefix
    if (str1.substring(0, 4) === str2.substring(0, 4)) return 0.8;
    
    // Same 2-digit prefix
    if (str1.substring(0, 2) === str2.substring(0, 2)) return 0.6;
    
    return 0;
  }

  calculateSetAsideSimilarity(setAside1, setAside2) {
    if (!setAside1 || !setAside2) return 0;
    if (setAside1 === setAside2) return 1;
    
    // Map similar set-aside types
    const similarTypes = {
      'SBA': ['SB', 'SDB'],
      'SB': ['SBA', 'SDB'],
      '8(A)': ['SDB'],
      'SDB': ['8(A)']
    };
    
    if (similarTypes[setAside1]?.includes(setAside2)) return 0.7;
    if (similarTypes[setAside2]?.includes(setAside1)) return 0.7;
    
    return 0;
  }

  calculateSizeSimilarity(amount1, amount2) {
    if (!amount1 || !amount2) return 0;
    
    const num1 = this.parseAmount(amount1);
    const num2 = this.parseAmount(amount2);
    
    if (num1 === 0 || num2 === 0) return 0;
    
    // Calculate relative difference
    const maxAmount = Math.max(num1, num2);
    const minAmount = Math.min(num1, num2);
    const ratio = minAmount / maxAmount;
    
    return ratio;
  }

  calculateTemporalProximity(date1, date2) {
    if (!date1 || !date2) return 0;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const daysDiff = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
    
    // Decay similarity as time difference increases
    const maxDays = 365;
    return Math.max(0, 1 - (daysDiff / maxDays));
  }

  identifyKeyMatches(target, comparison, factors) {
    const matches = [];
    
    if (factors.agency > 0.7) {
      matches.push('Same agency or department');
    }
    
    if (factors.naics > 0.6) {
      matches.push('Similar industry classification');
    }
    
    if (factors.title > 0.5) {
      matches.push('Similar project scope');
    }
    
    if (factors.setAside > 0.8) {
      matches.push('Same set-aside requirements');
    }
    
    if (factors.size > 0.7) {
      matches.push('Comparable contract value');
    }
    
    return matches;
  }

  generateSimilaritySummary(matches) {
    if (matches.length === 0) return {};
    
    const agencies = [...new Set(matches.map(m => m.contract.agency))];
    const naicsCodes = [...new Set(matches.map(m => m.contract.naicsCode))];
    const avgAwardAmount = matches.reduce((sum, m) => {
      const amount = this.parseAmount(m.contract.awardAmount);
      return sum + (amount || 0);
    }, 0) / matches.length;
    
    return {
      totalMatches: matches.length,
      uniqueAgencies: agencies.length,
      commonNaics: naicsCodes,
      averageAwardAmount: avgAwardAmount,
      dateRange: {
        oldest: Math.min(...matches.map(m => new Date(m.contract.postedDate))),
        newest: Math.max(...matches.map(m => new Date(m.contract.postedDate)))
      }
    };
  }

  generateContractInsights(matches) {
    if (matches.length === 0) return [];
    
    const insights = [];
    
    // Award rate analysis
    const awardedCount = matches.filter(m => m.contract.awardedTo).length;
    const awardRate = (awardedCount / matches.length) * 100;
    insights.push({
      type: 'award_rate',
      title: 'Award Success Rate',
      value: `${Math.round(awardRate)}%`,
      description: `Based on ${matches.length} similar contracts`
    });
    
    // Average timeline
    const avgTimeline = matches.reduce((sum, m) => {
      const duration = this.calculatePostingDuration(m.contract.postedDate, m.contract.responseDeadline);
      return sum + duration;
    }, 0) / matches.length;
    
    insights.push({
      type: 'timeline',
      title: 'Average Response Time',
      value: `${Math.round(avgTimeline)} days`,
      description: 'Time typically allowed for proposals'
    });
    
    // Price range
    const prices = matches
      .map(m => this.parseAmount(m.contract.awardAmount))
      .filter(p => p > 0)
      .sort((a, b) => a - b);
    
    if (prices.length > 0) {
      const median = prices[Math.floor(prices.length / 2)];
      insights.push({
        type: 'pricing',
        title: 'Typical Award Range',
        value: `$${this.formatCurrency(median)}`,
        description: `Median award amount for similar contracts`
      });
    }
    
    return insights;
  }

  parseAmount(amount) {
    if (!amount) return 0;
    
    const str = amount.toString().toUpperCase();
    let num = parseFloat(str.replace(/[^0-9.]/g, ''));
    
    if (str.includes('K')) num *= 1000;
    if (str.includes('M')) num *= 1000000;
    if (str.includes('B')) num *= 1000000000;
    
    return num;
  }

  formatCurrency(amount) {
    if (!amount) return '0';
    
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    
    return amount.toString();
  }

  calculatePostingDuration(postedDate, responseDeadline) {
    if (!postedDate || !responseDeadline) return 30;
    
    const posted = new Date(postedDate);
    const deadline = new Date(responseDeadline);
    const duration = Math.ceil((deadline - posted) / (1000 * 60 * 60 * 24));
    
    return Math.max(1, duration);
  }

  // Cache similar contracts for performance
  async getCachedSimilarities(contractId) {
    return this.similarityCache.get(contractId);
  }

  async setCachedSimilarities(contractId, similarities) {
    this.similarityCache.set(contractId, {
      data: similarities,
      timestamp: Date.now()
    });
  }

  async clearCache() {
    this.similarityCache.clear();
  }
}

module.exports = new ContractSimilarityEngine();