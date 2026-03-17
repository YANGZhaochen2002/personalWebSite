const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 所有管理员路由需要认证
router.use(authMiddleware);

/**
 * 获取所有客户信息
 */
router.get('/customers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get customers'
    });
  }
});

/**
 * 获取客户详情及其租赁历史
 */
router.get('/customers/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        message: '客户不存在'
      });
    }

    const { data: rentals, error: rentalsError } = await supabase
      .from('transactions')
      .select(`
        *,
        equipment (*)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (rentalsError) throw rentalsError;

    res.json({
      success: true,
      customer,
      rentals: rentals || []
    });
  } catch (err) {
    console.error('Get customer details error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get customer details'
    });
  }
});

/**
 * 获取所有设备
 */
router.get('/equipment', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (err) {
    console.error('Get equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get equipment'
    });
  }
});

/**
 * 按使用日期范围筛选可用设备
 * 查询参数: startDate, endDate (YYYY-MM-DD)
 */
router.get('/equipment/available-in-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '开始日期和结束日期为必填项'
      });
    }

    // 获取所有设备及其当前状态
    const { data: allEquipment, error: equipmentError } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false });

    if (equipmentError) throw equipmentError;

    // 过滤出在指定日期范围内可用的设备
    const availableEquipment = allEquipment.filter(equipment => {
      // 如果设备当前in_stock为true，说明它可用
      if (equipment.in_stock) {
        return true;
      }

      // 如果设备有checkout_date和return_date，检查是否与请求的日期范围冲突
      if (equipment.checkout_date && equipment.return_date) {
        // 如果请求的日期范围完全在设备使用期后，设备可用
        if (startDate > equipment.return_date) {
          return true;
        }
        // 如果请求的日期范围完全在设备使用期前，设备可用
        if (endDate < equipment.checkout_date) {
          return true;
        }
      }

      return false;
    });

    res.json({
      success: true,
      data: availableEquipment
    });
  } catch (err) {
    console.error('Get available equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get available equipment'
    });
  }
});

/**
 * 添加新设备
 */
router.post('/equipment', async (req, res) => {
  try {
    const { equipmentCode, brand, category, model, dailyRentalPrice, damagePrice } = req.body;

    // 验证必填项
    if (!equipmentCode || !brand || !category || !model || !dailyRentalPrice || !damagePrice) {
      return res.status(400).json({
        success: false,
        message: '所有字段为必填项'
      });
    }

    // 检查设备码是否已存在
    const { data: existing } = await supabase
      .from('equipment')
      .select('id')
      .eq('equipment_code', equipmentCode);

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该设备码已存在'
      });
    }

    const { data, error } = await supabase
      .from('equipment')
      .insert([{
        equipment_code: equipmentCode,
        brand,
        category,
        model,
        daily_rental_price: parseFloat(dailyRentalPrice),
        damage_price: parseFloat(damagePrice),
        in_stock: true
      }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: '设备添加成功',
      data: data[0]
    });
  } catch (err) {
    console.error('Add equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to add equipment',
      error: err.message
    });
  }
});

/**
 * 更新设备信息
 */
router.put('/equipment/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const updates = req.body;

    // 验证设备是否存在
    const { data: existing } = await supabase
      .from('equipment')
      .select('id')
      .eq('id', equipmentId);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 不允许修改设备码
    if (updates.equipmentCode) {
      delete updates.equipmentCode;
    }

    const { data, error } = await supabase
      .from('equipment')
      .update(updates)
      .eq('id', equipmentId)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: '设备更新成功',
      data: data[0]
    });
  } catch (err) {
    console.error('Update equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update equipment'
    });
  }
});

/**
 * 删除设备
 */
router.delete('/equipment/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', equipmentId);

    if (error) throw error;

    res.json({
      success: true,
      message: '设备删除成功'
    });
  } catch (err) {
    console.error('Delete equipment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete equipment'
    });
  }
});

/**
 * 获取所有交易
 */
/**
 * 获取所有交易（支持搜索）
 */
router.get('/transactions', async (req, res) => {
  try {
    const { status, search, sortBy, startDate, endDate, customerId } = req.query;

    let query = supabase
      .from('transactions')
      .select(`
        *,
        customers (*),
        equipment (*)
      `);

    if (status) {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    // 按邮寄日期筛选（如果提供了日期范围）
    if (startDate) {
      query = query.gte('posting_date', startDate);
    }
    if (endDate) {
      query = query.lte('posting_date', endDate);
    }

    // 排序：默认按created_at，如果指定sortBy='posting_date'则按posting_date排序
    if (sortBy === 'posting_date') {
      let { data, error } = await query.order('posting_date', { ascending: false, nullsFirst: false });
      if (error) throw error;

      // 在前端进行搜索过滤（通过客户名或交易码）
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(transaction => {
          return (
            transaction.transaction_code?.toLowerCase().includes(searchLower) ||
            transaction.customers?.name?.toLowerCase().includes(searchLower)
          );
        });
      }

      // 高亮近三天的邮寄：在response中添加标记
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      data = data.map(transaction => {
        let highlightPostingDate = false;
        if (transaction.posting_date) {
          const postingDate = new Date(transaction.posting_date);
          postingDate.setHours(0, 0, 0, 0);
          highlightPostingDate = postingDate >= today && postingDate < threeDaysLater;
        }
        return {
          ...transaction,
          highlightPostingDate
        };
      });

      res.json({
        success: true,
        data: data || []
      });
    } else {
      let { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // 在前端进行搜索过滤（通过客户名或交易码）
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(transaction => {
          return (
            transaction.transaction_code?.toLowerCase().includes(searchLower) ||
            transaction.customers?.name?.toLowerCase().includes(searchLower)
          );
        });
      }

      res.json({
        success: true,
        data: data || []
      });
    }
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions'
    });
  }
});

/**
 * 获取交易详情
 */
router.get('/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        customers (*),
        equipment (*)
      `)
      .eq('id', transactionId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: '交易不存在'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('Get transaction error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction'
    });
  }
});

/**
 * 更新交易状态、负责人、邮寄信息等
 */
router.put('/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, responsiblePerson, postingDate, postingTime, remarks } = req.body;

    // 首先获取交易信息以获取equipment_id、旧状态和rental_end_date
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('equipment_id, status, rental_end_date')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({
        success: false,
        message: '交易不存在'
      });
    }

    // 只在非 pending 状态或改回 pending 时才修改设备库存
    if (status && transaction.equipment_id) {
      let shouldUpdateEquipment = false;
      let inStock = true;

      if (status === 'pending') {
        // 改为 pending 时：检查是否还有其他活跃交易，没有则回库
        shouldUpdateEquipment = true;
        const { data: activeTransactions, error: activeError } = await supabase
          .from('transactions')
          .select('id')
          .eq('equipment_id', transaction.equipment_id)
          .neq('id', transactionId)
          .in('status', ['confirmed', 'rented', 'shipped']);
        
        if (activeError) throw activeError;
        
        // 如果没有其他活跃交易，设备回库
        inStock = !activeTransactions || activeTransactions.length === 0;
      } else if (['confirmed', 'rented', 'shipped'].includes(status)) {
        // 这些状态表示设备正在出租，不在库
        shouldUpdateEquipment = true;
        inStock = false;
      } else if (['returned', 'completed', 'cancelled', 'damaged'].includes(status)) {
        // 这些状态表示设备已回库或交易已取消
        // 需要检查是否还有其他活跃的交易
        shouldUpdateEquipment = true;
        const { data: activeTransactions, error: activeError } = await supabase
          .from('transactions')
          .select('id')
          .eq('equipment_id', transaction.equipment_id)
          .neq('id', transactionId)
          .in('status', ['confirmed', 'rented', 'shipped']);
        
        if (activeError) throw activeError;
        
        // 如果没有其他活跃交易，设备才能回库
        inStock = !activeTransactions || activeTransactions.length === 0;
      }

      // 如果需要更新设备库存，执行更新
      let equipmentUpdate = { in_stock: inStock };
      
      // 如果提供了邮寄日期，则更新设备的离库日期
      if (postingDate) {
        equipmentUpdate.checkout_date = postingDate;
      }
      
      // 设置回库日期为租期结束日期
      if (transaction.rental_end_date) {
        equipmentUpdate.return_date = transaction.rental_end_date;
      }
      
      if (shouldUpdateEquipment) {
        await supabase
          .from('equipment')
          .update(equipmentUpdate)
          .eq('id', transaction.equipment_id);
      } else if (postingDate || transaction.rental_end_date) {
        // 即使不需要更新库存，也可能需要更新日期字段
        await supabase
          .from('equipment')
          .update(equipmentUpdate)
          .eq('id', transaction.equipment_id);
      }
    }

    // 构建更新对象
    const updateData = {};
    if (status) updateData.status = status;
    if (responsiblePerson !== undefined) updateData.responsible_person = responsiblePerson;
    if (postingDate !== undefined) updateData.posting_date = postingDate;
    if (postingTime !== undefined) updateData.posting_time = postingTime;
    if (remarks !== undefined) updateData.remarks = remarks;

    // 更新交易
    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '交易不存在'
      });
    }

    res.json({
      success: true,
      message: '交易更新成功',
      data: data[0]
    });
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction'
    });
  }
});

/**
 * 获取仪表板统计数据
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const { count: customerCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact' });

    const { count: equipmentCount } = await supabase
      .from('equipment')
      .select('id', { count: 'exact' });

    const { count: inStockCount } = await supabase
      .from('equipment')
      .select('id', { count: 'exact' })
      .eq('in_stock', true);

    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' });

    const { count: pendingCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('status', 'pending');




    res.json({
      success: true,
      stats: {
        customers: customerCount || 0,
        equipment: equipmentCount || 0,
        inStock: inStockCount || 0,
        transactions: transactionCount || 0,
        pendingTransactions: pendingCount || 0
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

module.exports = router;
