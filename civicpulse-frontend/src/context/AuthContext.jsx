import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchRole = async (userId) => {
        if (!userId) {
            setRole(null);
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching role:', error);
            setRole('citizen'); // safe default
        } else {
            setRole(data?.role ?? 'citizen');
        }
    };

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                // Quick check for session
                const { data: { session } } = await supabase.auth.getSession();

                if (!mounted) return;

                const currentUser = session?.user ?? null;
                setUser(currentUser);

                // If user exists, fetch role; but allow app to render immediately if user is null
                if (currentUser) {
                    // We can choose to wait for role here, OR let it load async
                    // For better UX, let's wait a max of 1s, then show app
                    const rolePromise = fetchRole(currentUser.id);
                    const timeout = new Promise(r => setTimeout(r, 1000));
                    await Promise.race([rolePromise, timeout]);
                }
            } catch (error) {
                console.warn("Auth initialization error:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!mounted) return;

                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchRole(currentUser.id);
                } else {
                    setRole(null);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // 🔴 IMPORTANT: remove role from auth metadata
    const signUp = async (email, password, metaData, selectedRole = 'citizen') => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metaData // Store metadata in Auth user object too
            }
        });

        if (error) return { error };

        // Create profile manually in the 'profiles' table
        if (data?.user) {
            // FIRE AND FORGET: Do not await this. 
            // We want the UI to respond immediately.
            // The DB trigger is the primary backup, this is a secondary "best effort" write.
            // We use UPSERT to handle race conditions with the DB trigger.
            // If the trigger created the row first, we update it with the department info here.
            supabase.from('profiles').upsert({
                id: data.user.id,
                role: selectedRole,
                username: metaData?.username || '',
                full_name: metaData?.full_name || '',
                department: metaData?.department || null
            }).then(({ error }) => {
                if (error) console.warn("Background profile upsert warning:", error.message);
            });
        }

        return { data };
    };

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const signOut = async () => {
        setUser(null);
        setRole(null);
        return supabase.auth.signOut();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Initializing App...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, role, signUp, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};