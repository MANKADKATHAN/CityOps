import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, LogOut, Loader2, MapPin, Calendar, AlertCircle, Clock, CheckCircle, Map as MapIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
    const { user, signOut, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [authLoading, user, navigate]);

    useEffect(() => {
        if (user) {
            // Safety Check: Redirect Officers if they end up here by mistake
            const checkRole = async () => {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (data?.role === 'officer') {
                    navigate('/officer-dashboard');
                } else {
                    fetchComplaints();
                }
            };
            checkRole();
        }
    }, [user]);

    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('complaints')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error Details:", error);
                setError(error);
            } else {
                setComplaints(data || []);
                setError('');
            }
        } catch (err) {
            console.error('Error fetching complaints:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('citizen-dashboard-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'complaints',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log("Real-time update received!", payload);
                    // Update local state instantly
                    setComplaints(prev => prev.map(c =>
                        c.complaint_id === payload.new.complaint_id
                            ? { ...c, ...payload.new }
                            : c
                    ));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleLogout = async () => {
        // Navigate immediately so the user feels the action
        navigate('/login');
        try {
            await signOut();
        } catch (e) {
            console.error("Logout error:", e);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
            case 'in progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
            {/* Navbar */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md group-hover:shadow-blue-500/30 transition-all">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-gray-900 tracking-tight">CivicPulse</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-500 hidden sm:block">
                            {user?.email}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-sm font-semibold text-gray-500 hover:text-red-600 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Complaints</h1>
                        <p className="text-gray-500">Track the status of reported issues</p>
                    </div>
                    <div className="flex gap-3">
                        <Link to="/map" className="inline-flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg shadow-sm transition-all transform hover:-translate-y-0.5 gap-2">
                            <MapIcon className="w-4 h-4" /> View Map
                        </Link>
                        <Link to="/" className="inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5">
                            + New Complaint
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-start gap-3 mb-8">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="overflow-auto max-w-full">
                            <p className="font-bold">Error Loading Data</p>
                            <pre className="text-xs mt-1 bg-red-100 p-2 rounded">
                                {typeof error === 'object' ? (error.message || JSON.stringify(error, null, 2)) : error}
                            </pre>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                        <p className="text-gray-400 font-medium">Loading your reports...</p>
                    </div>
                ) : complaints.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Activity className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No complaints yet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">You haven't submitted any reports yet. Be a good citizen and report issues you see!</p>
                        <Link to="/" className="text-blue-600 font-semibold hover:underline">
                            Start Reporting
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {complaints.map((complaint) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={complaint.complaint_id}
                                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 relative overflow-hidden"
                            >
                                {/* Status Strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${complaint.status === 'Resolved' ? 'bg-green-500' :
                                    complaint.status === 'In Progress' ? 'bg-yellow-500' : 'bg-gray-300'
                                    }`}></div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(complaint.status)} uppercase tracking-wider`}>
                                                {complaint.status || 'Pending'}
                                            </span>
                                            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {formatDate(complaint.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
                                        {complaint.issue_type} <span className="text-gray-400 font-normal mx-1">•</span> {complaint.description}
                                    </h3>

                                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {complaint.location_text || 'No location provided'}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            Priority: <span className={`font-semibold ${complaint.priority === 'High' ? 'text-red-500' : 'text-gray-700'
                                                }`}>{complaint.priority}</span>
                                        </div>
                                    </div>

                                    <div className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded-md border border-blue-100">
                                        Assigned to: {complaint.assigned_department || 'Pending Assignment'}
                                    </div>
                                </div>

                                {complaint.image_url && (
                                    <div className="w-full md:w-32 h-32 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
                                        <img src={complaint.image_url} alt="Evidence" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
