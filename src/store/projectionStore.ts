import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CapExItem {
  id: string;
  name: string; // Nama aset/investasi, misal "Mesin Kopi Otomatis"
  investmentAmount: number; // Nilai investasi awal (Rp)
  expectedMonthlyReturn: number; // Estimasi arus kas bersih per bulan (Rp)
  purchaseDate: string; // ISO date string
  category: string; // 'Mesin', 'Kendaraan', 'Renovasi', 'Digital', 'Lainnya'
  notes: string;
  synced: boolean;
}

export interface CashflowForecast {
  month: string; // "YYYY-MM"
  projectedIncome: number; // Estimasi pendapatan bulan itu
  projectedExpense: number; // Estimasi pengeluaran bulan itu
}

interface ProjectionState {
  capexItems: CapExItem[];
  monthlyTargetIncome: number; // Target pendapatan per bulan (bisa diset user)
  growthRatePercent: number; // Perkiraan growth rate bulan depan (%)
  addCapEx: (item: Omit<CapExItem, 'id' | 'synced'>) => void;
  updateCapEx: (id: string, updates: Partial<CapExItem>) => void;
  deleteCapEx: (id: string) => void;
  setMonthlyTarget: (target: number) => void;
  setGrowthRate: (rate: number) => void;
  syncProjections: () => Promise<void>;
}

export const useProjectionStore = create<ProjectionState>()(
  persist(
    (set, get) => ({
      capexItems: [],
      monthlyTargetIncome: 0,
      growthRatePercent: 10, // default 10% growth assumption

      addCapEx: (item) => {
        const newItem: CapExItem = {
          ...item,
          id: Math.random().toString(36).substring(2, 9),
          synced: false,
        };
        set((state) => ({ capexItems: [newItem, ...state.capexItems] }));
      },

      updateCapEx: (id, updates) => {
        set((state) => ({
          capexItems: state.capexItems.map((c) =>
            c.id === id ? { ...c, ...updates, synced: false } : c
          ),
        }));
      },

      deleteCapEx: (id) => {
        set((state) => ({
          capexItems: state.capexItems.filter((c) => c.id !== id),
        }));
      },

      setMonthlyTarget: (target) => set({ monthlyTargetIncome: target }),
      setGrowthRate: (rate) => set({ growthRatePercent: rate }),

      syncProjections: async () => {
        const unsynced = get().capexItems.filter((c) => !c.synced);
        if (unsynced.length === 0) return;

        try {
          const { supabase } = await import('@/utils/supabase');
          const rows = unsynced.map((c) => ({
            id: c.id,
            name: c.name,
            investment_amount: c.investmentAmount,
            expected_monthly_return: c.expectedMonthlyReturn,
            purchase_date: c.purchaseDate,
            category: c.category,
            notes: c.notes,
          }));
          await supabase.from('capex_items').upsert(rows, { onConflict: 'id' });
          set((state) => ({
            capexItems: state.capexItems.map((c) => ({ ...c, synced: true })),
          }));
        } catch {
          // non-blocking
        }
      },
    }),
    {
      name: 'umkm-projections-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
