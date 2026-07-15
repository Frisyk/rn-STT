import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProductComponent {
  id: string;
  componentName: string;
  quantity: number;    // e.g. 0.15 kg
  unit: string;        // kg, butir, liter, paket
  costPerUnit: number; // Rp per unit
  subtotal: number;    // quantity * costPerUnit
  stockId?: string;    // optional link to stock item
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  hppCalculated: number;  // auto-sum from components
  marginPercent: number;  // auto-calc
  unit: string;           // porsi, pcs, gelas
  isActive: boolean;
  components: ProductComponent[];
  synced: boolean;
}

interface ProductState {
  products: Product[];
  addProduct: (p: Omit<Product, 'id' | 'hppCalculated' | 'marginPercent' | 'synced' | 'components'>) => string;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id' | 'components'>>) => void;
  deleteProduct: (id: string) => void;
  addComponent: (productId: string, comp: Omit<ProductComponent, 'id' | 'subtotal'>) => void;
  updateComponent: (productId: string, compId: string, updates: Partial<ProductComponent>) => void;
  deleteComponent: (productId: string, compId: string) => void;
  recalcHpp: (productId: string) => void;
  syncProducts: () => Promise<void>;
}

const genId = () => Math.random().toString(36).substring(2, 9);

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (p) => {
        const id = genId();
        const newProduct: Product = {
          ...p,
          id,
          hppCalculated: 0,
          marginPercent: 0,
          components: [],
          synced: false,
        };
        set((state) => ({ products: [newProduct, ...state.products] }));
        return id;
      },

      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, ...updates, synced: false };
            // Recalc margin if price changed
            if (updates.sellingPrice !== undefined && updated.hppCalculated > 0) {
              updated.marginPercent = parseFloat(
                (((updated.sellingPrice - updated.hppCalculated) / updated.sellingPrice) * 100).toFixed(2)
              );
            }
            return updated;
          }),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
        // Also delete from Supabase
        import('@/utils/supabase').then(({ supabase }) => {
          supabase.from('products').delete().eq('id', id).then(() => {});
          supabase.from('product_components').delete().eq('product_id', id).then(() => {});
        }).catch(() => {});
      },

      addComponent: (productId, comp) => {
        const newComp: ProductComponent = {
          ...comp,
          id: genId(),
          subtotal: Math.round(comp.quantity * comp.costPerUnit),
        };
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? { ...p, components: [...p.components, newComp], synced: false }
              : p
          ),
        }));
        get().recalcHpp(productId);
      },

      updateComponent: (productId, compId, updates) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              synced: false,
              components: p.components.map((c) => {
                if (c.id !== compId) return c;
                const updated = { ...c, ...updates };
                updated.subtotal = Math.round(updated.quantity * updated.costPerUnit);
                return updated;
              }),
            };
          }),
        }));
        get().recalcHpp(productId);
      },

      deleteComponent: (productId, compId) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? { ...p, components: p.components.filter((c) => c.id !== compId), synced: false }
              : p
          ),
        }));
        get().recalcHpp(productId);
      },

      recalcHpp: (productId) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const hpp = p.components.reduce((sum, c) => sum + c.subtotal, 0);
            const margin = p.sellingPrice > 0
              ? parseFloat((((p.sellingPrice - hpp) / p.sellingPrice) * 100).toFixed(2))
              : 0;
            return { ...p, hppCalculated: hpp, marginPercent: margin };
          }),
        }));
      },

      syncProducts: async () => {
        const products = get().products.filter((p) => !p.synced);
        if (products.length === 0) return;

        try {
          const { supabase } = await import('@/utils/supabase');

          // Sync products
          const productRows = products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            selling_price: p.sellingPrice,
            hpp_calculated: p.hppCalculated,
            margin_percent: p.marginPercent,
            unit: p.unit,
            is_active: p.isActive,
          }));

          await supabase.from('products').upsert(productRows, { onConflict: 'id' });

          // Sync components for each product
          for (const p of products) {
            if (p.components.length > 0) {
              const compRows = p.components.map((c) => ({
                id: c.id,
                product_id: p.id,
                component_name: c.componentName,
                quantity: c.quantity,
                unit: c.unit,
                cost_per_unit: c.costPerUnit,
                subtotal: c.subtotal,
                stock_id: c.stockId || null,
              }));
              await supabase.from('product_components').upsert(compRows, { onConflict: 'id' });
            }
          }

          set((state) => ({
            products: state.products.map((p) => ({ ...p, synced: true })),
          }));
        } catch {
          // non-blocking
        }
      },
    }),
    {
      name: 'umkm-products-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
