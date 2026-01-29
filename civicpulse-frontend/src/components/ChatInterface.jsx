import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInterface({ onExtractData }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hello! I am your AI Civic Assistant. Tell me about an issue you see, and I will help you report it.',
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState('English');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    useEffect(() => {
        // Only scroll if there are new messages to show, prevents jumping on initial load
        if (messages.length > 1) {
            scrollToBottom();
        }
    }, [messages]);

    const sendMessage = async (textToUse = null) => {
        const text = textToUse || input;
        if (!text.trim()) return;

        const userMsg = { role: 'user', content: text };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMsg.content,
                    language: language
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            const botMsg = { role: 'assistant', content: data.assistantReply };
            setMessages((prev) => [...prev, botMsg]);

            if (data.extractedData) {
                onExtractData(data.extractedData);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, I encountered an error connecting to the server.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50">

            {/* Decorative BG */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-blue-400 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-400 rounded-full blur-3xl"></div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-0">
                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 flex-shrink-0 shadow-sm">
                                    <Bot className="w-4 h-4 text-indigo-600" />
                                </div>
                            )}

                            <div
                                className={`max-w-[85%] px-5 py-3.5 text-sm shadow-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                    : 'bg-white text-gray-700 rounded-2xl rounded-tl-sm border border-gray-100'
                                    }`}
                            >
                                {msg.content}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 flex-shrink-0 shadow-sm">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Suggested Actions */}
                {messages.length === 1 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col gap-2 items-center mt-8"
                    >
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Try asking</p>
                        <button onClick={() => sendMessage("There is a large pile of garbage near the main market square.")} className="text-sm bg-white border border-blue-100 shadow-sm px-4 py-2 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-200 text-center transition-all w-full max-w-sm">
                            "Garbage dump near main market"
                        </button>
                        <button onClick={() => sendMessage("Deep pothole on 5th Avenue causing traffic.")} className="text-sm bg-white border border-blue-100 shadow-sm px-4 py-2 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-200 text-center transition-all w-full max-w-sm">
                            "Deep pothole on 5th Avenue"
                        </button>
                    </motion.div>
                )}

                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start items-end gap-3"
                    >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 flex-shrink-0">
                            <Bot className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                            <span className="text-xs text-gray-400 font-medium">Analyzing request...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 relative z-10">
                <div className="flex gap-2 mb-3 justify-center">
                    {['Gujarati', 'Hindi', 'English'].map(lang => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${language === lang ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                <div className="relative flex items-center gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all shadow-inner">
                    <input
                        type="text"
                        className="flex-1 bg-transparent p-3 pl-4 text-sm text-gray-800 placeholder-gray-400 outline-none"
                        placeholder="Describe the issue..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={loading || !input.trim()}
                        className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/30 text-white rounded-xl disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center mt-2 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-gray-400">AI auto-extracts complaint details</span>
                </div>
            </div>
        </div>
    );
}
