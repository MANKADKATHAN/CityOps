import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, LogOut, Loader2, MapPin, Calendar, CheckSquare, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Helper to auto-fit bounds (Reused logic)
const FitBounds = ({ complaints }) => {
    const map = useMap();
    useEffect(() => {
        if (complaints.length > 0) {
            const bounds = complaints.map(c => [c.latitude || 0, c.longitude || 0]).filter(p => p[0] !== 0);
            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [complaints, map]);
    return null;
};

export default function OfficerDashboard() {
    const { user, role, signOut, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

    const [officerDept, setOfficerDept] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPriority, setFilterPriority] = useState('All');
    const [searchLocation, setSearchLocation] = useState('');

    useEffect(() => {
        // ... (Existing verifyOfficerAccess logic remains same)
        const verifyOfficerAccess = async () => {
            // ... existing code ...
            if (authLoading) return;

            if (!user) {
                navigate('/login');
                return;
            }

            // 1. Check Metadata (Fastest)
            const metaRole = user.user_metadata?.role;
            const metaDept = user.user_metadata?.department;

            // 2. Fetch from DB (Source of Truth)
            const { data, error } = await supabase
                .from('profiles')
                .select('role, department')
                .eq('id', user.id)
                .single();

            const verifiedRole = data?.role || metaRole;
            const verifiedDept = data?.department || metaDept;

            if (verifiedRole === 'officer') {
                console.log("Officer verified. Department:", verifiedDept);
                setOfficerDept(verifiedDept); // Store department
                setLoading(false);
            } else {
                console.warn("Access denied. Role:", verifiedRole);
                navigate('/dashboard');
            }
        };
        verifyOfficerAccess();
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user && officerDept !== undefined) { // Simplify check
            fetchAllComplaints(officerDept);
        }
    }, [user, officerDept]);

    const fetchAllComplaints = async (dept) => {
        // ... (Existing fetch logic remains same)
        try {
            setLoading(true);
            let query = supabase.from('complaints').select(`*, profiles:user_id (username, full_name)`).order('created_at', { ascending: false });
            if (dept) query = query.eq('assigned_department', dept);

            let result = await query;
            if (result.error) {
                // Fallback logic
                result = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
                if (dept) result = await supabase.from('complaints').select('*').eq('assigned_department', dept).order('created_at', { ascending: false });
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
        try { await signOut(); } catch (e) { console.error("Logout error:", e); }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
            case 'in progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const updateStatus = async (id, newStatus, currentStatus) => {
        // ... (Existing update logic remains same)
        try {
            const { error } = await supabase.from('complaints').update({ status: newStatus }).eq('complaint_id', id);
            if (error) throw error;

            // Log manually
            await supabase.from('status_logs').insert({ complaint_id: id, old_status: currentStatus, new_status: newStatus, changed_by: user.id });

            // Agent Trigger
            if (newStatus === 'Resolved') {
                const complaint = complaints.find(c => c.complaint_id === id);
                if (complaint && complaint.profiles) {
                    fetch(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/agent/notify-resolution', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            complaint_id: id,
                            user_email: complaint.profiles.username,
                            user_name: complaint.profiles.full_name || 'Citizen',
                            issue_description: complaint.description
                        })
                    }).then(res => res.json()).then(data => alert(`✅ Status Updated & Citizen Notified!`)).catch(err => console.error(err));
                }
            } else {
                alert("Status Updated");
            }
            setComplaints(prev => prev.map(c => c.complaint_id === id ? { ...c, status: newStatus } : c));
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
        <div className="min-h-screen bg-gray-900 font-sans text-gray-100 flex flex-col">
            {/* Navbar */}
            <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50 flex-shrink-0">
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
                        <button onClick={handleLogout} className="text-sm font-semibold text-gray-400 hover:text-white flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Incoming Reports</h1>
                        <p className="text-gray-400">Manage and resolve reported civic issues</p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* View Toggle */}
                        <div className="bg-gray-800 p-1 rounded-lg border border-gray-700 flex">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                List View
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Live Map
                            </button>
                        </div>

                        <div className="h-8 w-px bg-gray-700 mx-2 hidden md:block"></div>

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
                    <>
                        {/* LIST VIEW */}
                        {viewMode === 'list' && (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredComplaints.map((complaint) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={complaint.complaint_id}
                                        className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm flex flex-col md:flex-row gap-6 hover:border-gray-600 transition-colors"
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
                                                    Priority: <span className={`font-semibold ${complaint.priority === 'High' ? 'text-red-400' : 'text-gray-300'}`}>{complaint.priority}</span>
                                                </div>
                                                <div>
                                                    Reported by: <span className="text-gray-300">
                                                        {complaint.profiles?.full_name || complaint.profiles?.username || 'Anonymous'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => updateStatus(complaint.complaint_id, 'In Progress', complaint.status)} className="px-3 py-1.5 bg-yellow-900/30 text-yellow-500 border border-yellow-900/50 rounded-md text-xs font-bold hover:bg-yellow-900/50 transition-colors">
                                                    Mark In Progress
                                                </button>
                                                <button onClick={() => updateStatus(complaint.complaint_id, 'Resolved', complaint.status)} className="px-3 py-1.5 bg-green-900/30 text-green-500 border border-green-900/50 rounded-md text-xs font-bold hover:bg-green-900/50 transition-colors">
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

                        {/* MAP VIEW */}
                        {viewMode === 'map' && (
                            <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-gray-700 relative shadow-2xl">
                                <MapContainer
                                    center={[20.5937, 78.9629]}
                                    zoom={5}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                                    />
                                    {filteredComplaints.map(c => (
                                        (c.latitude && c.longitude) && (
                                            <CircleMarker
                                                key={c.complaint_id}
                                                center={[c.latitude, c.longitude]}
                                                radius={c.priority === 'High' ? 12 : 8}
                                                pathOptions={{
                                                    color: c.priority === 'High' ? '#ef4444' : c.priority === 'Medium' ? '#eab308' : '#22c55e',
                                                    fillColor: c.priority === 'High' ? '#ef4444' : c.priority === 'Medium' ? '#eab308' : '#22c55e',
                                                    fillOpacity: 0.6,
                                                    weight: 2
                                                }}
                                            >
                                                <Popup>
                                                    <div className="p-1">
                                                        <strong className="block text-sm mb-1">{c.issue_type}</strong>
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusColor(c.status)}`}>{c.status}</span>
                                                        <p className="text-xs mt-2">{c.description}</p>

                                                        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                                                            <button
                                                                onClick={() => updateStatus(c.complaint_id, 'Resolved', c.status)}
                                                                className="flex-1 bg-green-600 text-white text-[10px] font-bold py-1 rounded hover:bg-green-700"
                                                            >
                                                                Resolve
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </CircleMarker>
                                        )
                                    ))}
                                    <FitBounds complaints={filteredComplaints} />
                                </MapContainer>

                                {/* Floating Legend */}
                                <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur border border-gray-700 p-3 rounded-lg z-[1000] text-xs">
                                    <div className="font-bold text-gray-400 mb-2 uppercase tracking-wide">Priority Heatmap</div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> <span className="text-gray-300">High Priority</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span> <span className="text-gray-300">Medium Priority</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-green-500"></span> <span className="text-gray-300">Low Priority</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
