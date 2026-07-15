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
  monthly_target?: number | null;
  growth_rate?: number | null;
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

      const profile = data as UserProfile;
      set({ userProfile: profile });

      // Update projectionStore with DB values
      const { useProjectionStore } = await import('@/store/projectionStore');
      if (profile.monthly_target !== undefined && profile.monthly_target !== null) {
        useProjectionStore.setState({ monthlyTargetIncome: Number(profile.monthly_target) });
      }
      if (profile.growth_rate !== undefined && profile.growth_rate !== null) {
        useProjectionStore.setState({ growthRatePercent: Number(profile.growth_rate) });
      }
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
