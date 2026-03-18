-- 迁移脚本：添加新字段到现有表
-- 在 Supabase SQL Editor 中执行这个脚本

-- ============================================
-- 在equipment表中添加新列
-- ============================================
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS checkout_date DATE,
ADD COLUMN IF NOT EXISTS return_date DATE;


-- 添加索引
CREATE INDEX IF NOT EXISTS idx_equipment_checkout_date ON equipment(checkout_date);
CREATE INDEX IF NOT EXISTS idx_equipment_return_date ON equipment(return_date);

-- ============================================
-- 在transactions表中添加新列
-- ============================================
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS posting_date DATE,
ADD COLUMN IF NOT EXISTS posting_time TIME,
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rental_start_date DATE,
ADD COLUMN IF NOT EXISTS rental_end_date DATE,
ADD COLUMN IF NOT EXISTS rental_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS admin_return_date DATE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_transactions_posting_date ON transactions(posting_date);
CREATE INDEX IF NOT EXISTS idx_transactions_rental_start_date ON transactions(rental_start_date);
CREATE INDEX IF NOT EXISTS idx_transactions_admin_return_date ON transactions(admin_return_date);
