const API_BASE = '/api';
let adminToken = localStorage.getItem('adminToken');
let currentTab = 'customer';
let cart = []; // 购物车：存储选中的设备

// 品牌和种类的映射关系
const categoryBrandMap = {
    '相机机身': ['FUJIFILM', 'RICOH', 'Canon'],
    '运动相机': ['DJI'],
    '相机镜头': ['Canon', 'Fujifilm（X卡口）', 'Tamron'],
    '手机': ['vivo'],
    '拍立得': ['FUJIFILM'],
    '三脚架': ['Fotopro'],
    '闪光灯': ['Godox']
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 如果已登录管理员，直接进入管理员界面
    if (adminToken) {
        switchTab('admin');
        showAdminDashboard();
    } else {
        // 加载客户端数据
        loadEquipment();
        loadFilters();
        displayCart(); // 初始化购物车显示
    }

    // 表单提交
    document.getElementById('rentalForm').addEventListener('submit', handleRentalSubmit);
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('equipmentFormSubmit').addEventListener('submit', handleAddEquipment);
});

// ==================== 客户功能 ====================

/**
 * 加载设备列表
 */
async function loadEquipment() {
    try {
        const params = new URLSearchParams();
        const brand = document.getElementById('brandFilter')?.value;
        const category = document.getElementById('categoryFilter')?.value;
        const location = document.getElementById('locationFilter')?.value;
        const minPrice = document.getElementById('minPriceFilter')?.value;
        const maxPrice = document.getElementById('maxPriceFilter')?.value;

        if (brand) params.append('brand', brand);
        if (category) params.append('category', category);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);

        const response = await fetch(`${API_BASE}/customer/equipment?${params}`);
        const data = await response.json();

        if (data.success) {
            // 如果选择了位置，在前端过滤
            let filteredData = data.data;
            if (location) {
                filteredData = data.data.filter(item => {
                    return getLocationFromModel(item.model) === location;
                });
            }
            displayEquipment(filteredData);
        } else {
            showError('equipmentList', '加载设备失败');
        }
    } catch (err) {
        console.error('Load equipment error:', err);
        showError('equipmentList', '加载设备出错');
    }
}

/**
 * 从model中解析位置信息
 */
function getLocationFromModel(model) {
    if (!model) return '';
    const parts = model.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * 显示设备列表（按型号分组）
 */
function displayEquipment(equipment) {
    const container = document.getElementById('equipmentList');
    
    if (!equipment || equipment.length === 0) {
        container.innerHTML = '<p class="loading">暂无可租设备</p>';
        return;
    }

    // 按型号分组
    const groupedByModel = {};
    equipment.forEach(item => {
        if (!groupedByModel[item.model]) {
            groupedByModel[item.model] = {
                ...item,
                count: 0,
                ids: []
            };
        }
        groupedByModel[item.model].count++;
        groupedByModel[item.model].ids.push(item.id);
    });

    // 转换成数组并显示
    const uniqueModels = Object.values(groupedByModel);
    container.innerHTML = uniqueModels.map(item => `
        <div class="equipment-card">
            <h4>${item.brand} - ${item.model}</h4>
            <p><strong>种类:</strong> ${item.category}</p>
            <p><strong>库存数量:</strong> ${item.count}</p>
            <div class="price">日租金: ¥${item.daily_rental_price.toFixed(2)}</div>
            <button class="btn-select" type="button" onclick="addToCart(${item.ids[0]}, '${item.model}', '${item.brand}', ${item.daily_rental_price}, '${item.category}')">加入购物车</button>
        </div>
    `).join('');
}


/**
 * 显示订单完成弹窗
 */
function showOrderSuccessModal(transactionCodes, count) {
    const modal = document.getElementById('successModal');
    const codeDisplay = document.getElementById('transactionCodeDisplay');
    
    let codesHTML = transactionCodes.map(code => `<div class="code-item">${code}</div>`).join('');
    
    codeDisplay.innerHTML = `
        <div class="success-modal-content">
            <p style="margin-bottom: 15px; color: #666;">共${count}个设备订单已提交</p>
            <div class="transaction-codes-list">
                <p style="font-size: 0.85rem; color: #999; margin-bottom: 8px;">交易码（请保存）：</p>
                ${codesHTML}
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 12px; margin-top: 15px; color: #856404;">
                <strong>⚠️ 重要提醒：</strong> 请立即截屏保存上方交易码，用于后续跟进
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

/**
 * 加载筛选选项
 */
async function loadFilters() {
    try {
        const response = await fetch(`${API_BASE}/customer/equipment/filters`);
        const data = await response.json();
        console.log('Filters API response:', data);

        if (data.success) {
            console.log('Categories:', data.categories);
            // 填充种类
            const categorySelect = document.getElementById('categoryFilter');
            if (!categorySelect) {
                console.error('categoryFilter element not found');
                return;
            }
            
            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                    console.log('Added category option:', category);
                });
            } else {
                console.warn('No categories found in response');
            }
            
            // 添加category变化事件监听，动态更新品牌
            categorySelect.addEventListener('change', updateBrandFilter);
        } else {
            console.error('Filters API returned success: false', data);
        }
    } catch (err) {
        console.error('Load filters error:', err);
    }
}

/**
 * 根据选择的种类更新品牌筛选器
 */
function updateBrandFilter() {
    const categorySelect = document.getElementById('categoryFilter');
    const brandSelect = document.getElementById('brandFilter');
    const selectedCategory = categorySelect.value;
    
    // 清空品牌选项，保留"所有品牌"
    while (brandSelect.options.length > 1) {
        brandSelect.remove(1);
    }
    
    // 如果选择了种类，加载对应的品牌
    if (selectedCategory && categoryBrandMap[selectedCategory]) {
        categoryBrandMap[selectedCategory].forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandSelect.appendChild(option);
        });
    }
}

/**
 * 应用筛选器
 */
function applyFilters() {
    loadEquipment();
}

/**
 * 添加设备到购物车
 */
function addToCart(id, model, brand, dailyPrice, category) {
    // 检查是否已在购物车中
    const existingItem = cart.find(item => item.model === model);
    if (existingItem) {
        alert('此设备已在购物车中');
        return;
    }
    
    // 生成唯一的购物车项ID（用于前端引用）
    const cartItemId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 添加到购物车
    cart.push({
        cartItemId,
        id,
        model,
        brand,
        dailyPrice,
        category,
        startDate: '',
        endDate: ''
    });
    
    // 显示购物车
    displayCart();
}

/**
 * 从购物车移除设备
 */
function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.cartItemId !== cartItemId);
    displayCart();
}

/**
 * 显示购物车
 */
function displayCart() {
    const cartContainer = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-cart">购物车为空，请先添加设备</p>';
        document.getElementById('checkoutSection').style.display = 'none';
        return;
    }
    
    document.getElementById('checkoutSection').style.display = 'block';
    
    cartContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.brand} - ${item.model}</h4>
                <p><strong>种类:</strong> ${item.category}</p>
                <p><strong>日租金:</strong> ¥${item.dailyPrice.toFixed(2)}</p>
            </div>
            <div class="cart-item-dates">
                <div class="date-group">
                    <label>租期开始</label>
                    <input type="date" value="${item.startDate}" onchange="updateCartItemDate('${item.cartItemId}', 'startDate', this.value)">
                </div>
                <div class="date-group">
                    <label>租期结束</label>
                    <input type="date" value="${item.endDate}" onchange="updateCartItemDate('${item.cartItemId}', 'endDate', this.value)">
                </div>
                <div class="item-subtotal">
                    <p id="subtotal-${item.cartItemId}">小计: ¥0.00</p>
                </div>
            </div>
            <button class="btn-remove" type="button" onclick="removeFromCart('${item.cartItemId}')">删除</button>
        </div>
    `).join('');
    
    // 更新各项的小计
    updateAllSubtotals();
}

/**
 * 更新购物车项目的日期
 */
function updateCartItemDate(cartItemId, dateType, value) {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (item) {
        item[dateType] = value;
        updateAllSubtotals();
    }
}

/**
 * 更新所有购物车项目的小计和总价
 */
function updateAllSubtotals() {
    let totalPrice = 0;
    
    cart.forEach(item => {
        if (item.startDate && item.endDate) {
            const startDate = new Date(item.startDate);
            const endDate = new Date(item.endDate);
            const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            if (days > 0) {
                const subtotal = item.dailyPrice * days;
                document.getElementById(`subtotal-${item.cartItemId}`).textContent = 
                    `小计: ¥${subtotal.toFixed(2)} (${days}天)`;
                totalPrice += subtotal;
            } else {
                document.getElementById(`subtotal-${item.cartItemId}`).textContent = `小计: ¥0.00 (日期错误)`;
            }
        } else {
            document.getElementById(`subtotal-${item.cartItemId}`).textContent = `小计: ¥0.00`;
        }
    });
    
    // 更新总价
    const totalPriceInfo = document.getElementById('totalPriceInfo');
    if (totalPriceInfo) {
        totalPriceInfo.textContent = `总租金: ¥${totalPrice.toFixed(2)}`;
    }
}


/**
 * 提交租赁订单（支持多个设备）
 */
async function handleRentalSubmit(e) {
    e.preventDefault();

    if (cart.length === 0) {
        alert('请先添加设备到购物车');
        return;
    }
    
    // 检查所有项目是否都有有效的租期
    for (let item of cart) {
        if (!item.startDate || !item.endDate) {
            alert(`请为 ${item.model} 设置租期`);
            return;
        }
        const startDate = new Date(item.startDate);
        const endDate = new Date(item.endDate);
        if (startDate >= endDate) {
            alert(`${item.model} 的租期无效（结束日期必须晚于开始日期）`);
            return;
        }
    }

    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value || null;
    const customerNickname = document.getElementById('customerNickname').value || null;
    const deliveryAddress = document.getElementById('deliveryAddress').value;

    if (!customerName || !deliveryAddress) {
        alert('请填写姓名和收件地址');
        return;
    }

    // 准备所有租赁请求
    const rentalRequests = cart.map(item => ({
        name: customerName,
        contactPhone: customerPhone,
        nickname: customerNickname,
        deliveryAddress: deliveryAddress,
        equipmentId: item.id,
        rentalStartDate: item.startDate,
        rentalEndDate: item.endDate
    }));

    try {
        // 遍历提交每个租赁
        const results = [];
        let successCount = 0;
        
        for (let rentalData of rentalRequests) {
            const response = await fetch(`${API_BASE}/customer/rental`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rentalData)
            });

            const data = await response.json();
            
            if (data.success) {
                results.push(data.transactionCode);
                successCount++;
            } else {
                alert(`${rentalData.equipmentId} 提交失败: ${data.message}`);
            }
        }

        if (successCount > 0) {
            // 显示成功模态框
            showOrderSuccessModal(results, successCount);

            // 重置表单和购物车
            document.getElementById('rentalForm').reset();
            cart = [];
            displayCart();
            loadEquipment();
        } else {
            alert('所有订单提交失败，请重试');
        }
    } catch (err) {
        console.error('Submit rental error:', err);
        alert('提交出错，请重试');
    }
}

// ==================== 管理员功能 ====================

/**
 * 切换标签页
 */
function switchTab(tab) {
    currentTab = tab;
    document.getElementById('customerView').style.display = tab === 'customer' ? 'block' : 'none';
    document.getElementById('adminView').style.display = tab === 'admin' ? 'block' : 'none';

    // 更新按钮状态
    document.getElementById('customerTabBtn').classList.toggle('active', tab === 'customer');
    document.getElementById('adminTabBtn').classList.toggle('active', tab === 'admin');

    if (tab === 'admin' && adminToken) {
        loadAdminData();
    }
}

/**
 * 管理员登录
 */
async function handleAdminLogin(e) {
    e.preventDefault();

    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            showAdminDashboard();
        } else {
            showError('adminLoginError', data.message || '登录失败');
        }
    } catch (err) {
        console.error('Admin login error:', err);
        showError('adminLoginError', '登录出错');
    }
}


/**
 * 显示管理员仪表板
 */
function showAdminDashboard() {
    switchTab('admin');
    document.getElementById('adminLoginPanel').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    loadAdminData();
    // 延迟调用以确保DOM已更新
    setTimeout(() => switchAdminTab('equipment'), 100);
}

/**
 * 加载管理员数据
 */
async function loadAdminData() {
    if (!adminToken) return;

    // 加载统计数据
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('stat-customers').textContent = data.stats.customers;
            document.getElementById('stat-equipment').textContent = data.stats.equipment;
            document.getElementById('stat-inStock').textContent = data.stats.inStock;
            document.getElementById('stat-transactions').textContent = data.stats.transactions;
            document.getElementById('stat-pending').textContent = data.stats.pendingTransactions;
        }
    } catch (err) {
        console.error('Load stats error:', err);
    }

    // 表格数据由switchAdminTab在切换时加载
}

/**
 * 切换管理员标签页
 */
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const tabId = tab + 'Tab';
    const tabElement = document.getElementById(tabId);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // 找到对应的按钮并添加active类
    const tabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(
        btn => btn.textContent.includes(
            tab === 'equipment' ? '设备' : 
            tab === 'customers' ? '客户' : 
            '交易'
        )
    );
    if (tabBtn) {
        tabBtn.classList.add('active');
    }

    // 根据标签页加载对应数据
    if (tab === 'equipment') {
        loadAdminEquipment();
    }
    else if (tab === 'customers') {
        loadAdminCustomers();
    }
    else if (tab === 'transactions') {
        loadAdminTransactions();
    }
}

/**
 * 加载设备（管理员）
 */
async function loadAdminEquipment() {
    try {
        const response = await fetch(`${API_BASE}/admin/equipment`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        if (data.success) {
            displayAdminEquipmentTable(data.data);
        }
    } catch (err) {
        console.error('Load admin equipment error:', err);
    }
}

/**
 * 按日期范围加载可用设备
 */
async function loadAvailableEquipment() {
    try {
        const startDate = document.getElementById('equipmentFilterStartDate')?.value;
        const endDate = document.getElementById('equipmentFilterEndDate')?.value;
        
        if (!startDate || !endDate) {
            alert('请选择日期范围');
            return;
        }
        
        if (startDate > endDate) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        
        const response = await fetch(
            `${API_BASE}/admin/equipment/available-in-range?startDate=${startDate}&endDate=${endDate}`,
            {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }
        );

        const data = await response.json();
        if (data.success) {
            displayAdminEquipmentTable(data.data);
        } else {
            alert(data.message || '筛选失败');
        }
    } catch (err) {
        console.error('Load available equipment error:', err);
        alert('筛选出错');
    }
}

/**
 * 显示设备表格
 */
function displayAdminEquipmentTable(equipment) {
    const tbody = document.querySelector('#equipmentTable tbody');
    tbody.innerHTML = equipment.map(item => `
        <tr>
            <td>${item.equipment_code}</td>
            <td>${item.brand}</td>
            <td>${item.category}</td>
            <td>${item.model}</td>
            <td>¥${item.daily_rental_price.toFixed(2)}</td>
            <td>¥${item.damage_price.toFixed(2)}</td>
            <td>${item.in_stock ? '是' : '否'}</td>
            <td>
                <button class="btn-edit" onclick="editEquipment(${item.id})">编辑</button>
                <button class="btn-delete" onclick="deleteEquipment(${item.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

/**
 * 显示添加设备表单
 */
function showAddEquipmentForm() {
    document.getElementById('addEquipmentForm').style.display = 'block';
}

/**
 * 关闭添加设备表单
 */
function closeAddEquipmentForm() {
    document.getElementById('addEquipmentForm').style.display = 'none';
    document.getElementById('equipmentFormSubmit').reset();
}

/**
 * 提交添加设备
 */
async function handleAddEquipment(e) {
    e.preventDefault();

    const equipmentData = {
        equipmentCode: document.getElementById('equipCode').value,
        brand: document.getElementById('equipBrand').value,
        category: document.getElementById('equipCategory').value,
        model: document.getElementById('equipModel').value,
        dailyRentalPrice: parseFloat(document.getElementById('equipDailyPrice').value),
        damagePrice: parseFloat(document.getElementById('equipDamagePrice').value)
    };

    try {
        const response = await fetch(`${API_BASE}/admin/equipment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(equipmentData)
        });

        const data = await response.json();

        if (data.success) {
            alert('设备添加成功');
            closeAddEquipmentForm();
            loadAdminEquipment();
            loadAdminData(); // 更新统计
        } else {
            alert('添加失败: ' + data.message);
        }
    } catch (err) {
        console.error('Add equipment error:', err);
        alert('添加出错');
    }
}

/**
 * 删除设备
 */
async function deleteEquipment(equipmentId) {
    if (!confirm('确定要删除此设备吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/equipment/${equipmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();

        if (data.success) {
            alert('设备删除成功');
            loadAdminEquipment();
            loadAdminData();
        } else {
            alert('删除失败: ' + data.message);
        }
    } catch (err) {
        console.error('Delete equipment error:', err);
        alert('删除出错');
    }
}

/**
 * 加载客户信息
 */
/**
 * 加载客户信息
 */
async function loadAdminCustomers() {
    try {
        if (!adminToken) return;
        
        const response = await fetch(`${API_BASE}/admin/customers`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        const tbody = document.querySelector('#customersTable tbody');
        
        if (data.success && data.data) {
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #999;">暂无客户数据</td></tr>';
            } else {
                const html = data.data.map(customer => `
                    <tr>
                        <td>${customer.name}</td>
                        <td>${customer.contact_phone || '-'}</td>
                        <td>${customer.nickname || '-'}</td>
                        <td>${customer.delivery_address}</td>
                        <td>
                            <button class="btn-edit" onclick="viewCustomerDetails(${customer.id})">查看</button>
                        </td>
                    </tr>
                `).join('');
                tbody.innerHTML = html;
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">加载失败</td></tr>';
        }
    } catch (err) {
        console.error('Load customers error:', err);
        const tbody = document.querySelector('#customersTable tbody');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">加载出错</td></tr>';
    }
}

/**
 * 加载交易信息
 */
/**
 * 加载交易（管理员）
 */
async function loadAdminTransactions(searchQuery = '') {
    try {
        if (!adminToken) return;
        
        const sortBySelect = document.getElementById('sortBySelect');
        const sortBy = sortBySelect?.value || 'created_at';
        
        let url = `${API_BASE}/admin/transactions?sortBy=${sortBy}`;
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        const tbody = document.querySelector('#transactionsTable tbody');
        
        if (data.success && data.data) {
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: #999;">暂无交易数据</td></tr>';
            } else {
                const html = data.data.map(trans => {
                    const highlightClass = trans.highlightPostingDate ? 'highlight-posting-date' : '';
                    return `
                        <tr class="${highlightClass}">
                            <td><strong>${trans.transaction_code}</strong></td>
                            <td>${trans.customers?.name || '-'}</td>
                            <td>${trans.equipment?.equipment_code || '-'}</td>
                            <td>${trans.rental_start_date} 至 ${trans.rental_end_date}</td>
                            <td>¥${parseFloat(trans.total_price).toFixed(2)}</td>
                            <td><span class="status-badge status-${trans.status}">${trans.status}</span></td>
                            <td>${trans.responsible_person || '-'}</td>
                            <td>
                                <button class="btn-edit" onclick="openEditTransactionModal(${trans.id}, '${trans.status}', '${trans.responsible_person || ''}', '${trans.posting_date || ''}', '${trans.posting_time || ''}', '${(trans.remarks || '').replace(/'/g, "\\'")}')">编辑</button>
                            </td>
                        </tr>
                    `;
                }).join('');
                tbody.innerHTML = html;
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">加载失败</td></tr>';
        }
    } catch (err) {
        console.error('Load transactions error:', err);
        const tbody = document.querySelector('#transactionsTable tbody');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">加载出错</td></tr>';
    }
}

/**
 * 搜索交易
 */
function searchTransactions() {
    const searchInput = document.getElementById('transactionSearchInput');
    const searchQuery = searchInput.value.trim();
    loadAdminTransactions(searchQuery);
}

/**
 * 打开编辑交易模态框
 */
function openEditTransactionModal(transactionId, currentStatus, currentResponsible, currentPostingDate, currentPostingTime, currentRemarks) {
    const modal = document.getElementById('editTransactionModal');
    if (!modal) {
        console.error('Transaction edit modal not found');
        return;
    }
    
    // 存储交易ID用于保存
    modal.dataset.transactionId = transactionId;
    
    // 设置当前值
    const statusSelect = document.getElementById('transactionStatus');
    const responsibleInput = document.getElementById('transactionResponsible');
    const postingDateInput = document.getElementById('transactionPostingDate');
    const postingTimeInput = document.getElementById('transactionPostingTime');
    const remarksInput = document.getElementById('transactionRemarks');
    
    if (statusSelect) {
        statusSelect.value = currentStatus || 'pending';
    }
    if (responsibleInput) {
        responsibleInput.value = currentResponsible || '';
    }
    if (postingDateInput) {
        postingDateInput.value = currentPostingDate || '';
    }
    if (postingTimeInput) {
        postingTimeInput.value = currentPostingTime || '';
    }
    if (remarksInput) {
        remarksInput.value = currentRemarks || '';
    }
    
    modal.style.display = 'flex';
}

/**
 * 关闭编辑交易模态框
 */
function closeEditTransactionModal() {
    const modal = document.getElementById('editTransactionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 保存交易更改
 */
async function saveTransactionChanges() {
    if (!adminToken) {
        return;
    }
    
    const modal = document.getElementById('editTransactionModal');
    const transactionId = modal.dataset.transactionId;
    const statusSelect = document.getElementById('transactionStatus');
    const responsibleInput = document.getElementById('transactionResponsible');
    const postingDateInput = document.getElementById('transactionPostingDate');
    const postingTimeInput = document.getElementById('transactionPostingTime');
    const remarksInput = document.getElementById('transactionRemarks');
    
    const status = statusSelect?.value;
    const responsiblePerson = responsibleInput?.value || null;
    const postingDate = postingDateInput?.value || null;
    const postingTime = postingTimeInput?.value || null;
    const remarks = remarksInput?.value || null;
    
    if (!status || !transactionId) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/transactions/${transactionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                status,
                responsiblePerson,
                postingDate,
                postingTime,
                remarks
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeEditTransactionModal();
            loadAdminTransactions(); // 刷新列表
        }
    } catch (err) {
        console.error('Save transaction error:', err);
    }
}

/**
 * 退出登录
 */
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            adminToken = null;
            localStorage.removeItem('adminToken');
            
            // 切换回客户界面
            switchTab('customer');
            
            // 重置管理员界面
            document.getElementById('adminLoginPanel').style.display = 'flex';
            document.getElementById('adminDashboard').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('adminLoginForm').reset();
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
        });
    }
});

// ==================== 工具函数 ====================

/**
 * 显示错误信息
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.classList.add('show');
    }
}

/**
 * 关闭模态框
 */
function closeModal() {
    document.getElementById('successModal').style.display = 'none';
}

/**
 * 编辑设备（占位符）
 */
function editEquipment(equipmentId) {
    alert('编辑功能开发中');
}

/**
 * 查看客户详情（占位符）
 */
function viewCustomerDetails(customerId) {
    alert('客户详情功能开发中');
}

/**
 * 编辑交易（占位符）
 */
function editTransaction(transactionId) {
    alert('交易编辑功能开发中');
}
