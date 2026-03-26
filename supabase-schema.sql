-- ============================================
-- KPPM GKJW Karangpilang - PDH Payment System
-- Database Schema & Seed Data
-- ============================================

-- 1. Create Members Table
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'M',
  total_price INTEGER NOT NULL DEFAULT 160000,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- 4. Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Members: public read, insert, update, delete
CREATE POLICY "Allow public read on members"
  ON members FOR SELECT USING (true);

CREATE POLICY "Allow public insert on members"
  ON members FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on members"
  ON members FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on members"
  ON members FOR DELETE USING (true);

-- Transactions: public read, insert, update
CREATE POLICY "Allow public read on transactions"
  ON transactions FOR SELECT USING (true);

CREATE POLICY "Allow public insert on transactions"
  ON transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on transactions"
  ON transactions FOR UPDATE USING (true);

-- 6. Seed Data - 24 Anggota PDH Karpil
INSERT INTO members (name, size, total_price) VALUES
  ('Edo',          'XL',  160000),
  ('Bima',         '2XL', 160000),
  ('Zefan',        '2XL', 160000),
  ('Miko',         'XL',  160000),
  ('Dika',         'XL',  160000),
  ('Delvin',       'XL',  160000),
  ('Rafael',       'L',   160000),
  ('Putu',         '2XL', 160000),
  ('Bagas',        '3XL', 160000),
  ('Jose',         'L',   160000),
  ('Grace',        'M',   160000),
  ('Desta',        'L',   160000),
  ('Michael',      '2XL', 160000),
  ('Nadia',        'XL',  160000),
  ('Valen',        'XL',  160000),
  ('Gebi',         'L',   160000),
  ('Fabian',       '2XL', 160000),
  ('Lushia',       'L',   160000),
  ('Nimas',        'M',   160000),
  ('Amel',         'M',   160000),
  ('Ester',        'M',   160000),
  ('Kris Keryapi', 'XL',  160000),
  ('Stf',          'M',   160000),
  ('Yosia',        'M',   160000);

-- 7. Seed Existing Payments (data pembayaran yang sudah ada)
-- Termin 1 payments (status = approved, tanpa bukti karena dicatat manual)
INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Edo';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Bima';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 30000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Zefan';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Miko';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Dika';

-- Delvin: Termin 1 = 50K, Termin 2 = 110K
INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 50000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Delvin';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 110000, 'approved', NULL, now() - interval '15 days'
FROM members m WHERE m.name = 'Delvin';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Rafael';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Putu';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Grace';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Desta';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Michael';

-- Nadia: Termin 1 = 50K, Termin 2 = 110K
INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 50000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Nadia';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 110000, 'approved', NULL, now() - interval '15 days'
FROM members m WHERE m.name = 'Nadia';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 160000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Fabian';

-- Kris Keryapi: Termin 1 = 50K, Termin 2 = 110K
INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 50000, 'approved', NULL, now() - interval '30 days'
FROM members m WHERE m.name = 'Kris Keryapi';

INSERT INTO transactions (member_id, amount, status, proof_url, created_at)
SELECT m.id, 110000, 'approved', NULL, now() - interval '15 days'
FROM members m WHERE m.name = 'Kris Keryapi';

-- ============================================
-- IMPORTANT: After running this SQL, also:
-- 1. Go to Storage > Create new bucket > Name: "receipts"
-- 2. Set bucket to PUBLIC
-- 3. Add storage policy: Allow public uploads
--    - Policy name: "Allow public uploads"
--    - Allowed operation: INSERT
--    - Target roles: anon
--    - WITH CHECK: true
-- 4. Add storage policy: "Allow public read"
--    - Allowed operation: SELECT
--    - Target roles: anon
--    - USING: true
-- ============================================
