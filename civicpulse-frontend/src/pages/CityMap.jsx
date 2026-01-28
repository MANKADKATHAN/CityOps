import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Map as MapIcon, ThumbsUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Helper to auto-fit bounds
const FitBounds = ({ complaints }) => {
    const map = useMap();
    useEffect(() => {
        if (complaints.length > 0) {
            const bounds = complaints.map(c => [c.latitude, c.longitude]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [complaints, map]);
    return null;
};

export default function CityMap() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myVotes, setMyVotes] = useState(new Set());

    useEffect(() => {
        const fetchComplaints = async () => {
            // Fetch complaints
            const { data: complaintData, error } = await supabase
                .from('complaints')
                .select('*')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (error) console.error(error);
            else setComplaints(complaintData || []);

            // Fetch my votes if logged in
            if (user) {
                const { data: votes } = await supabase
                    .from('upvotes')
                    .select('complaint_id')
                    .eq('user_id', user.id);

                if (votes) {
                    setMyVotes(new Set(votes.map(v => v.complaint_id)));
                }
            }

            setLoading(false);
        };
        fetchComplaints();
    }, [user]);

    const handleUpvote = async (id) => {
        if (!user) return alert("Please login to verify issues.");

        try {
            const { error } = await supabase
                .from('upvotes')
                .insert({ complaint_id: id, user_id: user.id });

            if (error) {
                if (error.code === '23505') alert("You already verified this issue!");
                else throw error;
            } else {
                // Optimistic Update
                setMyVotes(prev => new Set(prev).add(id));
                setComplaints(prev => prev.map(c =>
                    c.complaint_id === id
                        ? { ...c, upvote_count: (c.upvote_count || 0) + 1 }
                        : c
                ));
            }
        } catch (err) {
            console.error(err);
            alert("Failed to upvote");
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="h-screen w-full relative bg-gray-900 flex flex-col">
            {/* Header Overlay */}
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl max-w-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <MapIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">City Watch</h1>
                        <p className="text-xs text-gray-500 font-medium">Real-time Civic Incident Map</p>
                        <p className="text-[10px] text-gray-400 mt-1">Verify issues by clicking markers.</p>
                    </div>
                </div>

                <div className="flex gap-4 text-sm mt-3">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="font-semibold text-gray-700">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span className="font-semibold text-gray-700">In Progress</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        <span className="font-semibold text-gray-700">Resolved</span>
                    </div>
                </div>

                <Link to="/dashboard" className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors text-sm">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
            </div>

            {/* The Map */}
            <MapContainer
                center={[20.5937, 78.9629]} // Default India center, will auto-fit
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {complaints.map(c => (
                    <CircleMarker
                        key={c.complaint_id}
                        center={[c.latitude, c.longitude]}
                        radius={myVotes.has(c.complaint_id) ? 10 : 8} // Bigger if I voted
                        pathOptions={{
                            color: c.status === 'Resolved' ? '#22c55e' : c.status === 'In Progress' ? '#eab308' : '#ef4444',
                            fillColor: c.status === 'Resolved' ? '#22c55e' : c.status === 'In Progress' ? '#eab308' : '#ef4444',
                            fillOpacity: 0.7,
                            weight: myVotes.has(c.complaint_id) ? 4 : 2
                        }}
                    >
                        <Popup>
                            <div className="p-1 min-w-[200px]">
                                <span className={`text - xs font - bold px - 2 py - 0.5 rounded border mb - 2 inline - block
                                    ${c.status === 'Resolved' ? 'bg-green-100 text-green-700 border-green-200' :
                                        c.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                            'bg-red-100 text-red-700 border-red-200'
                                    } `}>
                                    {c.status || 'Pending'}
                                </span>
                                <h3 className="font-bold text-gray-900 text-sm">{c.issue_type}</h3>
                                <p className="text-gray-600 text-xs mt-1 leading-relaxed">{c.description}</p>
                                <p className="text-gray-400 text-[10px] mt-2 italic">{new Date(c.created_at).toLocaleDateString()}</p>

                                {c.image_url && (
                                    <div className="mt-2 w-full h-24 rounded bg-gray-100 overflow-hidden">
                                        <img src={c.image_url} className="w-full h-full object-cover" alt="Evidence" />
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                    <span className="text-xs font-semibold text-gray-500">
                                        Verified by {c.upvote_count || 0}
                                    </span>

                                    <button
                                        onClick={() => handleUpvote(c.complaint_id)}
                                        disabled={myVotes.has(c.complaint_id)}
                                        className={`flex items - center gap - 1 px - 2 py - 1 rounded text - xs font - bold transition - colors
                                            ${myVotes.has(c.complaint_id)
                                                ? 'bg-blue-100 text-blue-600 cursor-default'
                                                : 'bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600'
                                            } `}
                                    >
                                        <ThumbsUp className="w-3 h-3" />
                                        {myVotes.has(c.complaint_id) ? 'Verified' : 'Verify'}
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}

                <FitBounds complaints={complaints} />
            </MapContainer>
        </div>
    );
}
