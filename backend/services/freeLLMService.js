const { HfInference } = require('@huggingface/inference');
const smartLLMService = require('./smartLLMService');

class FreeLLMService {
  constructor() {
    // Legacy HF inference - mainly using Smart LLM Service now
    this.hf = new HfInference(process.env.GROQ_API_KEY);
    this.smartLLM = smartLLMService;
    this.models = {
      // Using models that actually work on HF Inference API
      primary: 'microsoft/DialoGPT-medium',
      chat: 'microsoft/DialoGPT-medium',
      summarization: 'facebook/bart-large-cnn',
      qa: 'deepset/roberta-base-squad2',
      generation: 'gpt2',
      fallback: 'gpt2',
      // These models are definitely available on HF inference
      alternatives: [
        'distilgpt2',
        'gpt2-medium',
        'microsoft/DialoGPT-small'
      ]
    };
    this.rateLimits = new Map();
    this.requestCounts = new Map();
  }

  // Enhanced prompt engineering for better responses
  buildEnhancedPrompt(query, context, documentChunks, conversationHistory) {
    let prompt = '';

    // Add conversation history for context (keep it brief)
    if (conversationHistory && conversationHistory.length > 0) {
      prompt += 'Recent conversation:\n';
      conversationHistory.slice(-2).forEach(conv => {  // Reduced from 3 to 2
        prompt += `User: ${conv.userMessage}\n`;
        prompt += `Assistant: ${conv.botResponse}\n`;
      });
      prompt += '\n';
    }

    // Add document context if available
    if (documentChunks && documentChunks.length > 0) {
      prompt += 'Document content:\n';
      documentChunks.slice(0, 2).forEach((chunk, index) => {  // Reduced from 3 to 2
        prompt += `Doc ${index + 1}: ${chunk.text.substring(0, 200)}\n`;  // Reduced from 400 to 200
      });
      prompt += '\n';
    }

    prompt += `Question: ${query}

Provide a concise, direct answer based on the available information.`;

    return prompt;
  }

  // Multi-model generation with smart fallback
  async generateResponse(prompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 512,
      modelType = 'chat',
      maxRetries = 3
    } = options;

    console.log('🤖 FreeLLMService: Starting response generation...');
    
    // Use the smart LLM service which handles HF API and intelligent fallbacks
    try {
      const result = await this.smartLLM.generateResponse(prompt, options);
      
      if (result && result.response) {
        console.log(`✅ Generated response using: ${result.model}`);
        return {
          response: result.response,
          model: result.model,
          fromCache: result.fromCache
        };
      }
    } catch (error) {
      console.log('❌ Smart LLM failed:', error.message);
    }

    // Final fallback to basic intelligent response
    console.log('⚠️ Using final fallback...');
    return {
      response: this.generateBasicFallback(prompt),
      model: 'basic_fallback',
      fromCache: false
    };
  }

  // Basic fallback for absolute worst case
  generateBasicFallback(prompt) {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('hello') || promptLower.includes('hi')) {
      return "Hello! I'm an AI assistant. How can I help you today?";
    }
    
    if (promptLower.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    }
    
    return `I understand you're asking about "${prompt}". I'm here to help! I can assist with programming, technical questions, and general information. What specific aspect would you like to explore?`;
  }

  // Clean up model responses
  cleanResponse(response, originalPrompt) {
    if (!response) return '';

    // Remove any remnants of the original prompt
    let cleaned = response;
    
    // Remove common model artifacts
    cleaned = cleaned.replace(/^(Response:|Answer:|Assistant:)/i, '');
    cleaned = cleaned.replace(/Human:|User:/gi, '');
    cleaned = cleaned.replace(/\[INST\]|\[\/INST\]/g, '');
    
    // Remove excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  // Rate limiting management
  isRateLimited(model) {
    const now = Date.now();
    const limit = this.rateLimits.get(model);
    return limit && now < limit;
  }

  handleRateLimit(model, error) {
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      // Rate limited, wait 5 minutes
      const waitTime = 5 * 60 * 1000;
      this.rateLimits.set(model, Date.now() + waitTime);
      console.log(`🚫 Rate limit set for ${model}, waiting ${waitTime/1000}s`);
    }
  }

  updateRequestCount(model) {
    const count = this.requestCounts.get(model) || 0;
    this.requestCounts.set(model, count + 1);
  }

  // Enhanced fallback responses
  generateIntelligentFallback(prompt) {
    console.log('🔄 Using intelligent fallback response...');
    console.log('📝 Full prompt received:', prompt ? prompt.substring(0, 200) + '...' : 'undefined');
    
    // Handle undefined prompt
    if (!prompt || typeof prompt !== 'string') {
      return "I'm here to help! How can I assist you today?";
    }
    
    // Extract question from prompt with more robust patterns
    const questionMatch = prompt.match(/Question: (.+?)(?:\n|$)/i) ||
                         prompt.match(/Human: (.+?)(?:\n|Assistant:|$)/i) ||
                         prompt.match(/User: (.+?)(?:\n|$)/i) ||
                         prompt.match(/Human:\s*(.+?)(?:\s*\n\s*Assistant:|$)/is);
    
    // If no specific pattern found, try to get the last meaningful line
    let question = '';
    if (questionMatch) {
      question = questionMatch[1].trim();
    } else {
      // Look for the actual question at the end of the prompt
      const lines = prompt.split('\n').filter(line => line.trim().length > 0);
      // Find lines that look like questions or statements
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && !line.includes('Previous conversation') && !line.includes('You are') && 
            !line.includes('Assistant:') && !line.includes('Response:') && line.length > 3) {
          question = line.replace(/^(Human:|User:)\s*/i, '').trim();
          break;
        }
      }
    }
    
    const contextMatch = prompt.match(/Relevant document information:(.*?)(?:Question:|$)/s);
    const hasContext = contextMatch && contextMatch[1].trim().length > 50;
    
    const questionLower = question.toLowerCase();
    
    console.log(`🔍 Processing question: "${question}"`);
    console.log(`🔍 Question lowercase: "${questionLower}"`);
    
    // Context-aware responses
    if (hasContext) {
      const context = contextMatch[1].trim();
      const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
      
      if (questionLower.includes('summary') || questionLower.includes('about')) {
        const summary = sentences.slice(0, 3).join('. ').substring(0, 300);
        return `Based on the document, here's what I found: ${summary}... This covers the main points related to your question. Would you like me to elaborate on any specific aspect?`;
      }
      
      if (questionLower.includes('quote') || questionLower.includes('example')) {
        const example = sentences.find(s => s.length > 30 && s.length < 200) || sentences[0];
        return `Here's a relevant excerpt from your document: "${example?.trim()}" This relates to your question about the content. Would you like more examples or details?`;
      }
      
      // General context-based response
      const relevantContent = sentences.slice(0, 2).join('. ').substring(0, 250);
      return `Looking at your document, I found: ${relevantContent}... This information is relevant to your question. What specific aspect would you like me to explore further?`;
    }
    
    // Programming and coding questions
    if ((questionLower.includes('python') || questionLower.includes('pythone')) && 
        (questionLower.includes('code') || questionLower.includes('write') || questionLower.includes('program'))) {
      return `Yes! I can help you with Python programming. Here's a simple example:

\`\`\`python
# Hello World in Python
def hello_world():
    print("Hello, World!")
    return "Welcome to Python programming!"

# Call the function
message = hello_world()
print(f"Message: {message}")
\`\`\`

I can help with:
- Basic Python syntax and concepts
- Functions and classes
- Data structures (lists, dictionaries, sets)
- File handling and data processing
- Web scraping and APIs
- Machine learning basics

What specific Python topic would you like to explore? Upload a Python-related document for more detailed assistance!`;
    }
    
    if (questionLower.includes('javascript') && (questionLower.includes('code') || questionLower.includes('write'))) {
      return `Absolutely! I can help you with JavaScript. Here's a basic example:

\`\`\`javascript
// Modern JavaScript example
const greetUser = (name) => {
    return \`Hello, \${name}! Welcome to JavaScript!\`;
};

// Array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]
\`\`\`

I can assist with JavaScript, Node.js, React, and web development. What would you like to build?`;
    }
    
    if ((questionLower.includes('c#') || questionLower.includes('csharp') || questionLower.includes('c sharp')) && 
        (questionLower.includes('code') || questionLower.includes('write') || questionLower.includes('program'))) {
      return `Absolutely! I can help you with C# programming. Here's a simple example:

\`\`\`csharp
using System;
using System.Collections.Generic;
using System.Linq;

namespace HelloWorld
{
    class Program
    {
        static void Main(string[] args)
        {
            // Basic C# example
            Console.WriteLine("Hello, World!");
            
            // Working with collections
            var numbers = new List<int> { 1, 2, 3, 4, 5 };
            var doubled = numbers.Select(x => x * 2).ToList();
            
            Console.WriteLine($"Doubled numbers: {string.Join(", ", doubled)}");
            
            // Object-oriented example
            var person = new Person("John", 25);
            person.Introduce();
        }
    }
    
    public class Person
    {
        public string Name { get; set; }
        public int Age { get; set; }
        
        public Person(string name, int age)
        {
            Name = name;
            Age = age;
        }
        
        public void Introduce()
        {
            Console.WriteLine($"Hi, I'm {Name} and I'm {Age} years old.");
        }
    }
}
\`\`\`

I can help with C# concepts including:
- Object-oriented programming (classes, inheritance, polymorphism)
- LINQ and collections
- Async/await patterns
- .NET Core/Framework development
- Entity Framework and databases
- Web APIs and MVC

What specific C# topic would you like to explore?`;
    }
    
    // General programming questions
    if (questionLower.includes('code') || questionLower.includes('programming') || questionLower.includes('algorithm')) {
      return `Yes! I can help you with programming in multiple languages including Python, JavaScript, Java, C++, and more. I can assist with:

• **Code examples** and syntax
• **Algorithm explanations** and implementations  
• **Best practices** and code optimization
• **Debugging** and problem-solving
• **Data structures** and their usage
• **Project architecture** and design patterns

What programming language or concept would you like to explore? For more specific help, upload relevant documentation or code files!`;
    }
    
    // Technology and AI questions
    if (questionLower.includes('ai') || questionLower.includes('machine learning') || questionLower.includes('artificial intelligence')) {
      return `Great question about AI! I can discuss:

• **Machine Learning** concepts and algorithms
• **Neural Networks** and deep learning
• **Natural Language Processing** (like what I'm doing now!)
• **Computer Vision** and image processing
• **AI Ethics** and responsible development
• **Practical AI applications** in various industries

I'm an AI assistant myself, so I can provide insights into how these systems work. What aspect of AI interests you most?`;
    }
    
    // Web development questions
    if (questionLower.includes('web') && (questionLower.includes('development') || questionLower.includes('design') || questionLower.includes('site'))) {
      return `I'd love to help with web development! I can assist with:

• **Frontend**: HTML, CSS, JavaScript, React, Vue.js
• **Backend**: Node.js, Express, APIs, databases
• **Full-stack** development approaches
• **Responsive design** and mobile-first development
• **Performance optimization** and best practices
• **Deployment** and hosting solutions

What type of web project are you working on? Upload relevant documentation for more targeted assistance!`;
    }
    
    // Data analysis questions  
    if (questionLower.includes('data') && (questionLower.includes('analysis') || questionLower.includes('science') || questionLower.includes('visualization'))) {
      return `I can definitely help with data analysis! Here are areas I can assist with:

• **Python libraries**: Pandas, NumPy, Matplotlib, Seaborn
• **Data cleaning** and preprocessing techniques
• **Statistical analysis** and hypothesis testing
• **Data visualization** and storytelling
• **Machine learning** for predictive analytics
• **SQL** and database querying

What kind of data are you working with? Upload datasets or analysis documents for specific guidance!`;
    }
    
    // Simple greetings and conversational responses
    if (questionLower.match(/^(hi|hello|hey|sup|what's up)$/i)) {
      return `Hello! 👋 I'm your AI assistant. I can help you with:

• **Programming** in Python, JavaScript, and more
• **Document analysis** and Q&A  
• **Code explanations** and examples
• **Technical tutorials** and concepts
• **Project guidance** and problem-solving

What would you like to explore today? Feel free to ask me anything or upload a document for analysis!`;
    }
    
    if (questionLower.includes('how are you') || questionLower.includes('how\'s it going')) {
      return `I'm doing great, thank you for asking! 😊 I'm ready to help you with programming, document analysis, technical questions, and more. What can I assist you with today?`;
    }
    
    if (questionLower.includes('what can you do') || questionLower.includes('help')) {
      return `I'm a versatile AI assistant that can help you with:

🔧 **Programming & Development:**
• Write code in Python, JavaScript, Java, C++, etc.
• Debug and explain existing code
• Provide coding tutorials and examples

📄 **Document Analysis:**
• Read and analyze uploaded documents
• Answer questions about document content
• Summarize complex information

🎯 **Technical Support:**
• Explain technical concepts
• Guide project development
• Troubleshoot problems

How can I help you today?`;
    }
    
    // No context fallback responses
    const responses = {
      greeting: "Hello! I'm your AI assistant. I can help with programming, data analysis, web development, AI concepts, and much more. Upload a document and ask me anything about it!",
      help: "I can help you with:\n• Programming in various languages\n• Document analysis and Q&A\n• Code explanations and examples\n• Technical concepts and tutorials\n• Project guidance and best practices\n\nWhat would you like to explore?",
      capability: "I'm a versatile AI assistant capable of:\n• Reading and analyzing documents\n• Writing and explaining code\n• Answering technical questions\n• Providing tutorials and examples\n• Helping with projects and problem-solving\n\nHow can I assist you today?",
      thanks: "You're welcome! I'm here to help with all your technical questions, programming needs, and document analysis. Feel free to ask more!",
      general: `I understand you're asking about "${question}". I'm ready to help! I can assist with programming, technical questions, document analysis, and much more. For the best results, try uploading a relevant document or asking specific technical questions.`
    };
    
    if (questionLower.match(/^(hi|hello|hey)/)) return responses.greeting;
    if (questionLower.includes('help') || questionLower.includes('what can you do')) return responses.help;
    if (questionLower.includes('what') && questionLower.includes('can')) return responses.capability;
    if (questionLower.includes('thank')) return responses.thanks;
    
    return responses.general;
  }

  // Specialized methods for different tasks
  async summarizeText(text, maxLength = 200) {
    try {
      const response = await this.hf.summarization({
        model: this.models.summarization,
        inputs: text,
        parameters: {
          max_length: maxLength,
          min_length: 50,
          do_sample: false
        }
      });

      return response.summary_text || text.substring(0, maxLength) + '...';
    } catch (error) {
      console.log('❌ Summarization failed:', error.message);
      return text.substring(0, maxLength) + '...';
    }
  }

  async answerQuestion(question, context) {
    try {
      const response = await this.hf.questionAnswering({
        model: this.models.qa,
        inputs: {
          question,
          context
        }
      });

      return response.answer || 'I could not find a specific answer in the provided context.';
    } catch (error) {
      console.log('❌ Question answering failed:', error.message);
      return 'I encountered an issue while processing your question. Please try rephrasing it.';
    }
  }

  // Get service statistics
  getStats() {
    return {
      models: this.models,
      requestCounts: Object.fromEntries(this.requestCounts),
      rateLimits: Object.fromEntries(this.rateLimits),
      totalRequests: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
      availableModels: Object.keys(this.models).length
    };
  }
}

// Export singleton instance
const freeLLMService = new FreeLLMService();

module.exports = {
  freeLLMService,
  FreeLLMService
};
