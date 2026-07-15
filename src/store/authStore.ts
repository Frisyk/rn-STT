import { create } from 'zustand';
import { supabase } from '@/utils/supabase';
import { Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  business_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  session: Session | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setSession: (session: Session | null) => void;
  fetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  userProfile: null,
  isAuthenticated: false,
  isLoading: true,

  setSession: (session) => {
    set({ 
      session, 
      isAuthenticated: !!session,
      isLoading: false 
    });
    
    if (session) {
      get().fetchProfile();
    } else {
      set({ userProfile: null });
    }
  },

  fetchProfile: async () => {
    const { session } = get();
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      set({ userProfile: data as UserProfile });
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ session: null, userProfile: null, isAuthenticated: false, isLoading: false });
  },
}));
