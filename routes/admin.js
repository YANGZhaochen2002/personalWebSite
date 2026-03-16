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
    const { status, search } = req.query;

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
 * 更新交易状态和负责人
 */
router.put('/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, responsiblePerson } = req.body;

    // 首先获取交易信息以获取equipment_id
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('equipment_id')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({
        success: false,
        message: '交易不存在'
      });
    }

    // 根据新状态决定设备库存
    let inStock = true; // 默认为在库
    
    if (status && ['rented', 'shipped', 'pending', 'confirmed'].includes(status)) {
      // 这些状态表示设备正在出租，不在库
      inStock = false;
    } else if (status && ['returned', 'completed', 'cancelled', 'damaged'].includes(status)) {
      // 这些状态表示设备已回库或交易已取消
      // 需要检查是否还有其他活跃的交易
      const { data: activeTransactions, error: activeError } = await supabase
        .from('transactions')
        .select('id')
        .eq('equipment_id', transaction.equipment_id)
        .neq('id', transactionId)
        .in('status', ['pending', 'confirmed', 'rented', 'shipped']);
      
      if (activeError) throw activeError;
      
      // 如果没有其他活跃交易，设备才能回库
      inStock = !activeTransactions || activeTransactions.length === 0;
    }

    // 如果设备ID存在，更新设备库存状态
    if (transaction.equipment_id) {
      await supabase
        .from('equipment')
        .update({ in_stock: inStock })
        .eq('id', transaction.equipment_id);
    }

    // 更新交易
    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: status || undefined,
        responsible_person: responsiblePerson || undefined
      })
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
