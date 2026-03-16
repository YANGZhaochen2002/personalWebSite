const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * 获取所有设备（支持筛选）
 * 查询参数: brand, category, minPrice, maxPrice
 */
router.get('/equipment', async (req, res) => {
  try {
    const { brand, category, minPrice, maxPrice } = req.query;
    
    let query = supabase
      .from('equipment')
      .select('*')
      .eq('in_stock', true);

    if (brand) {
      query = query.eq('brand', brand);
    }
    
    if (category) {
      query = query.eq('category', category);
    }

    if (minPrice) {
      query = query.gte('daily_rental_price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('daily_rental_price', parseFloat(maxPrice));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (err) {
    console.error('Get equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get equipment',
      error: err.message
    });
  }
});

/**
 * 获取设备筛选选项
 */
router.get('/equipment/filters', async (req, res) => {
  try {
    // Fetch all equipment in stock
    const { data: equipment, error } = await supabase
      .from('equipment')
      .select('brand, category, model')
      .eq('in_stock', true);

    if (error) throw error;

    // Extract unique values using Set
    const brands = [...new Set(equipment?.map(e => e.brand).filter(Boolean) || [])];
    const categories = [...new Set(equipment?.map(e => e.category).filter(Boolean) || [])];
    
    // Extract locations from model field (format: "equipment-location")
    const locations = [...new Set(
      equipment?.map(e => {
        if (e.model && e.model.includes('-')) {
          const parts = e.model.split('-');
          return parts[parts.length - 1]; // Get the last part after the last dash
        }
        return null;
      }).filter(Boolean) || []
    )];

    res.json({
      success: true,
      brands: brands.sort(),
      categories: categories.sort(),
      locations: locations.sort()
    });
  } catch (err) {
    console.error('Get filters error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get filters',
      error: err.message
    });
  }
});

/**
 * 创建租赁交易（客户提交）
 */
router.post('/rental', async (req, res) => {
  try {
    const { name, contactPhone, nickname, deliveryAddress, equipmentId, rentalStartDate, rentalEndDate } = req.body;

    // 验证客户信息
    if (!name || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: '姓名和收件地址为必填项'
      });
    }

    if (!equipmentId || !rentalStartDate || !rentalEndDate) {
      return res.status(400).json({
        success: false,
        message: '设备和租期信息为必填项'
      });
    }

    // 验证日期
    const startDate = new Date(rentalStartDate);
    const endDate = new Date(rentalEndDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: '租期结束日期必须晚于开始日期'
      });
    }

    // 获取设备信息
    const { data: equipment, error: equipmentError } = await supabase
      .from('equipment')
      .select('*')
      .eq('id', equipmentId)
      .single();

    if (equipmentError || !equipment) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    if (!equipment.in_stock) {
      return res.status(400).json({
        success: false,
        message: '该设备暂不可租'
      });
    }

    // 计算总价格
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const totalPrice = parseFloat(equipment.daily_rental_price) * days;

    // 创建或更新客户
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('name', name)
      .eq('contact_phone', contactPhone || '')
      .limit(1);

    let customerId;
    
    if (existingCustomer && existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;
      // 更新客户信息
      await supabase
        .from('customers')
        .update({
          nickname: nickname || '',
          delivery_address: deliveryAddress,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);
    } else {
      // 创建新客户
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert([{
          name,
          contact_phone: contactPhone || null,
          nickname: nickname || null,
          delivery_address: deliveryAddress
        }])
        .select();

      if (customerError) throw customerError;
      customerId = newCustomer[0].id;
    }

    // 生成交易码
    const transactionCode = `RENT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // 创建交易
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        transaction_code: transactionCode,
        customer_id: customerId,
        equipment_id: equipmentId,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate,
        total_price: totalPrice,
        status: 'pending'
      }])
      .select();

    if (transactionError) throw transactionError;

    // 更新设备库存状态为不在库
    await supabase
      .from('equipment')
      .update({ in_stock: false })
      .eq('id', equipmentId);

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      transactionCode: transactionCode,
      transaction: transaction[0]
    });
  } catch (err) {
    console.error('Create rental error:', err);
    res.status(500).json({
      success: false,
      message: '创建订单失败',
      error: err.message
    });
  }
});

/**
 * 查询交易信息（通过交易码）
 */
router.get('/rental/:transactionCode', async (req, res) => {
  try {
    const { transactionCode } = req.params;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select(`
        *,
        customers (*),
        equipment (*)
      `)
      .eq('transaction_code', transactionCode)
      .single();

    if (error || !transaction) {
      return res.status(404).json({
        success: false,
        message: '交易记录不存在'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (err) {
    console.error('Get rental error:', err);
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: err.message
    });
  }
});

module.exports = router;
