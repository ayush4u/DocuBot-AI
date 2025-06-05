import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { Bot, Send, X, FileText, Menu, Plus, User, LogOut, MessageCircle, Trash2, Sparkles, Paperclip, Moon, Sun, BookOpen } from 'lucide-react';
import ProjectDocumentation from '../components/ProjectDocumentation';
import { Highlight, themes } from 'prism-react-renderer';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  files?: File[];
}

interface User {
  id: string;
  email: string;
}

interface BackendChat {
  id: string;
  name?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface FileResult {
  filename: string;
  status: 'processed' | 'error';
  error?: string;
}

interface BackendMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatHistory {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// Auth Modal Component
const AuthModal = ({
  isOpen,
  onClose,
  type,
  onSwitchType,
  darkMode
}: {
  isOpen: boolean;
  onClose: () => void;
  type: 'signin' | 'signup';
  onSwitchType: (type: 'signin' | 'signup') => void;
  darkMode: boolean;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = type === 'signin' ? '/api/auth/login' : '/api/auth/register';
      const body = type === 'signin'
        ? { email, password }
        : { email, password, confirmPassword };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('auth_token', data.token);
        onClose();
        window.location.reload();
      } else {
        alert(data.message || 'Authentication failed');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-gradient-to-br ${darkMode ? 'from-slate-800 to-gray-900' : 'from-slate-100 to-blue-50'} border ${darkMode ? 'border-gray-700/50' : 'border-gray-200/50'} rounded-2xl p-8 w-full max-w-md shadow-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {type === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>

          {type === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Confirm your password"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Processing...' : (type === 'signin' ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => onSwitchType(type === 'signin' ? 'signup' : 'signin')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            {type === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// Code Block Component for Syntax Highlighting
const CodeBlock: React.FC<{ content: string; darkMode: boolean }> = ({ content, darkMode }) => {
  // Parse code blocks from the content
  const parseContent = (text: string) => {
    const parts = [];
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'javascript',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return parts;
  };

  const parts = parseContent(content);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <div key={index} className="relative">
              <Highlight
                theme={darkMode ? themes.vsDark : themes.github}
                code={part.content}
                language={part.language || 'javascript'}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    className={`${className} rounded-lg p-4 overflow-x-auto text-sm`}
                    style={style}
                  >
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        <span className="mr-4 text-gray-500 select-none">{i + 1}</span>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          );
        }
        return (
          <div key={index} className="whitespace-pre-wrap">
            {part.content}
          </div>
        );
      })}
    </div>
  );
};

export default function Home() {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<{ type: 'signin' | 'signup' | null; open: boolean }>({ type: null, open: false });
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [anonymousMessageCount, setAnonymousMessageCount] = useState(0);
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ANONYMOUS_LIMIT = 3;

  // Load user and chat history on component mount
  useEffect(() => {
    const loadUserData = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch('http://localhost:3001/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setUser(data.user);
              setShowLandingPage(false);
              loadChatHistory(token);
            }
          } else {
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Failed to verify token:', error);
          localStorage.removeItem('auth_token');
        }
      }
    };

    loadUserData();
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async (token: string) => {
    try {
      console.log('📥 Loading chat history...');
      const response = await fetch(`/api/chats?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Chat history response:', data);
        
        // Transform backend response to frontend format
        const transformedHistory: ChatHistory[] = [];
        
        if (data.chats && Array.isArray(data.chats)) {
          data.chats.forEach((chat: BackendChat) => {
            transformedHistory.push({
              id: chat.id,
              name: chat.name || 'Untitled Chat',
              userId: chat.userId,
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              messageCount: chat.messageCount
            });
          });
        }
        
        console.log('📝 Setting chat history:', transformedHistory.length, 'chats');
        setChatHistory(transformedHistory);
      } else {
        console.error('❌ Failed to load chat history:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
      }
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!user && selectedFiles.length > 1) {
      alert('Anonymous users can only upload 1 file. Sign in for unlimited uploads!');
      return;
    }
    if (user && selectedFiles.length > 5) {
      alert('Maximum 5 files allowed per message.');
      return;
    }
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Check anonymous limits
    if (!user) {
      if (anonymousMessageCount >= ANONYMOUS_LIMIT) {
        setShowUpgradePrompt(true);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      files: files.length > 0 ? files : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    if (!user) {
      setAnonymousMessageCount(prev => prev + 1);
    }

    try {
      const formData = new FormData();
      formData.append('message', inputMessage);
      files.forEach(file => formData.append('files', file));
      
      // Include chatId if we're continuing an existing chat
      if (currentChatId) {
        formData.append('chatId', currentChatId);
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (data.files && data.files.length > 0) {
        const fileResults = data.files.map((file: FileResult) =>
          `📄 ${file.filename}: ${file.status === 'processed' ? `✅ Processed` : `❌ ${file.error}`}`
        ).join('\n');

        const fileMessage: Message = {
          id: (Date.now() + 3).toString(),
          text: `File processing complete:\n${fileResults}`,
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, fileMessage]);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Sorry, I encountered an error.',
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      setFiles([]);
      
      // Set the chatId from the response if it's a new chat
      if (data.chatId && !currentChatId) {
        setCurrentChatId(data.chatId);
      }
      
      // Refresh chat history to show the updated chat list
      if (user) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          console.log('🔄 Refreshing chat history after message...');
          // Force immediate refresh
          await loadChatHistory(token);

          // Also refresh the current chat messages if we're in one
          if (currentChatId) {
            console.log('🔄 Refreshing current chat messages...');
            // Find the current chat in the history and reload it
            const currentChat = chatHistory.find(chat => chat.id === currentChatId);
            if (currentChat) {
              await loadChat(currentChat);
            }
          }

          // Also refresh after a delay to ensure backend processing is complete
          setTimeout(async () => {
            await loadChatHistory(token);
            // Also refresh current chat after delay
            if (currentChatId) {
              const currentChat = chatHistory.find(chat => chat.id === currentChatId);
              if (currentChat) {
                await loadChat(currentChat);
              }
            }
          }, 2000);
        }
      } else {
        console.log('⚠️ User not authenticated, skipping chat history refresh');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const loadChat = async (chat: ChatHistory) => {
    try {
      console.log('📥 Loading chat messages for:', chat.id, chat.name);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('❌ No auth token available');
        return;
      }

      // Fetch messages for this specific chat
      const response = await fetch(`/api/chats/${chat.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Chat messages response:', data.messages?.length || 0, 'messages');

        // Convert the messages format to Message format
        const chatMessages: Message[] = [];
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach((msg: BackendMessage) => {
            // Handle different message formats from backend
            if (msg.role === 'user' && msg.content) {
              chatMessages.push({
                id: msg.id,
                text: msg.content,
                sender: 'user',
                timestamp: new Date(msg.timestamp)
              });
            } else if (msg.role === 'assistant' && msg.content) {
              chatMessages.push({
                id: msg.id,
                text: msg.content,
                sender: 'bot',
                timestamp: new Date(msg.timestamp)
              });
            }
          });
        }

        console.log('💬 Setting messages:', chatMessages.length, 'messages for chat:', chat.id);
        setMessages(chatMessages);
        setCurrentChatId(chat.id);
        setSidebarOpen(false);
      } else {
        console.error('❌ Failed to load chat messages:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        // Fallback: just set the chat ID and clear messages
        setMessages([]);
        setCurrentChatId(chat.id);
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('❌ Failed to load chat:', error);
      // Fallback: just set the chat ID
      setMessages([]);
      setCurrentChatId(chat.id);
      setSidebarOpen(false);
    }
  };  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setMessages([]);
    setChatHistory([]);
    setCurrentChatId(null);
    setShowLandingPage(true);
  };

  const startNewChat = () => {
    console.log('🆕 Starting new chat...');
    setMessages([]);
    setFiles([]);
    setCurrentChatId(null);
    setSidebarOpen(false);
  };

  const deleteChat = async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`/api/chat/${chatId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
        if (currentChatId === chatId) {
          setMessages([]);
          setCurrentChatId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const startChat = () => {
    setShowLandingPage(false);
  };

  // Modern Landing Page
  if (showLandingPage) {
    return (
      <div className={`h-screen ${darkMode ? 'bg-black' : 'bg-gradient-to-br from-white via-indigo-50/50 to-cyan-50/40'} transition-all duration-700 overflow-y-auto relative`}>
        {/* Modern Background Effects */}
        {!darkMode && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-200/30 to-cyan-200/30 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-200/20 to-pink-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-blue-100/20 to-indigo-100/20 rounded-full blur-2xl animate-pulse delay-500"></div>
          </div>
        )}
        <Head>
          <title>DocuBot - AI Document Assistant</title>
          <meta name="description" content="AI assistant for document analysis" />
        </Head>

        {/* Header */}
        <header className={`border-b ${darkMode ? 'border-slate-700/30 bg-black/90' : 'border-slate-200/60 bg-white/95'} backdrop-blur-xl shadow-sm`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${darkMode ? 'bg-gradient-to-br from-indigo-600 to-cyan-600' : 'bg-gradient-to-br from-indigo-500 to-cyan-500'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>DocuBot</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-3 rounded-xl transition-all duration-300 ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'} shadow-sm hover:shadow-md`}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                  className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${darkMode ? 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-800' : 'text-indigo-600 hover:text-indigo-700 hover:bg-slate-50'} shadow-sm hover:shadow-md`}
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="mb-8">
              <div className={`inline-flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-400/30' : 'bg-gradient-to-r from-indigo-100/80 to-cyan-100/80 border-indigo-200/50'} border rounded-full text-sm font-medium ${darkMode ? 'text-indigo-300' : 'text-indigo-700'} backdrop-blur-sm shadow-lg`}>
                <Sparkles className="w-4 h-4" />
                Next-Gen AI RAG Technology
              </div>
            </div>

            <h1 className={`text-5xl sm:text-7xl font-black mb-6 ${darkMode ? 'text-white' : 'text-slate-900'} leading-tight`}>
              Chat with Your
              <span className="bg-gradient-to-r from-indigo-600 via-cyan-600 to-purple-600 bg-clip-text text-transparent"> Documents</span>
            </h1>

            <p className={`text-xl ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-10 max-w-3xl mx-auto leading-relaxed`}>
              Experience the future of document interaction with our cutting-edge RAG technology.
              <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent font-semibold"> Upload, ask, and discover insights instantly.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={startChat}
                className="px-10 py-5 bg-gradient-to-r from-indigo-600 via-cyan-600 to-purple-600 hover:from-indigo-700 hover:via-cyan-700 hover:to-purple-700 text-white rounded-2xl font-bold transition-all duration-300 shadow-2xl hover:shadow-3xl hover:shadow-indigo-500/25 transform hover:scale-105 text-lg"
              >
                🚀 Start Chatting
              </button>

              <button
                onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                className={`px-10 py-5 ${darkMode ? 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-600/40' : 'bg-white/80 hover:bg-slate-50/80 border-slate-200/60'} border-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-2xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl backdrop-blur-sm transform hover:scale-105 text-lg`}
              >
                Sign In for Full Access
              </button>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className={`p-8 ${darkMode ? 'bg-black/80' : 'bg-gradient-to-br from-white/90 to-indigo-50/80'} rounded-3xl border ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'} backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 group`}>
                <div className={`w-16 h-16 ${darkMode ? 'bg-gradient-to-br from-indigo-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-indigo-100/80 to-cyan-100/80'} rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                  <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Smart Upload</h3>
                <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm leading-relaxed`}>
                  Process PDFs, docs, spreadsheets, and more with intelligent parsing and instant analysis
                </p>
              </div>

              <div className={`p-8 ${darkMode ? 'bg-black/80' : 'bg-gradient-to-br from-white/90 to-emerald-50/80'} rounded-3xl border ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'} backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 group`}>
                <div className={`w-16 h-16 ${darkMode ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20' : 'bg-gradient-to-br from-emerald-100/80 to-teal-100/80'} rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                  <Bot className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>AI Powered</h3>
                <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm leading-relaxed`}>
                  Advanced AI models with cutting-edge RAG technology for contextually accurate, intelligent responses
                </p>
              </div>

              <div className={`p-8 ${darkMode ? 'bg-black/80' : 'bg-gradient-to-br from-white/90 to-violet-50/80'} rounded-3xl border ${darkMode ? 'border-slate-700/40' : 'border-slate-200/60'} backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 group`}>
                <div className={`w-16 h-16 ${darkMode ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' : 'bg-gradient-to-br from-purple-100/80 to-pink-100/80'} rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                  <BookOpen className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Full Documentation</h3>
                <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm leading-relaxed mb-4`}>
                  Complete technical documentation, API references, and comprehensive setup guides for developers
                </p>
                <button
                  onClick={() => setShowDocumentation(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  View Documentation →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal.open}
          onClose={() => setShowAuthModal({ type: null, open: false })}
          type={showAuthModal.type as 'signin' | 'signup'}
          onSwitchType={(type) => setShowAuthModal({ type, open: true })}
          darkMode={darkMode}
        />

        {/* Documentation Modal */}
        {showDocumentation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-gradient-to-br ${darkMode ? 'from-slate-800 to-gray-900' : 'from-white to-blue-50'} border ${darkMode ? 'border-gray-700/50' : 'border-gray-200/50'} rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl`}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Project Documentation</h2>
                <button
                  onClick={() => setShowDocumentation(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                <ProjectDocumentation darkMode={darkMode} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Upgrade Prompt Modal
  if (showUpgradePrompt) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`bg-gradient-to-br ${darkMode ? 'from-slate-800 to-gray-900' : 'from-white to-indigo-50'} border ${darkMode ? 'border-slate-700/50' : 'border-slate-200/50'} rounded-3xl p-8 w-full max-w-md shadow-2xl backdrop-blur-xl`}>
          <div className="text-center">
            <div className={`w-20 h-20 ${darkMode ? 'bg-gradient-to-br from-indigo-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-indigo-100/80 to-cyan-100/80'} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
              <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>🚀 Upgrade to Continue</h2>
            <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 leading-relaxed`}>
              You&apos;ve reached the anonymous chat limit. Sign in to unlock unlimited chats, multiple file uploads, and chat history!
            </p>
            <div className="space-y-4">
              <button
                onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                ✨ Sign In Now
              </button>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className={`w-full py-3 ${darkMode ? 'bg-slate-700/60 hover:bg-slate-600/60' : 'bg-slate-100/80 hover:bg-slate-200/80'} text-slate-700 dark:text-slate-300 rounded-2xl transition-all duration-300 font-medium backdrop-blur-sm`}
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className={`h-screen ${darkMode ? 'bg-black' : 'bg-gradient-to-br from-white via-indigo-50/40 to-cyan-50/30'} transition-all duration-700 flex overflow-hidden relative`}>
      {/* Modern Background Pattern */}
      {!darkMode && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-200/20 to-cyan-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-200/15 to-pink-200/15 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-blue-100/10 to-indigo-100/10 rounded-full blur-2xl"></div>
        </div>
      )}
      <Head>
        <title>DocuBot - AI Chat</title>
      </Head>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-80 ${darkMode ? 'bg-black/95' : 'bg-gradient-to-b from-white/95 to-slate-50/95 backdrop-blur-xl'} border-r ${darkMode ? 'border-slate-700/30' : 'border-slate-200/40'} transition-all duration-500 ease-out lg:translate-x-0 lg:static lg:inset-0 lg:flex-shrink-0 shadow-2xl ${darkMode ? 'shadow-slate-900/50' : 'shadow-slate-300/30'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={`p-4 border-b ${darkMode ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chats</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            {user && (
              <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-gray-50/50 dark:bg-gray-700/50">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <div>
                  <div className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.email.split('@')[0]}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Pro</div>
                </div>
              </div>
            )}
            {!user && (
              <div className={`mt-4 p-3 rounded-2xl ${darkMode ? 'bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border-indigo-400/20' : 'bg-gradient-to-r from-indigo-50/80 to-cyan-50/80 border-indigo-200/40'} border backdrop-blur-sm shadow-lg`}>
                <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>🚀 Anonymous Mode</div>
                <div className={`text-xs ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{ANONYMOUS_LIMIT - anonymousMessageCount} messages left</div>
              </div>
            )}
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm"
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-2">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageCircle size={24} className="text-gray-400 mx-auto mb-2" />
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No chat history yet
                </div>
                <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                  Start a conversation to see your chat history here
                </div>
              </div>
            ) : (
              chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors text-sm ${
                    currentChatId === chat.id ? 'bg-gray-100/50 dark:bg-gray-700/50' : ''
                  }`}
                  onClick={() => loadChat(chat)}
                >
                  <MessageCircle size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{chat.name || 'Untitled'}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Sidebar Footer */}
          <div className={`p-3 border-t ${darkMode ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header */}
        <div className={`border-b ${darkMode ? 'border-gray-700/50 bg-gray-800/50' : 'border-gray-200/50 bg-slate-300/50'} backdrop-blur-sm px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors backdrop-blur-sm"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>DocuBot</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors ${darkMode ? 'text-gray-400' : 'text-gray-500'} backdrop-blur-sm`}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {!user && (
              <button
                onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors font-medium"
              >
                Sign In
              </button>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.email.split('@')[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 min-h-0 relative">
          {/* Subtle background pattern for light mode */}
          {!darkMode && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-bl from-indigo-100/30 to-cyan-100/30 rounded-full blur-xl"></div>
              <div className="absolute bottom-10 left-10 w-24 h-24 bg-gradient-to-tr from-purple-100/20 to-pink-100/20 rounded-full blur-lg"></div>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full relative z-10">
              <div className="text-center max-w-lg px-6">
                <div className={`w-20 h-20 ${darkMode ? 'bg-gradient-to-br from-slate-700 to-slate-600' : 'bg-gradient-to-br from-indigo-100 to-cyan-100'} rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl`}>
                  <Bot className={`w-10 h-10 ${darkMode ? 'text-slate-300' : 'text-indigo-600'}`} />
                </div>
                <h3 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Welcome to DocuBot</h3>
                <p className={`text-lg mb-6 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Experience the future of document interaction with our cutting-edge RAG technology.</p>
                {!user && (
                  <div className={`bg-gradient-to-r from-indigo-50/90 to-cyan-50/90 dark:from-indigo-500/10 dark:to-cyan-500/10 border border-indigo-200/50 dark:border-indigo-400/20 rounded-2xl p-5 mb-6 backdrop-blur-sm shadow-xl`}>
                    <div className={`text-lg font-bold mb-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>🚀 Anonymous Mode Active</div>
                    <div className={`text-sm ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{ANONYMOUS_LIMIT - anonymousMessageCount} messages remaining</div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sign in for unlimited access</div>
                  </div>
                )}
                {!user && (
                  <button
                    onClick={() => setShowAuthModal({ type: 'signin', open: true })}
                    className="mt-4 px-8 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-2xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    ✨ Sign In for Unlimited Access
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto relative z-10">
              {messages.map((message, index) => (
                <div key={index} className={`flex animate-fade-in-up ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`} style={{animationDelay: `${index * 100}ms`}}>
                  <div className={`flex max-w-4xl w-full ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}>
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-all duration-300 hover:scale-110 ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 via-cyan-500 to-purple-500 shadow-indigo-500/30'
                        : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-500/30'
                    }`}>
                      {message.sender === 'user' ? (
                        <User size={20} className="text-white drop-shadow-sm" />
                      ) : (
                        <Bot size={20} className="text-white drop-shadow-sm" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'} max-w-2xl`}>
                      {/* Message Bubble */}
                      <div className={`px-6 py-5 rounded-3xl shadow-xl backdrop-blur-xl border transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] group ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-br from-indigo-600 via-cyan-600 to-purple-600 text-white border-indigo-400/40 shadow-indigo-500/40 hover:shadow-indigo-500/60'
                          : `${darkMode ? 'bg-gradient-to-br from-slate-800/95 to-slate-700/95 text-slate-100 border-slate-600/40 shadow-slate-900/50' : 'bg-gradient-to-br from-white/98 to-slate-50/95 text-slate-800 border-slate-200/60 shadow-slate-300/50'} hover:shadow-slate-400/60`
                      }`}>
                        {/* File Attachments */}
                        {message.files && message.files.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {message.files.map((file, fileIndex) => (
                              <div key={fileIndex} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                                message.sender === 'user'
                                  ? 'bg-indigo-500/20 border-indigo-400/40 shadow-lg'
                                  : `${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-slate-100/80 border-slate-200/60'} shadow-md`
                              }`}>
                                <FileText size={14} className={
                                  message.sender === 'user' ? 'text-indigo-200' : (darkMode ? 'text-slate-300' : 'text-slate-600')
                                } />
                                <span className={`truncate flex-1 font-medium ${
                                  message.sender === 'user' ? 'text-indigo-100' : (darkMode ? 'text-slate-200' : 'text-slate-700')
                                }`}>{file.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  message.sender === 'user'
                                    ? 'bg-indigo-400/30 text-indigo-200'
                                    : (darkMode ? 'bg-slate-600/50 text-slate-300' : 'bg-slate-200/80 text-slate-600')
                                }`}>
                                  {(file.size / 1024 / 1024).toFixed(1)}MB
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Message Text */}
                        <CodeBlock content={message.text} darkMode={darkMode} />
                      </div>

                      {/* Timestamp */}
                      <div className={`text-xs mt-3 px-3 py-1 rounded-full backdrop-blur-sm transition-all duration-300 ${
                        message.sender === 'user'
                          ? 'text-indigo-200/80 bg-indigo-500/20 text-right'
                          : (darkMode ? 'text-slate-400 bg-slate-700/50' : 'text-slate-500 bg-slate-100/80')
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-lg flex items-center justify-center shadow-emerald-500/30">
                  <Bot size={20} className="text-white drop-shadow-sm animate-pulse" />
                </div>
                <div className={`px-6 py-5 rounded-3xl shadow-xl backdrop-blur-xl border transition-all duration-500 ${
                  darkMode ? 'bg-gradient-to-br from-slate-800/95 to-slate-700/95 text-slate-100 border-slate-600/40 shadow-slate-900/50' : 'bg-gradient-to-br from-white/98 to-slate-50/95 text-slate-800 border-slate-200/60 shadow-slate-300/50'
                }`}>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-indigo-400 to-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-indigo-400 to-cyan-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-indigo-400 to-cyan-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`border-t ${darkMode ? 'border-slate-700/30 bg-black/80' : 'border-slate-200/40 bg-gradient-to-r from-white/90 to-slate-50/90'} backdrop-blur-xl p-6 shadow-2xl ${darkMode ? 'shadow-slate-900/50' : 'shadow-slate-300/30'}`}>
          <div className="max-w-4xl mx-auto">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-4 items-end">
              <div className="flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={user ? "Ask me anything..." : `Type your message... (${ANONYMOUS_LIMIT - anonymousMessageCount} remaining)`}
                  disabled={!user && anonymousMessageCount >= ANONYMOUS_LIMIT}
                  className={`w-full px-6 py-4 text-sm ${darkMode ? 'bg-slate-700/60 border-slate-600/40 text-white placeholder-slate-400' : 'bg-white/80 border-slate-200/60 text-slate-800 placeholder-slate-500'} border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm shadow-lg ${darkMode ? 'shadow-slate-900/30' : 'shadow-slate-200/40'}`}
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  darkMode ? 'hover:bg-gray-700/50 text-gray-400' : 'hover:bg-gray-100/50 text-gray-500'
                } disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm`}
                disabled={!user && anonymousMessageCount >= ANONYMOUS_LIMIT}
                title="Attach files"
              >
                <Paperclip size={16} />
              </button>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping || (!user && anonymousMessageCount >= ANONYMOUS_LIMIT)}
                className={`px-6 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-2xl transition-all duration-300 disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl hover:shadow-indigo-500/25 transform hover:scale-105`}
              >
                <Send size={16} />
              </button>
            </form>

            {files.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <div key={index} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                      darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <FileText size={12} className="text-blue-500" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-500 hover:text-red-500 transition-colors ml-1"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!user && (
              <div className="mt-3 text-center">
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-2 backdrop-blur-sm">
                  <div className="text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {ANONYMOUS_LIMIT - anonymousMessageCount} messages left
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.yaml,.yml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal.open}
        onClose={() => setShowAuthModal({ type: null, open: false })}
        type={showAuthModal.type as 'signin' | 'signup'}
        onSwitchType={(type) => setShowAuthModal({ type, open: true })}
        darkMode={darkMode}
      />
    </div>
  );
}
