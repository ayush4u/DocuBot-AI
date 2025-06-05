require('dotenv').config();
const smartLLMService = require('./services/smartLLMService');
const tokenTracker = require('./services/tokenTracker');

async function testTokenTracking() {
    console.log('🔢 Testing Enhanced Token Tracking System...\n');
    
    const testUserId = 'test_user_123';
    
    const testQuestions = [
        "Can you list top 3 super bikes?",
        "What's the fastest supercar?", 
        "Explain machine learning in simple terms",
        "Hello, how are you doing today?",
        "Tell me about JavaScript frameworks"
    ];
    
    console.log('📊 Before testing - Usage check:');
    const initialLimits = tokenTracker.checkLimits(testUserId, 'groq');
    console.log(`   Requests used: ${initialLimits.requestsUsed}/${initialLimits.requestsUsed + initialLimits.requestsRemaining}`);
    console.log(`   Percentage used: ${initialLimits.percentageUsed}%\n`);
    
    for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        console.log(`\n❓ Question ${i + 1}: "${question}"`);
        console.log('─'.repeat(60));
        
        try {
            const result = await smartLLMService.generateResponse(question, { userId: testUserId });
            
            console.log(`🤖 Model: ${result.model}`);
            console.log(`📤 Source: ${result.source}`);
            console.log(`🔢 Token Usage:`);
            console.log(`   Input: ${result.usage.inputTokens} tokens`);
            console.log(`   Output: ${result.usage.outputTokens} tokens`);
            console.log(`   Total: ${result.usage.totalTokens} tokens`);
            console.log(`📈 Daily Usage: ${result.usage.dailyUsage.requestCount} requests, ${result.usage.dailyUsage.totalTokens} total tokens`);
            console.log(`🎯 Remaining Today: ${result.usage.limits.requestsRemaining} requests (${result.usage.limits.percentageUsed}% used)`);
            
            console.log(`\n💬 Response Preview: "${result.response.substring(0, 100)}..."\n`);
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
        
        console.log('='.repeat(70));
    }
    
    // Show comprehensive usage statistics
    console.log('\n📊 COMPREHENSIVE USAGE STATISTICS:');
    console.log('='.repeat(50));
    
    const stats = tokenTracker.getUserUsageStats(testUserId, 7);
    console.log(`\n👤 User: ${testUserId}`);
    console.log(`📝 Total Requests (7 days): ${stats.totalRequests}`);
    console.log(`🔢 Total Tokens (7 days): ${stats.totalTokens}`);
    console.log(`📥 Input Tokens: ${stats.totalInputTokens}`);
    console.log(`📤 Output Tokens: ${stats.totalOutputTokens}`);
    console.log(`📊 Average Tokens/Request: ${stats.averageTokensPerRequest}`);
    
    console.log(`\n🤖 Model Breakdown:`);
    Object.entries(stats.modelBreakdown).forEach(([model, modelStats]) => {
        console.log(`   ${model}:`);
        console.log(`     Requests: ${modelStats.requests}`);
        console.log(`     Input Tokens: ${modelStats.inputTokens}`);
        console.log(`     Output Tokens: ${modelStats.outputTokens}`);
    });
    
    console.log(`\n📅 Daily Breakdown:`);
    stats.dailyBreakdown.slice(0, 3).forEach(day => {
        console.log(`   ${day.date}: ${day.requests} requests, ${day.tokens} tokens`);
    });
    
    // Show system-wide statistics
    console.log('\n🌐 SYSTEM-WIDE STATISTICS:');
    console.log('='.repeat(40));
    const systemStats = tokenTracker.getSystemStats();
    console.log(`👥 Total Users: ${systemStats.totalUsers}`);
    console.log(`📝 Total Requests: ${systemStats.totalRequests}`);
    console.log(`🔢 Total Tokens: ${systemStats.totalTokens}`);
    
    console.log(`\n🤖 Model Distribution:`);
    Object.entries(systemStats.modelDistribution).forEach(([model, stats]) => {
        console.log(`   ${model}: ${stats.requests} requests, ${stats.tokens} tokens`);
    });
    
    // Test rate limiting
    console.log('\n🚫 RATE LIMITING TEST:');
    console.log('='.repeat(30));
    const currentLimits = tokenTracker.checkLimits(testUserId, 'groq');
    console.log(`Current Status: ${currentLimits.withinLimit ? '✅ Within Limits' : '❌ Over Limit'}`);
    console.log(`Usage: ${currentLimits.requestsUsed}/${currentLimits.requestsUsed + currentLimits.requestsRemaining} (${currentLimits.percentageUsed}%)`);
    
    if (currentLimits.percentageUsed > 80) {
        console.log('⚠️  WARNING: Approaching daily limit!');
    }
}

if (require.main === module) {
    testTokenTracking();
}

module.exports = { testTokenTracking };
