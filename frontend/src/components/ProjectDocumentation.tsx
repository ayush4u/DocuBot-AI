import React from 'react';
import { Bot, Database, Zap, Shield, Code, GitBranch, FileText, MessageSquare, Users, Sparkles, Brain, Search, Upload, Settings } from 'lucide-react';

interface ProjectDocumentationProps {
  darkMode: boolean;
}

const ProjectDocumentation: React.FC<ProjectDocumentationProps> = ({ darkMode }) => {
  const sections = [
    {
      id: 'hero',
      title: 'Welcome to DocuBot',
      icon: <Bot className="w-8 h-8" />,
      content: (
        <div className="text-center space-y-8">
          <div className="relative">
            <div className={`w-24 h-24 ${darkMode ? 'bg-gradient-to-br from-slate-800 to-slate-700' : 'bg-gradient-to-br from-slate-100 to-slate-200'} rounded-3xl flex items-center justify-center mx-auto shadow-2xl border ${darkMode ? 'border-slate-600' : 'border-slate-300'}`}>
              <Bot className={`w-12 h-12 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`} />
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-slate-400/20 to-slate-500/20 rounded-3xl blur-xl"></div>
          </div>
          <div>
            <h1 className={`text-5xl font-black mb-6 ${darkMode ? 'text-white' : 'text-slate-900'} leading-tight`}>
              Knowledge-Based AI Assistant
            </h1>
            <p className={`text-xl ${darkMode ? 'text-slate-300' : 'text-slate-600'} max-w-4xl mx-auto leading-relaxed mb-4`}>
              A sophisticated AI-powered chatbot with advanced document processing, vector search, and multi-chat management.
              Built with cutting-edge technologies for enterprise-grade performance and user experience.
            </p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'} border rounded-full text-sm font-medium`}>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
              Currently running on local data - not connected to live internet sources
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'architecture',
      title: 'System Architecture',
      icon: <Database className="w-6 h-6" />,
      content: (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Backend Architecture</h3>
            <div className="space-y-4">
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-green-600 to-emerald-600' : 'bg-gradient-to-br from-green-500 to-emerald-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Code className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Node.js + Express</span>
              </div>
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-indigo-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Supabase (PostgreSQL)</span>
              </div>
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-purple-600 to-pink-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>ChromaDB Vector Store</span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Frontend Architecture</h3>
            <div className="space-y-4">
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-cyan-600 to-blue-600' : 'bg-gradient-to-br from-cyan-500 to-blue-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Next.js 15 + React</span>
              </div>
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-indigo-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>TypeScript + Tailwind CSS</span>
              </div>
              <div className={`flex items-center gap-4 p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'} rounded-2xl border backdrop-blur-sm`}>
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-orange-600 to-red-600' : 'bg-gradient-to-br from-orange-500 to-red-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Lucide React Icons</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'rag-system',
      title: 'Advanced RAG Implementation',
      icon: <Brain className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
              Retrieval-Augmented Generation (RAG)
            </h3>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Our RAG system combines document processing, vector embeddings, and intelligent query routing
              to provide contextually relevant responses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-700/50">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">Document Processing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Advanced PDF parsing with page detection, text extraction, and metadata preservation
              </p>
            </div>
            <div className="text-center space-y-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/50">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Search className="w-7 h-7 text-white" />
              </div>
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">Vector Embeddings</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Local embeddings using Xenova Transformers for privacy and performance
              </p>
            </div>
            <div className="text-center space-y-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200/50 dark:border-green-700/50">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">Intelligent Routing</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Smart query classification between RAG and general LLM responses
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Key Features',
      icon: <Sparkles className="w-6 h-6" />,
      content: (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">Multi-Chat Management</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Organize conversations with persistent chat history and easy switching
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-gray-900 dark:text-white">Document Upload</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Support for PDF files with intelligent chunking and context preservation
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-gray-900 dark:text-white">User Authentication</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Secure JWT-based authentication with Supabase integration
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-medium text-gray-900 dark:text-white">Privacy First</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Local embeddings and secure data handling with Row Level Security
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="font-medium text-gray-900 dark:text-white">Real-time Responses</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Streaming responses with intelligent fallback mechanisms
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium text-gray-900 dark:text-white">Open Source</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 pl-8">
              Fully open source with comprehensive documentation and setup guides
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'development',
      title: 'Development Journey',
      icon: <Code className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
              From Concept to Production
            </h3>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Built with modern development practices, comprehensive testing, and production-ready architecture.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-6">
              <h4 className="font-semibold text-lg mb-2">Phase 1: Foundation</h4>
              <p className="text-gray-600 dark:text-gray-300">
                Established the core architecture with Node.js backend, Next.js frontend, and Supabase database.
                Implemented basic chat functionality and user authentication.
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-6">
              <h4 className="font-semibold text-lg mb-2">Phase 2: RAG Integration</h4>
              <p className="text-gray-600 dark:text-gray-300">
                Integrated ChromaDB for vector storage and implemented document processing pipeline.
                Added intelligent query routing and context-aware responses.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-6">
              <h4 className="font-semibold text-lg mb-2">Phase 3: Polish & Production</h4>
              <p className="text-gray-600 dark:text-gray-300">
                Enhanced UI/UX, added comprehensive error handling, implemented proper data relationships,
                and prepared for production deployment with proper documentation.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tech-stack',
      title: 'Complete Tech Stack',
      icon: <Settings className="w-6 h-6" />,
      content: (
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold text-lg mb-4 text-blue-600 dark:text-blue-400">Frontend</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Next.js 15 (App Router)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                React 18 with TypeScript
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Tailwind CSS for styling
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Lucide React for icons
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Responsive design with dark mode
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4 text-green-600 dark:text-green-400">Backend</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Node.js with Express.js
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Supabase (PostgreSQL + Auth)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                ChromaDB for vector storage
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                JWT authentication
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                RESTful API design
              </li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100'} px-4 py-8`}>
      <div className="max-w-6xl mx-auto">
        {sections.map((section, index) => (
          <section key={section.id} className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div className={`p-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border shadow-lg`}>
                <div className={`text-slate-600 dark:text-slate-400`}>
                  {section.icon}
                </div>
              </div>
              <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                {section.title}
              </h2>
            </div>
            <div className={`relative overflow-hidden ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/95 border-slate-200'} rounded-3xl shadow-2xl p-8 border backdrop-blur-xl`}>
              {/* Subtle inner glow effect for dark mode only */}
              {darkMode && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/3 to-purple-600/3 rounded-3xl"></div>
              )}
              <div className="relative z-10">
                {section.content}
              </div>
            </div>
          </section>
        ))}

        <div className="text-center mt-20">
          <div className={`relative overflow-hidden ${darkMode ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500'} rounded-3xl p-12 text-white shadow-2xl`}>
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-slate-300/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="mb-8 text-lg opacity-90 max-w-2xl mx-auto">
                Experience the power of AI-driven document chat with our comprehensive platform.
                Join thousands of users who trust DocuBot for their document analysis needs.
              </p>
              <button className="bg-slate-200 text-blue-600 px-10 py-4 rounded-2xl font-semibold hover:bg-slate-300 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                Start Chatting Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDocumentation;
