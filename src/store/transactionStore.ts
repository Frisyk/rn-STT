import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  name: string;
  type: 'pemasukan' | 'pengeluaran';
  category: string;
  quantity: number;
  price: number;
  hpp: number;
  total: number;
  profit: number;
  operasionalCost: number;
  productId?: string; // optional link to product catalog
  date: string;
  synced: boolean;
}

interface TransactionState {
  transactions: Transaction[];
  isSyncing: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'total' | 'profit' | 'synced'>) => void;
  deleteTransaction: (id: string) => Promise<void>;
  syncTransactions: () => Promise<void>;
  clearTransactions: () => void;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      isSyncing: false,

      addTransaction: (tx) => {
        const total = tx.quantity * tx.price;
        const profit =
          tx.type === 'pemasukan'
            ? total - tx.hpp * tx.quantity
            : -(total + tx.operasionalCost);

        const newTx: Transaction = {
          ...tx,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
          total,
          profit,
          synced: false,
        };
        set((state) => ({
          transactions: [newTx, ...state.transactions],
        }));
      },

      deleteTransaction: async (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
        try {
          const { supabase } = await import('@/utils/supabase');
          await supabase.from('transactions').delete().eq('id', id);
        } catch {
          // non-blocking
        }
      },

      syncTransactions: async () => {
        const unsynced = get().transactions.filter((t) => !t.synced);
        if (unsynced.length === 0) return;

        set({ isSyncing: true });

        try {
          const { supabase } = await import('@/utils/supabase');
          const rows = unsynced.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            category: t.category,
            quantity: t.quantity,
            price: t.price,
            hpp: t.hpp,
            total: t.total,
            profit: t.profit,
            operasional_cost: t.operasionalCost,
            product_id: t.productId || null,
            date: t.date,
          }));

          const { error } = await supabase
            .from('transactions')
            .upsert(rows, { onConflict: 'id' });

          if (!error) {
            set((state) => ({
              isSyncing: false,
              transactions: state.transactions.map((t) =>
                t.synced ? t : { ...t, synced: true }
              ),
            }));
          } else {
            set({ isSyncing: false });
          }
        } catch {
          set({ isSyncing: false });
        }
      },

      clearTransactions: () => {
        set({ transactions: [] });
      },
    }),
    {
      name: 'umkm-transactions-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
