-- ============================================================
-- CatatKas UMKM — Supabase Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/eenmctyspeioznrkcguc/sql
-- ============================================================

-- 1. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pemasukan', 'pengeluaran')),
  category TEXT NOT NULL DEFAULT 'Lainnya',
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,
  hpp INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  profit INTEGER NOT NULL DEFAULT 0,
  operasional_cost INTEGER NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (for future auth integration)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (anonymous access)
CREATE POLICY "Allow all transactions" ON public.transactions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for date-range queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);


-- 2. STOCKS TABLE
CREATE TABLE IF NOT EXISTS public.stocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Produk',
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 5,
  cost_price INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all stocks" ON public.stocks
  FOR ALL USING (true) WITH CHECK (true);


-- 3. CAPEX ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.capex_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  investment_amount BIGINT NOT NULL DEFAULT 0,
  expected_monthly_return BIGINT NOT NULL DEFAULT 0,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL DEFAULT 'Lainnya',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.capex_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all capex" ON public.capex_items
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- VERIFICATION QUERIES (run after creating tables)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
