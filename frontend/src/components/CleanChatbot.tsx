import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, MessageCircle, ArrowLeft, Upload, Bot, Sparkles, Zap, Plus, History, Settings, User, FileText } from 'lucide-react';
import { useRouter } from 'next/router';
import AuthService from '../utils/auth';
import { Highlight, themes } from 'prism-react-renderer';

interface Message {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  userMessage: string;
  aiResponse: string;
  timestamp: string;
}

// Code Block Component for Syntax Highlighting
const CodeBlock: React.FC<{ content: string }> = ({ content }) => {
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
                theme={themes.vsDark}
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

export default function CleanChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch chat history and sessions on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = AuthService.getUser();
        if (!user) return;

        // Fetch chat history
        const response = await fetch(`http://localhost:3001/chat/history?userId=${user.id}&limit=20`, {
          headers: AuthService.getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          const historyMessages: Message[] = [];

          data.history.forEach((chat: ChatHistoryItem) => {
            // Add user message
            historyMessages.push({
              text: chat.userMessage,
              sender: 'user',
              timestamp: new Date(chat.timestamp)
            });
            // Add bot response
            historyMessages.push({
              text: chat.aiResponse,
              sender: 'bot',
              timestamp: new Date(chat.timestamp)
            });
          });

          setMessages(historyMessages);
        }

        // Create initial chat session if no messages
        if (messages.length === 0) {
          createNewChat();
        }
      } catch (error) {
        console.error('Failed to fetch chat data:', error);
      }
    };

    fetchData();
  }, []);

  const createNewChat = () => {
    const newChatId = Date.now().toString();
    const newSession: ChatSession = {
      id: newChatId,
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date()
    };
    setChatSessions(prev => [newSession, ...prev]);
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    // In a real app, you'd fetch messages for this specific chat
    // For now, we'll just clear messages for new chats
    const session = chatSessions.find(s => s.id === chatId);
    if (session && session.lastMessage === '') {
      setMessages([]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    setUploading(true);
    const uploadMessage: Message = {
      text: `📎 Uploading ${file.name}...`,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, uploadMessage]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        headers: {
          ...AuthService.getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();

      const successMessage: Message = {
        text: `✅ Successfully uploaded "${data.filename}". You can now ask questions about this document!`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage: Message = {
        text: '❌ Upload failed. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      text: input,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Update current chat session
    if (currentChatId) {
      setChatSessions(prev => prev.map(session =>
        session.id === currentChatId
          ? { ...session, lastMessage: input, title: input.length > 30 ? input.substring(0, 30) + '...' : input }
          : session
      ));
    }

    const messageText = input;
    setInput('');

    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await response.json();
      const botMessage: Message = {
        text: data.response || 'I received your message!',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden flex">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5"></div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-16'} bg-slate-900/50 backdrop-blur-xl border-r border-cyan-400/20 transition-all duration-300 relative z-20 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-cyan-400/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              {sidebarOpen && (
                <div>
                  <h2 className="text-lg font-bold text-white">DocuBot</h2>
                  <p className="text-xs text-gray-400">AI Assistant</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-cyan-400/10 transition-colors"
            >
              <ArrowLeft size={16} className={`text-cyan-300 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25"
          >
            <Plus size={20} className="text-white" />
            {sidebarOpen && <span className="text-white font-medium">New Chat</span>}
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sidebarOpen ? (
            <>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Recent Chats</h3>
              {chatSessions.length === 0 ? (
                <div className="text-center py-8">
                  <History size={48} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No chats yet</p>
                  <p className="text-gray-600 text-xs">Start a new conversation</p>
                </div>
              ) : (
                chatSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => selectChat(session.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      currentChatId === session.id
                        ? 'bg-cyan-400/20 border border-cyan-400/30'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <MessageCircle size={16} className="text-cyan-400 mt-1 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">
                          {session.title}
                        </p>
                        <p className="text-gray-400 text-xs truncate">
                          {session.lastMessage || 'New conversation'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <button
                onClick={createNewChat}
                className="p-3 rounded-lg hover:bg-cyan-400/10 transition-colors"
                title="New Chat"
              >
                <Plus size={20} className="text-cyan-400" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                <History size={16} className="text-cyan-400" />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-cyan-400/20">
          {sidebarOpen && (
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                <Settings size={16} className="text-gray-400" />
                <span className="text-gray-300 text-sm">Settings</span>
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                <User size={16} className="text-gray-400" />
                <span className="text-gray-300 text-sm">Profile</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <ArrowLeft size={16} className="text-gray-400" />
                <span className="text-gray-300 text-sm">Back Home</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <div className="glass border-b border-cyan-400/20 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-2xl shadow-cyan-500/25">
                <Bot size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  DocuBot AI
                </h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-sm text-cyan-300 font-medium">RAG Assistant Online</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-300">
                <Sparkles size={16} className="text-cyan-400" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-cyan-500/25">
                <Bot size={48} className="text-white" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Welcome to DocuBot</h2>
              <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                Upload documents and experience the power of advanced RAG AI.
                Ask anything about your files with unprecedented accuracy.
              </p>
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="glass p-6 rounded-2xl border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300 hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Upload size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Upload Documents</h3>
                  <p className="text-gray-400 text-sm">PDF, Word, Excel, and more</p>
                </div>
                <div className="glass p-6 rounded-2xl border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <MessageCircle size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Ask Questions</h3>
                  <p className="text-gray-400 text-sm">Get instant, accurate answers</p>
                </div>
                <div className="glass p-6 rounded-2xl border border-pink-400/20 hover:border-pink-400/40 transition-all duration-300 hover:scale-105">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-red-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Zap size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">RAG Powered</h3>
                  <p className="text-gray-400 text-sm">Advanced AI understanding</p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-6 py-4 rounded-2xl shadow-lg ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-cyan-500/25'
                      : 'glass border border-cyan-400/20 text-white shadow-cyan-500/10'
                  }`}
                >
                  <div className="text-base leading-relaxed"><CodeBlock content={message.text} /></div>
                  <div className={`text-xs mt-2 ${
                    message.sender === 'user' ? 'text-cyan-100' : 'text-gray-400'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="glass p-6 rounded-3xl border border-cyan-400/20 shadow-2xl shadow-cyan-500/10 m-6">
          <div className="flex items-end gap-4">
            {/* File Upload Button */}
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`group p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 hover:border-cyan-400/50 transition-all duration-300 ${
                  uploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/25'
                }`}
                title="Upload PDF Document"
              >
                <Upload size={24} className="text-cyan-300 group-hover:text-cyan-200" />
                {uploading && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full animate-pulse"></div>
                )}
              </button>
            </div>

            {/* Message Input */}
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your documents..."
                className="w-full resize-none rounded-2xl px-6 py-4 bg-slate-900/50 border border-cyan-400/30 text-white placeholder-gray-400 focus:border-cyan-400/50 focus:outline-none transition-all duration-300 min-h-[56px] max-h-32 text-base"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '56px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className={`group p-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 shadow-lg shadow-cyan-500/25 ${
                input.trim()
                  ? 'hover:scale-110 hover:shadow-cyan-400/40'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Send size={24} className="text-white" />
            </button>
          </div>

          {/* Helper Text */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">
              Press Enter to send • Upload PDFs for document-specific conversations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
