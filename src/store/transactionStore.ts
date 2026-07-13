import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  name: string;
  category: 'Makanan' | 'Minuman' | 'Barang' | 'Jasa' | 'Lainnya';
  quantity: number;
  price: number;
  total: number;
  date: string;
  synced: boolean;
}

interface TransactionState {
  transactions: Transaction[];
  isSyncing: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'total' | 'synced'>) => void;
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
        const newTx: Transaction = {
          ...tx,
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString(),
          total: tx.quantity * tx.price,
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
