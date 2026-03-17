-- 管理员表（原users表改名）
DROP TABLE IF EXISTS admin_users CASCADE;
CREATE TABLE admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 客户表
DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20),
  nickname VARCHAR(255),
  delivery_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(contact_phone);
CREATE INDEX idx_customers_name ON customers(name);

-- 设备表
DROP TABLE IF EXISTS equipment CASCADE;
CREATE TABLE equipment (
  id BIGSERIAL PRIMARY KEY,
  equipment_code VARCHAR(50) UNIQUE NOT NULL,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  daily_rental_price DECIMAL(10, 2) NOT NULL,
  damage_price DECIMAL(10, 2) NOT NULL,
  in_stock BOOLEAN DEFAULT TRUE,
  checkout_date DATE,
  return_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_equipment_brand ON equipment(brand);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_in_stock ON equipment(in_stock);
CREATE INDEX idx_equipment_code ON equipment(equipment_code);
CREATE INDEX idx_equipment_checkout_date ON equipment(checkout_date);
CREATE INDEX idx_equipment_return_date ON equipment(return_date);

-- 交易表
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_code VARCHAR(50) UNIQUE NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  rental_start_date DATE NOT NULL,
  rental_end_date DATE NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  responsible_person VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  posting_date DATE,
  posting_time TIME,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_code ON transactions(transaction_code);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_equipment ON transactions(equipment_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_posting_date ON transactions(posting_date);

-- 自动更新updated_at的触发器
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_timestamp
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_equipment_timestamp
BEFORE UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_transactions_timestamp
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
