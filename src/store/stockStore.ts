import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string; // pcs, kg, liter, porsi, dll
  currentStock: number;
  minimumStock: number; // batas stok rendah — trigger peringatan
  costPrice: number; // HPP per unit
  sellingPrice: number; // Harga jual per unit
  updatedAt: string;
  synced: boolean;
}

interface StockState {
  stocks: StockItem[];
  addStock: (item: Omit<StockItem, 'id' | 'updatedAt' | 'synced'>) => void;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  decreaseStock: (productName: string, quantity: number) => void; // dipanggil saat transaksi penjualan
  increaseStock: (productName: string, quantity: number) => void; // dipanggil saat beli bahan baku
  deleteStock: (id: string) => void;
  syncStocks: () => Promise<void>;
}

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      stocks: [],

      addStock: (item) => {
        const newItem: StockItem = {
          ...item,
          id: Math.random().toString(36).substring(2, 9),
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        set((state) => ({ stocks: [newItem, ...state.stocks] }));
      },

      updateStockItem: (id, updates) => {
        set((state) => ({
          stocks: state.stocks.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString(), synced: false } : s
          ),
        }));
      },

      decreaseStock: (productName, quantity) => {
        const lower = productName.toLowerCase();
        set((state) => ({
          stocks: state.stocks.map((s) => {
            if (s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase())) {
              const newQty = Math.max(0, s.currentStock - quantity);
              return { ...s, currentStock: newQty, updatedAt: new Date().toISOString(), synced: false };
            }
            return s;
          }),
        }));
      },

      increaseStock: (productName, quantity) => {
        const lower = productName.toLowerCase();
        set((state) => ({
          stocks: state.stocks.map((s) => {
            if (s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase())) {
              return {
                ...s,
                currentStock: s.currentStock + quantity,
                updatedAt: new Date().toISOString(),
                synced: false,
              };
            }
            return s;
          }),
        }));
      },

      deleteStock: (id) => {
        set((state) => ({ stocks: state.stocks.filter((s) => s.id !== id) }));
      },

      syncStocks: async () => {
        const unsynced = get().stocks.filter((s) => !s.synced);
        if (unsynced.length === 0) return;

        try {
          const { supabase } = await import('@/utils/supabase');
          const rows = unsynced.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            unit: s.unit,
            current_stock: s.currentStock,
            minimum_stock: s.minimumStock,
            cost_price: s.costPrice,
            selling_price: s.sellingPrice,
            updated_at: s.updatedAt,
          }));

          const { error } = await supabase
            .from('stocks')
            .upsert(rows, { onConflict: 'id' });

          if (!error) {
            set((state) => ({
              stocks: state.stocks.map((s) => ({ ...s, synced: true })),
            }));
          }
        } catch {
          // non-blocking
        }
      },
    }),
    {
      name: 'umkm-stocks-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
