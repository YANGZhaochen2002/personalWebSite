-- 交易类型迁移脚本
-- 添加两种交易类型支持：自提(pickup) 和 邮寄(shipping)

-- 添加交易类型字段
ALTER TABLE transactions
ADD COLUMN transaction_type VARCHAR(20) DEFAULT 'shipping',
ADD COLUMN pickup_time TIMESTAMP,
ADD COLUMN return_pickup_time TIMESTAMP,
ADD COLUMN delivery_address TEXT,
ADD COLUMN return_address TEXT;

-- 创建索引
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_pickup_time ON transactions(pickup_time);

-- 将现有的 posting_date 和 posting_time 作为 shipping 订单的数据
-- 现有数据将保持 transaction_type = 'shipping'，delivery_address 从 customers.delivery_address 获取
