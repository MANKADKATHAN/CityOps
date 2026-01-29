
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ChatInterface from '../components/ChatInterface';
import ComplaintForm from '../components/ComplaintForm';
import { Car, Trash2, Droplets, Lightbulb, Activity, ChevronDown, CheckCircle, LogOut, ThumbsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

function Home() {
    const [extractedData, setExtractedData] = useState(null);
    const [showInterface, setShowInterface] = useState(false);
    const interfaceRef = useRef(null);
    const [recentReports, setRecentReports] = useState([]);

    useEffect(() => {
        const fetchReports = async () => {
            const { data } = await supabase
                .from('complaints')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(3);
            if (data) setRecentReports(data);
        };
        fetchReports();

        // Real-time listener
        const channel = supabase
            .channel('public:complaints_home')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaints' }, (payload) => {
                setRecentReports(prev => [payload.new, ...prev].slice(0, 3));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const getTimeAgo = (dateStr) => {
        const diff = (new Date() - new Date(dateStr)) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Resolved': return "bg-green-500/20 text-green-300 border-green-500/30";
            case 'In Progress': return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
            default: return "bg-red-500/20 text-red-300 border-red-500/30";
        }
    };

    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleDataExtraction = (data) => {
        setExtractedData(data);
    };

    const handleStartReporting = () => {
        if (!user) {
            navigate('/login');
            return;
        }

        setShowInterface(true);
        setTimeout(() => {
            interfaceRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleLogout = async () => {
        // Navigate first to ensure UI feedback
        navigate('/login');
        try {
            await signOut();
            setShowInterface(false);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const handleUpvote = async (complaintId) => {
        try {
            // Optimistic update
            setRecentReports(prev => prev.map(report =>
                report.complaint_id === complaintId
                    ? { ...report, upvotes: (report.upvotes || 0) + 1 }
                    : report
            ));

            const response = await fetch(`http://localhost:8000/complaints/${complaintId}/upvote`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Failed to upvote');

            // Optional: Update with server response if needed, 
            // but optimistic update covers it for valid cases.
        } catch (error) {
            console.error("Upvote failed:", error);
            // Revert on error
            setRecentReports(prev => prev.map(report =>
                report.complaint_id === complaintId
                    ? { ...report, upvotes: (report.upvotes || 0) - 1 }
                    : report
            ));
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-800 selection:bg-purple-100 selection:text-purple-900">

            {/* 1. HERO SECTION */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-16 pt-10">

                {/* Abstract shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-40">
                    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-purple-200 blur-3xl filter mix-blend-multiply"></div>
                    <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-blue-200 blur-3xl filter mix-blend-multiply"></div>
                </div>

                <nav className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Activity className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                            CivicPulse
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-3">
                                <Link to="/dashboard" className="text-sm font-semibold text-gray-600 hover:text-blue-600 mr-2">
                                    My Dashboard
                                </Link>
                                <span className="text-sm font-medium text-gray-400 hidden sm:block">|</span>
                                <span className="text-sm font-medium text-gray-600 hidden sm:block">Hi, {user.email?.split('@')[0]}</span>
                                <button onClick={handleLogout} className="text-sm font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors ml-2">
                                    <LogOut className="w-4 h-4" />

                                </button>
                            </div>
                        ) : (
                            <>
                                <Link to="/login" className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                                    Login
                                </Link>
                                <Link to="/signup" className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-black hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </nav>

                <div className="relative z-10 max-w-4xl mx-auto text-center px-4 mt-16 mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-xs font-bold tracking-wide mb-6 border border-blue-200">
                            AI-POWERED PUBLIC SERVICES
                        </span>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
                            Better Cities,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600">One Report at a Time.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Experience the future of civic engagement. Chat with our AI assistant to instantly report potholes, garbage, and more—no forms required.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleStartReporting}
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-bold rounded-full shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 transition-all flex items-center gap-2"
                            >
                                Start Reporting
                                <ChevronDown className="w-5 h-5 animate-bounce" />
                            </motion.button>

                            {!user && (
                                <Link to="/signup" className="px-8 py-4 bg-white text-gray-900 text-lg font-bold rounded-full shadow-md border border-gray-100 hover:bg-gray-50 transition-all">
                                    Join Community
                                </Link>
                            )}
                        </div>

                        {!user && (
                            <p className="mt-4 text-xs text-gray-400">Login required to submit reports</p>
                        )}
                    </motion.div>
                </div>

                {/* 2. STATS BAR */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 translate-y-8">
                    <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div className="text-center p-4">
                            <div className="text-4xl font-extrabold text-gray-900 mb-1">124</div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Issues Today</div>
                        </div>
                        <div className="text-center p-4">
                            <div className="text-4xl font-extrabold text-blue-600 mb-1">98%</div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Verification Rate</div>
                        </div>
                        <div className="text-center p-4">
                            <div className="text-4xl font-extrabold text-purple-600 mb-1">2.4h</div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg. Response Time</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. MAIN INTERFACE (CONDITIONAL) */}
            <AnimatePresence>
                {showInterface && user && (
                    <motion.div
                        ref={interfaceRef}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-gray-50 py-20 px-4 md:px-8 border-t border-gray-200"
                    >
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-gray-900">Report an Issue</h2>
                                <p className="text-gray-500 mt-2">Our AI agent interacts with you to fill out the details.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
                                {/* LEFT: CHAT */}
                                <div className="lg:col-span-5 h-[650px] bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col relative z-10 ring-1 ring-black/5">
                                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 font-medium text-white flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <div className="w-2 h-2 rounded-full bg-green-400 absolute right-0 bottom-0 ring-1 ring-gray-900"></div>
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">🤖</div>
                                            </div>
                                            <span className="tracking-wide text-sm font-semibold">Civic AI Agent</span>
                                        </div>
                                        <div className="flex gap-1.5 opacity-50">
                                            <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden bg-gray-50">
                                        <ChatInterface onExtractData={handleDataExtraction} />
                                    </div>
                                </div>

                                {/* RIGHT: FORM */}
                                <div className="lg:col-span-7 h-[650px] bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col ring-1 ring-black/5 relative">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                                    <div className="p-6 border-b border-gray-50 bg-white">
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                            Submission Review
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto bg-white/50">
                                        <ComplaintForm mappedData={extractedData} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 4. COVERAGE & FEATURES */}
            <section className="py-20 max-w-7xl mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Coverage</h2>
                    <h3 className="text-3xl font-bold text-gray-900">What can you report?</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
                    {[
                        { name: 'Road Damage', icon: Car, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { name: 'Sanitation', icon: Trash2, color: 'text-orange-500', bg: 'bg-orange-50' },
                        { name: 'Water Supply', icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50' },
                        { name: 'Infrastructure', icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-50' }
                    ].map((item) => (
                        <motion.div
                            whileHover={{ y: -5 }}
                            key={item.name}
                            className="p-8 rounded-3xl bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all cursor-default group"
                        >
                            <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                <item.icon className={`w-7 h-7 ${item.color}`} />
                            </div>
                            <h4 className="font-bold text-lg text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-500 mt-2">Report issues instantly</p>
                        </motion.div>
                    ))}
                </div>

                {/* 5. LIVE REPORTS (MOCK) */}
                <div className="bg-gray-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                            <div>
                                <h3 className="text-3xl font-bold mb-2">Live Community Reports</h3>
                                <p className="text-gray-400">See what's happening in your city right now.</p>
                            </div>
                            <Link to="/map" className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full backdrop-blur-md transition-all text-sm font-semibold">
                                View All Reports
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {recentReports.length === 0 ? (
                                <div className="col-span-1 md:col-span-3 text-center text-gray-500 py-10 italic">Waiting for new reports...</div>
                            ) : recentReports.map((report) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={report.complaint_id}
                                    className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(report.status)}`}>
                                            {report.status || 'Pending'}
                                        </div>
                                        <span className="text-xs text-gray-400">{getTimeAgo(report.created_at)}</span>
                                    </div>
                                    <h4 className="font-bold text-lg mb-1 text-white line-clamp-1">{report.issue_type}</h4>
                                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{report.description}</p>
                                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        {report.location_text || 'Unknown Location'}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                                        <button
                                            onClick={() => handleUpvote(report.complaint_id)}
                                            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-blue-400 transition-colors group"
                                        >
                                            <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-blue-500/20 transition-colors">
                                                <ThumbsUp className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <span>{report.upvotes || 0} needs this fixed</span>
                                        </button>

                                        <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                            View Details →
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section >

            <footer className="bg-gray-50 border-t border-gray-200 py-12">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center opacity-60">
                    <div className="flex items-center gap-2 mb-4 md:mb-0">
                        <Activity className="w-5 h-5 text-gray-900" />
                        <span className="font-bold text-gray-900">CivicPulse</span>
                    </div>
                    <div className="flex gap-6 text-sm">
                        <a href="#" className="hover:text-black transition-colors">Privacy</a>
                        <a href="#" className="hover:text-black transition-colors">Terms</a>
                        <a href="#" className="hover:text-black transition-colors">Contact</a>
                    </div>
                    <div className="text-xs text-gray-400 mt-4 md:mt-0">
                        © 2026 CivicPulse Smart City Initiative
                    </div>
                </div>
            </footer>

        </div >
    );
}

export default Home;
