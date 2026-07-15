-- ============================================================
-- CatatKas UMKM — Supabase Database Schema V2
-- This script creates tables in the "umkm" schema and enforces Row Level Security (RLS)
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Ensure the umkm schema exists
CREATE SCHEMA IF NOT EXISTS umkm;

-- ============================================================
-- 1. USER PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  business_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for user_profiles
ALTER TABLE umkm.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON umkm.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON umkm.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON umkm.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE umkm.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions" ON umkm.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON umkm.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON umkm.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON umkm.transactions(user_id);


-- ============================================================
-- 3. STOCKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.stocks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE umkm.stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stocks" ON umkm.stocks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stocks_user_id ON umkm.stocks(user_id);


-- ============================================================
-- 4. CAPEX ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.capex_items (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  investment_amount BIGINT NOT NULL DEFAULT 0,
  expected_monthly_return BIGINT NOT NULL DEFAULT 0,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL DEFAULT 'Lainnya',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE umkm.capex_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own capex" ON umkm.capex_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capex_user_id ON umkm.capex_items(user_id);


-- ============================================================
-- 5. PRODUCTS TABLE (Katalog produk jual / menu)
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.products (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Makanan',
  selling_price INTEGER NOT NULL DEFAULT 0,
  hpp_calculated INTEGER NOT NULL DEFAULT 0,
  margin_percent NUMERIC(5,2) DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'porsi',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE umkm.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own products" ON umkm.products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON umkm.products(user_id);


-- ============================================================
-- 6. PRODUCT COMPONENTS TABLE (Resep/BOM per produk)
-- ============================================================
CREATE TABLE IF NOT EXISTS umkm.product_components (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES umkm.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_per_unit INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  stock_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE umkm.product_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own components" ON umkm.product_components
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_components_product ON umkm.product_components(product_id);
CREATE INDEX IF NOT EXISTS idx_components_user ON umkm.product_components(user_id);


-- ============================================================
-- 7. ADD EXTRA COLUMNS (idempotent)
-- ============================================================

-- Add product_id link to transactions
ALTER TABLE umkm.transactions ADD COLUMN IF NOT EXISTS product_id TEXT;

-- Add target & growth to user_profiles
ALTER TABLE umkm.user_profiles ADD COLUMN IF NOT EXISTS monthly_target BIGINT DEFAULT 0;
ALTER TABLE umkm.user_profiles ADD COLUMN IF NOT EXISTS growth_rate NUMERIC(5,2) DEFAULT 10;
