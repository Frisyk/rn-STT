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
  hpp: number; // Cost price (modal) per unit for sales, or 0 for expenses
  total: number;
  profit: number; // Net profit impact
  date: string;
  synced: boolean;
}

interface TransactionState {
  transactions: Transaction[];
  isSyncing: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'total' | 'profit' | 'synced'>) => void;
  deleteTransaction: (id: string) => void;
  syncTransactions: () => Promise<void>;
  clearTransactions: () => void;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      isSyncing: false,
      addTransaction: (tx) => {
        const total = tx.quantity * tx.price;
        const profit = tx.type === 'pemasukan'
          ? total - (tx.hpp * tx.quantity)
          : -total;

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
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
      },
      syncTransactions: async () => {
        const unsynced = get().transactions.filter((t) => !t.synced);
        if (unsynced.length === 0) return;

        set({ isSyncing: true });
        
        // Simulating Supabase sync network delay (2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        set((state) => ({
          isSyncing: false,
          transactions: state.transactions.map((t) =>
            t.synced ? t : { ...t, synced: true }
          ),
        }));
      },
      clearTransactions: () => {
        set({ transactions: [] });
      },
    }),
    {
      name: 'umkm-transactions-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
