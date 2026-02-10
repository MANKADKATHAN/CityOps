import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, CheckCircle, Upload, AlertCircle, X, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

export default function ComplaintForm({ mappedData }) {
    const [formData, setFormData] = useState({
        issue_type: '',
        description: '',
        location_text: '',
        priority: 'Medium',
        assigned_department: '',
        image_url: '',
        latitude: null,
        longitude: null
    });

    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, analyzing, submitting, success, error
    const [submitError, setSubmitError] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('Processing...');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiSetPriority, setAiSetPriority] = useState(false);

    useEffect(() => {
        if (mappedData) {
            setFormData((prev) => ({
                ...prev,
                issue_type: mappedData.issue_type || prev.issue_type,
                description: mappedData.description || prev.description,
                location_text: mappedData.location_text || prev.location_text,
            }));
        }

        // Auto-fetch location on mount
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setFormData(prev => ({
                        ...prev,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    }));
                },
                (err) => console.warn("Auto-location failed (will try again on submit):", err),
                { timeout: 5000 }
            );
        }
    }, [mappedData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (name === 'priority') setAiSetPriority(false);
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Basic validation
            if (file.size > 5 * 1024 * 1024) {
                alert("File size too large (max 5MB)");
                return;
            }
            setImageFile(file);
            const localPreview = URL.createObjectURL(file);
            setPreviewUrl(localPreview);

            // AUTO-ANALYZE IMAGE
            try {
                setIsAnalyzing(true);
                setLoadingMessage("AI Analyzing Image...");

                // 1. Upload first to get a public URL
                const publicUrl = await uploadImage(file);

                // 2. Call Backend Vision Agent
                const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                const response = await fetch(`${BACKEND_URL}/analyze-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url: publicUrl }),
                });

                if (response.ok) {
                    const analysis = await response.json();
                    console.log("AI Analysis:", analysis);

                    if (analysis.is_civic_issue) {
                        // Construct a rich description with AI insights
                        let richDescription = analysis.description || prev.description;
                        if (analysis.required_action) {
                            richDescription += `\n\n[AI SUGGESTED ACTION]: ${analysis.required_action}`;
                        }

                        // Smart Location Fill
                        // If we have a GPS location, we keep it. But we can append context to the text field.
                        let smartLocation = prev.location_text;
                        if (analysis.location_context) {
                            smartLocation = smartLocation ? `${smartLocation} (${analysis.location_context})` : analysis.location_context;
                        }

                        setFormData(prev => ({
                            ...prev,
                            issue_type: analysis.issue_type || prev.issue_type,
                            description: richDescription,
                            location_text: smartLocation || prev.location_text,
                            priority: analysis.severity > 7 ? 'High' : analysis.severity > 4 ? 'Medium' : 'Low',
                            image_url: publicUrl
                        }));
                        setAiSetPriority(true);

                        // Optional: Alert user of the smart analysis
                        if (analysis.required_action) {
                            alert(`🤖 AI Analysis Complete!\n\nContext: ${analysis.location_context || "General Area"}\nAction Plan: ${analysis.required_action}`);
                        }
                    } else {
                        // REJECTION HANDLING
                        alert(`⚠️ AI Validation Failed: ${analysis.rejection_reason || "Not a valid civic issue."}\n\nPlease upload a clear photo of a real-world civic issue.`);
                        // Remove invalid image
                        setImageFile(null);
                        setPreviewUrl(null);
                    }
                }
            } catch (err) {
                console.error("AI Analysis failed:", err);
                // Fail silently, user can still fill form manually
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setPreviewUrl(null);
    };

    const uploadImage = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from('evidence')
            .upload(filePath, file);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('evidence')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description) return; // Added check for description

        setStatus('submitting');
        setSubmitError('');
        setLoadingMessage('Acquiring Location...'); // Initial loading message

        try {
            // 1. Upload Image if present
            let finalImageUrl = null; // Changed from formData.image_url
            if (imageFile) {
                setLoadingMessage('Uploading Image...'); // Update loading message
                try {
                    finalImageUrl = await uploadImage(imageFile);
                } catch (uploadErr) {
                    console.error("Upload failed", uploadErr);
                    // Decide if we should block or continue. Let's block for now but notify user.
                    throw new Error("Failed to upload image: " + uploadErr.message);
                }
            }

            // 2. Default coordinates if geolocation fails or user denies
            // Note: In a real app we might ask for geo first
            // Removed lat/long initialization here as it's handled by getGeoLocation fallback

            const submitToBackend = async (latitude, longitude) => {
                const dept = null; // Backend handles this
                let userId = null;
                try {
                    const { data } = await supabase.auth.getSession();
                    userId = data?.session?.user?.id || null;
                } catch (e) {
                    console.warn("Could not retrieve user session for complaint, submitting anonymously.");
                }
                console.log("Creating complaint for User ID:", userId); // Debug Log

                const payload = {
                    issue_type: formData.issue_type || "General",
                    description: formData.description,
                    location_text: formData.location_text,
                    latitude: latitude,
                    longitude: longitude,
                    assigned_department: dept,
                    priority: formData.priority,
                    image_url: finalImageUrl,
                    user_id: userId
                };

                console.log("Submitting payload:", payload);

                const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
                const response = await fetch(`${BACKEND_URL}/complaints`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                console.log("Response status:", response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Backend Error Response:", errorText);
                    try {
                        const errData = JSON.parse(errorText);
                        throw new Error(errData.detail || `Server Error: ${response.status}`);
                    } catch (e) {
                        throw new Error(`Server Error: ${response.status} - ${errorText}`);
                    }
                }

                // If successful
                const responseData = await response.json();
                console.log("Submission Success:", responseData);
                setStatus('success');
            };

            // Helper to get location if needed
            const getGeoLocation = () => {
                return new Promise((resolve) => {
                    if (!navigator.geolocation) {
                        resolve({ coords: { latitude: 0, longitude: 0 } });
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve(position),
                        (err) => {
                            console.warn("Geo error:", err);
                            resolve({ coords: { latitude: 0, longitude: 0 } });
                        },
                        { timeout: 5000, enableHighAccuracy: false }
                    );
                });
            };

            // 3. Get Geolocation (Use valid cached data or fetch new)
            let lat = formData.latitude;
            let long = formData.longitude;

            if (!lat || !long) {
                setLoadingMessage('Getting Location...');
                const position = await getGeoLocation();
                lat = position.coords.latitude;
                long = position.coords.longitude;
            }

            setLoadingMessage('Sending Report...');
            await submitToBackend(lat, long);

        } catch (err) {
            console.error("Submission error:", err);
            setSubmitError(err.message || "Failed to submit form. Please check your connection.");
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 bg-white"
            >
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Submitted!</h2>
                <p className="text-gray-500 mb-8 text-lg">Your complaint has been registered. Our <strong>AI Routing Agent</strong> is currently assigning it to the relevant department.</p>

                <div className="bg-gray-50 rounded-xl p-4 w-full max-w-sm mb-8 border border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400 uppercase font-bold">Ticket ID</span>
                    <span className="font-mono text-gray-700 font-bold">#CP-{Math.floor(Math.random() * 10000)}</span>
                </div>

                <button
                    onClick={() => {
                        setStatus('idle');
                        setFormData({ issue_type: '', description: '', location_text: '', priority: 'Medium', assigned_department: '', image_url: '' });
                        setImageFile(null);
                        setPreviewUrl(null);
                        setAiSetPriority(false);
                    }}
                    className="px-8 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                    Submit Another Issue
                </button>
            </motion.div>
        );
    }

    return (
        <div className="h-full p-8 bg-white overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Issue Type */}
                <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-500 transition-colors">Issue Type</label>
                    <select
                        name="issue_type"
                        value={formData.issue_type}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-gray-800 outline-none transition-all font-medium"
                    >
                        <option value="" disabled>Select Issue Type</option>
                        <option value="Garbage">Garbage</option>
                        <option value="Road">Road Issues</option>
                        <option value="Water">Water Problems</option>
                        <option value="Streetlight">Streetlights</option>
                        <option value="General">Other</option>
                    </select>
                </div>

                {/* Location */}
                <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-500 transition-colors">
                        Location
                        <span className="float-right font-normal normal-case text-gray-500">
                            {formData.latitude ? `✅ GPS: ${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}` : '⚠️ GPS Waiting...'}
                        </span>
                    </label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            name="location_text"
                            value={formData.location_text}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-gray-800 outline-none transition-all font-medium"
                            placeholder="e.g. Behind Central School..."
                        />
                    </div>
                    {/* Manual Location Trigger */}
                    <button
                        type="button"
                        onClick={async () => {
                            setLoadingMessage('Updating GPS...');
                            try {
                                const pos = await new Promise((resolve, reject) => {
                                    navigator.geolocation.getCurrentPosition(resolve, reject);
                                });
                                setFormData(prev => ({
                                    ...prev,
                                    latitude: pos.coords.latitude,
                                    longitude: pos.coords.longitude
                                }));
                                alert("Location updated!");
                            } catch (e) {
                                alert("Could not get location. Ensure GPS is on and permissions allowed.");
                            }
                        }}
                        className="text-xs text-blue-500 hover:text-blue-600 mt-1 font-medium underline"
                    >
                        Auto-detect GPS again
                    </button>
                </div>

                {/* Description */}
                <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-500 transition-colors">Description</label>
                    <textarea
                        name="description"
                        rows="3"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-gray-800 outline-none transition-all font-medium resize-none"
                        placeholder="Describe the problem in detail..."
                    />
                </div>

                {/* Upload Image */}
                <div className={`transition-opacity duration-300 ${isAnalyzing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex justify-between">
                        Evidence
                        {isAnalyzing && <span className="text-blue-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> AI Analyzing...</span>}
                    </label>

                    {!previewUrl ? (
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 gap-3 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-400 transition-all group">
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-medium">Click to upload photo</span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                            <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50 shadow-md"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dept & Priority */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Department</label>
                        <div className="px-4 py-3 bg-gray-100 rounded-xl text-sm font-bold text-gray-600 border border-gray-200">
                            {formData.assigned_department || "AI Routing..."}
                        </div>
                    </div>
                    <div className="group">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-500 transition-colors flex items-center justify-between">
                            Priority
                            {aiSetPriority && <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200">✨ AI SET</span>}
                        </label>
                        <div className="relative">
                            <div className={`absolute left-3 top-4 w-2 h-2 rounded-full ${formData.priority === 'High' ? 'bg-red-500' : formData.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-gray-800 outline-none transition-all font-bold cursor-pointer"
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {submitError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {submitError}
                    </div>
                )}

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={status === 'submitting' || isAnalyzing}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                        ${status === 'submitting' || isAnalyzing
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:-translate-y-0.5'
                        }
                    `}
                >
                    {status === 'submitting' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {loadingMessage}
                        </>
                    ) : (
                        <>
                            Submit Report <Send className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
