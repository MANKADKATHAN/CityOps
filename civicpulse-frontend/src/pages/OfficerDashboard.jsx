import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, LogOut, Loader2, MapPin, Calendar, CheckSquare, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OfficerDashboard() {
    const { user, role, signOut, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [officerDept, setOfficerDept] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPriority, setFilterPriority] = useState('All');
    const [searchLocation, setSearchLocation] = useState('');

    useEffect(() => {
        const verifyOfficerAccess = async () => {
            if (authLoading) return;

            if (!user) {
                navigate('/login');
                return;
            }

            // Fetch Role AND Department
            const { data, error } = await supabase
                .from('profiles')
                .select('role, department')
                .eq('id', user.id)
                .single();

            if (data?.role === 'officer') {
                console.log("Officer verified. Department:", data.department);
                setOfficerDept(data.department); // Store department
            } else {
                console.warn("Access denied.");
                navigate('/dashboard');
            }
            setLoading(false);
        };

        verifyOfficerAccess();
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user && role === 'officer' && officerDept !== undefined) {
            // Only fetch once we know the department (even if null)
            fetchAllComplaints(officerDept);
        }
    }, [user, role, officerDept]);

    const fetchAllComplaints = async (dept) => {
        try {
            setLoading(true);

            let query = supabase
                .from('complaints')
                .select(`
                    *,
                    profiles:user_id (
                        username,
                        full_name
                    )
                `)
                .order('created_at', { ascending: false });

            // FILTER BY DEPARTMENT (Routing Logic)
            if (dept) {
                query = query.eq('assigned_department', dept);
            }

            let result = await query;

            if (result.error) {
                console.warn("User details fetch failed (likely missing Foreign Key). Retrying with simple fetch...", result.error);
                result = await supabase
                    .from('complaints')
                    .select('*')
                    .order('created_at', { ascending: false });

                // If filtering by Dept
                if (dept) {
                    result = await supabase
                        .from('complaints')
                        .select('*')
                        .eq('assigned_department', dept)
                        .order('created_at', { ascending: false });
                }
            }

            if (result.error) throw result.error;
            setComplaints(result.data || []);
        } catch (err) {
            console.error('CRITICAL: Error fetching complaints:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
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

    const updateStatus = async (id, newStatus, currentStatus) => {
        try {
            // 1. Update Complaint Status
            const { error } = await supabase
                .from('complaints')
                .update({ status: newStatus })
                .eq('complaint_id', id);

            if (error) throw error;

            // 2. Create Audit Log (Manual Insert to guarantee it's stored)
            await supabase.from('status_logs').insert({
                complaint_id: id,
                old_status: currentStatus,
                new_status: newStatus,
                changed_by: user.id
            });

            // 3. AGENT TRIGGER: If Resolved, notify the citizen
            if (newStatus === 'Resolved') {
                const complaint = complaints.find(c => c.complaint_id === id);
                if (complaint && complaint.profiles) {
                    // Non-blocking call to backend agent
                    fetch(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/agent/notify-resolution', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            complaint_id: id,
                            user_email: complaint.profiles.username,
                            user_name: complaint.profiles.full_name || 'Citizen',
                            issue_description: complaint.description
                        })
                    }).then(res => res.json())
                        .then(data => {
                            console.log("Agent Response:", data);
                            alert(`✅ Status Updated!\n🤖 Agent Created Notification:\nSubject: ${data.email_preview?.subject}`);
                        })
                        .catch(err => console.error("Agent Error:", err));
                }
            } else {
                alert("Status Updated");
            }

            // Optimistic update
            setComplaints(prev => prev.map(c =>
                c.complaint_id === id ? { ...c, status: newStatus } : c
            ));
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Filter Logic
    const filteredComplaints = complaints.filter(c => {
        const matchStatus = filterStatus === 'All' || c.status === filterStatus;
        const matchPriority = filterPriority === 'All' || c.priority === filterPriority;
        const matchLoc = searchLocation === '' || (c.location_text || '').toLowerCase().includes(searchLocation.toLowerCase());
        return matchStatus && matchPriority && matchLoc;
    });

    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-gray-900 font-sans text-gray-100">
            {/* Navbar */}
            <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                            <CheckSquare className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">CivicPulse <span className="text-blue-400 font-normal">Officer Portal</span></span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-400 hidden sm:block">
                            {user?.email} <span className="text-gray-600">|</span> <span className="text-blue-400">{officerDept || 'No Dept'}</span>
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-sm font-semibold text-gray-400 hover:text-white flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Incoming Reports</h1>
                        <p className="text-gray-400">Manage and resolve reported civic issues</p>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Search location..."
                            value={searchLocation}
                            onChange={(e) => setSearchLocation(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-sm text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        />
                        <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-sm text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="All">All Priority</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-sm text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="All">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-8">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                        <p className="text-gray-500 font-medium">Loading reports...</p>
                    </div>
                ) : filteredComplaints.length === 0 ? (
                    <div className="text-center py-20 bg-gray-800 rounded-3xl border border-dashed border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-2">No Matching Reports</h3>
                        <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredComplaints.map((complaint) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={complaint.complaint_id}
                                className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm flex flex-col md:flex-row gap-6"
                            >
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

                                    <h3 className="text-lg font-bold text-white mb-2">
                                        {complaint.issue_type}
                                    </h3>
                                    <p className="text-gray-400 mb-4">{complaint.description}</p>

                                    <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-gray-500" />
                                            {complaint.location_text || 'No location'}
                                        </div>
                                        <div>
                                            Priority: <span className={`font-semibold ${complaint.priority === 'High' ? 'text-red-400' : 'text-gray-300'
                                                }`}>{complaint.priority}</span>
                                        </div>
                                        <div>
                                            Dept: <span className="text-blue-400">{complaint.assigned_department}</span>
                                        </div>
                                        <div>
                                            Reported by: <span className="text-gray-300">
                                                {complaint.profiles?.full_name || complaint.profiles?.username || 'Anonymous'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Coordinates Debug */}
                                    {(complaint.latitude !== 0 && complaint.longitude !== 0) && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-400 hover:text-blue-300 underline mb-4 block"
                                        >
                                            View on Map ({complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)})
                                        </a>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => updateStatus(complaint.complaint_id, 'In Progress', complaint.status)}
                                            className="px-3 py-1.5 bg-yellow-900/30 text-yellow-500 border border-yellow-900/50 rounded-md text-xs font-bold hover:bg-yellow-900/50 transition-colors"
                                        >
                                            Mark In Progress
                                        </button>
                                        <button
                                            onClick={() => updateStatus(complaint.complaint_id, 'Resolved', complaint.status)}
                                            className="px-3 py-1.5 bg-green-900/30 text-green-500 border border-green-900/50 rounded-md text-xs font-bold hover:bg-green-900/50 transition-colors"
                                        >
                                            Mark Resolved
                                        </button>
                                    </div>
                                </div>

                                {complaint.image_url && (
                                    <div className="w-full md:w-48 h-48 flex-shrink-0 bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
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
