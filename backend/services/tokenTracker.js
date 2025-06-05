// Enhanced Token Tracker Service
// Provides accurate token counting for different models and usage tracking

class TokenTrackerService {
    constructor() {
        this.userTokenUsage = new Map(); // Track usage per user
        this.dailyLimits = {
            groq: 14400,  // Groq free tier: 14,400 requests/day
            openrouter: 1000, // Example limit
            fallback: Infinity
        };
        
        // Token estimation factors for different models
        this.tokenFactors = {
            'llama-3.1-8b-instant': 0.75,  // Groq Llama models
            'gpt-3.5-turbo': 0.75,         // OpenRouter
            'contextual_ai': 0.8           // Our fallback system
        };
    }

    // Accurate token estimation (GPT-style tokenization approximation)
    estimateTokens(text) {
        if (!text) return 0;
        
        // More accurate estimation based on GPT tokenization patterns
        // 1 token ≈ 4 characters for English text
        // But consider spaces, punctuation, special chars
        
        const baseTokens = Math.ceil(text.length / 4);
        
        // Adjustments for more accurate estimation
        const spaceCount = (text.match(/ /g) || []).length;
        const punctuationCount = (text.match(/[.,!?;:]/g) || []).length;
        const specialCharsCount = (text.match(/[<>{}[\]()]/g) || []).length;
        
        // Refined calculation
        const adjustedTokens = baseTokens + Math.floor(spaceCount * 0.1) + Math.floor(punctuationCount * 0.2) + Math.floor(specialCharsCount * 0.3);
        
        return Math.max(1, adjustedTokens);
    }

    // Track token usage for a user
    trackUsage(userId, inputTokens, outputTokens, model = 'unknown') {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `${userId}-${today}`;
        
        if (!this.userTokenUsage.has(userKey)) {
            this.userTokenUsage.set(userKey, {
                date: today,
                userId: userId,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                requestCount: 0,
                modelUsage: {},
                costEstimate: 0
            });
        }
        
        const usage = this.userTokenUsage.get(userKey);
        usage.inputTokens += inputTokens;
        usage.outputTokens += outputTokens;
        usage.totalTokens += (inputTokens + outputTokens);
        usage.requestCount += 1;
        
        // Track model usage
        if (!usage.modelUsage[model]) {
            usage.modelUsage[model] = {
                requests: 0,
                inputTokens: 0,
                outputTokens: 0
            };
        }
        usage.modelUsage[model].requests += 1;
        usage.modelUsage[model].inputTokens += inputTokens;
        usage.modelUsage[model].outputTokens += outputTokens;
        
        return usage;
    }

    // Check if user is within limits
    checkLimits(userId, provider = 'groq') {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `${userId}-${today}`;
        const usage = this.userTokenUsage.get(userKey);
        
        if (!usage) {
            return {
                withinLimit: true,
                requestsUsed: 0,
                requestsRemaining: this.dailyLimits[provider],
                percentageUsed: 0
            };
        }
        
        const limit = this.dailyLimits[provider];
        const used = usage.requestCount;
        const remaining = Math.max(0, limit - used);
        const percentage = Math.round((used / limit) * 100);
        
        return {
            withinLimit: used < limit,
            requestsUsed: used,
            requestsRemaining: remaining,
            percentageUsed: percentage,
            totalTokens: usage.totalTokens
        };
    }

    // Get detailed usage statistics
    getUserUsageStats(userId, days = 7) {
        const stats = {
            totalRequests: 0,
            totalTokens: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            dailyBreakdown: [],
            modelBreakdown: {},
            averageTokensPerRequest: 0
        };
        
        // Get usage for the last N days
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const userKey = `${userId}-${dateStr}`;
            const usage = this.userTokenUsage.get(userKey);
            
            if (usage) {
                stats.totalRequests += usage.requestCount;
                stats.totalTokens += usage.totalTokens;
                stats.totalInputTokens += usage.inputTokens;
                stats.totalOutputTokens += usage.outputTokens;
                
                stats.dailyBreakdown.push({
                    date: dateStr,
                    requests: usage.requestCount,
                    tokens: usage.totalTokens,
                    models: usage.modelUsage
                });
                
                // Aggregate model usage
                Object.entries(usage.modelUsage).forEach(([model, modelStats]) => {
                    if (!stats.modelBreakdown[model]) {
                        stats.modelBreakdown[model] = {
                            requests: 0,
                            inputTokens: 0,
                            outputTokens: 0
                        };
                    }
                    stats.modelBreakdown[model].requests += modelStats.requests;
                    stats.modelBreakdown[model].inputTokens += modelStats.inputTokens;
                    stats.modelBreakdown[model].outputTokens += modelStats.outputTokens;
                });
            } else {
                stats.dailyBreakdown.push({
                    date: dateStr,
                    requests: 0,
                    tokens: 0,
                    models: {}
                });
            }
        }
        
        stats.averageTokensPerRequest = stats.totalRequests > 0 ? 
            Math.round(stats.totalTokens / stats.totalRequests) : 0;
            
        return stats;
    }

    // Calculate cost estimate (if using paid APIs)
    calculateCostEstimate(inputTokens, outputTokens, model = 'groq') {
        // Pricing per 1K tokens (as of 2024)
        const pricing = {
            'groq': { input: 0, output: 0 }, // Free tier
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
            'gpt-4': { input: 0.03, output: 0.06 },
            'claude-3': { input: 0.015, output: 0.075 }
        };
        
        const modelPricing = pricing[model] || { input: 0, output: 0 };
        const inputCost = (inputTokens / 1000) * modelPricing.input;
        const outputCost = (outputTokens / 1000) * modelPricing.output;
        
        return {
            inputCost: Math.round(inputCost * 100000) / 100000, // 5 decimal places
            outputCost: Math.round(outputCost * 100000) / 100000,
            totalCost: Math.round((inputCost + outputCost) * 100000) / 100000
        };
    }

    // Clean up old usage data (keep last 30 days)
    cleanupOldData() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        let cleanedCount = 0;
        for (const [key, usage] of this.userTokenUsage.entries()) {
            if (usage.date < cutoffDate) {
                this.userTokenUsage.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old token usage records`);
        }
    }

    // Get system-wide token statistics
    getSystemStats() {
        const stats = {
            totalUsers: new Set(),
            totalRequests: 0,
            totalTokens: 0,
            topUsers: [],
            modelDistribution: {}
        };
        
        for (const [key, usage] of this.userTokenUsage.entries()) {
            stats.totalUsers.add(usage.userId);
            stats.totalRequests += usage.requestCount;
            stats.totalTokens += usage.totalTokens;
            
            // Model distribution
            Object.entries(usage.modelUsage).forEach(([model, modelStats]) => {
                if (!stats.modelDistribution[model]) {
                    stats.modelDistribution[model] = { requests: 0, tokens: 0 };
                }
                stats.modelDistribution[model].requests += modelStats.requests;
                stats.modelDistribution[model].tokens += (modelStats.inputTokens + modelStats.outputTokens);
            });
        }
        
        stats.totalUsers = stats.totalUsers.size;
        return stats;
    }
}

module.exports = new TokenTrackerService();
