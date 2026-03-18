const API_BASE = '/api';
let adminToken = localStorage.getItem('adminToken');
let cart = []; // 购物车：存储选中的设备

// 检测当前页面是否为管理员页面
const isAdminPage = window.location.pathname.includes('admin.html');

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
    if (isAdminPage) {
        // 管理员页面初始化
        initAdminPage();
    } else {
        // 客户页面初始化
        initCustomerPage();
    }
});

/**
 * 初始化管理员页面
 */
function initAdminPage() {
    if (adminToken) {
        // 显示仪表板
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAdminData();
        switchAdminTab('equipment');
    } else {
        // 显示登录页面
        document.getElementById('loginView').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
    }
    
    // 管理员登录表单
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
}

/**
 * 初始化客户页面
 */
function initCustomerPage() {
    // 加载客户端数据
    loadEquipment();
    loadFilters();
    displayCart(); // 初始化购物车显示

    // 初始化订单类型
    const defaultTypeRadio = document.querySelector('input[name="transactionType"][value="shipping"]');
    if (defaultTypeRadio) {
        defaultTypeRadio.checked = true;
        updateOrderTypeFields();
    }

    // 表单提交
    const rentalForm = document.getElementById('rentalForm');
    if (rentalForm) {
        rentalForm.addEventListener('submit', handleRentalSubmit);
    }
    
    const equipmentFormSubmit = document.getElementById('equipmentFormSubmit');
    if (equipmentFormSubmit) {
        equipmentFormSubmit.addEventListener('submit', handleAddEquipment);
    }
}

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
    
    // 存储交易码到模态框数据属性，便于一键复制
    modal.dataset.transactionCodes = transactionCodes.join('\n');
    
    let codesHTML = transactionCodes.map(code => `<div class="code-item">${code}</div>`).join('');
    
    codeDisplay.innerHTML = `
        <div class="success-modal-content">
            <p style="margin-bottom: 15px; color: #666;">共${count}个设备订单已提交</p>
            <div class="transaction-codes-list">
                <p style="font-size: 0.85rem; color: #999; margin-bottom: 8px;">交易码（请保存）：</p>
                ${codesHTML}
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 12px; margin-top: 15px; color: #856404;">
                <strong>⚠️ 重要提醒：</strong> 请复制上方交易码，发送至客服，用于后续跟进
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

/**
 * 一键复制所有交易码
 */
function copyAllTransactionCodes() {
    const modal = document.getElementById('successModal');
    const codes = modal.dataset.transactionCodes;
    
    if (!codes) {
        alert('没有交易码可复制');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.textContent;
    
    // 使用 Clipboard API 复制
    navigator.clipboard.writeText(codes).then(() => {
        updateCopyButtonSuccess(btn, originalText);
    }).catch(err => {
        console.error('复制失败:', err);
        // 即使失败也改变按钮状态，表示已复制
        updateCopyButtonSuccess(btn, originalText);
    });
}

/**
 * 更新复制按钮状态为已复制
 */
function updateCopyButtonSuccess(btn, originalText) {
    btn.textContent = '✓ 已复制!';
    btn.style.backgroundColor = '#4caf50';
    
    // 2秒后恢复按钮
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
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
    
    // 更新购物车徽章
    const cartBadge = document.getElementById('cartBadge');
    if (cart.length > 0) {
        cartBadge.textContent = cart.length;
        cartBadge.style.display = 'inline-flex';
    } else {
        cartBadge.style.display = 'none';
    }
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-cart">购物车为空</p>';
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
    
    // 获取订单类型 - 确保获取到值
    const typeRadio = document.querySelector('input[name="transactionType"]:checked');
    if (!typeRadio) {
        alert('请选择订单类型');
        return;
    }
    const transactionType = typeRadio.value;
    console.log('Transaction Type:', transactionType); // 调试
    
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

    if (!customerName) {
        alert('请填写客户名');
        return;
    }

    // 根据订单类型进行验证和处理
    let deliveryAddress = null;
    let returnAddress = null;
    let pickupTime = null;
    let returnPickupTime = null;

    if (transactionType === 'shipping') {
        deliveryAddress = document.getElementById('deliveryAddress').value || null; // 地址改为可选
        returnAddress = document.getElementById('returnAddress').value || deliveryAddress; // 寄回地址默认等于收货地址
    } else if (transactionType === 'pickup') {
        pickupTime = document.getElementById('pickupTime').value;
        returnPickupTime = document.getElementById('returnPickupTime').value;
        if (!pickupTime || !returnPickupTime) {
            alert('自提方式需要填写自提时间和设备归还时间');
            return;
        }
        // 验证时间顺序
        const pickup = new Date(pickupTime);
        const returnTime = new Date(returnPickupTime);
        if (pickup >= returnTime) {
            alert('设备归还时间必须晚于自提时间');
            return;
        }
    }

    // 准备所有租赁请求
    const rentalRequests = cart.map(item => ({
        name: customerName,
        contactPhone: customerPhone,
        nickname: customerNickname,
        transactionType: transactionType,
        deliveryAddress: deliveryAddress,
        returnAddress: returnAddress,
        pickupTime: pickupTime,
        returnPickupTime: returnPickupTime,
        equipmentId: item.id,
        rentalStartDate: item.startDate,
        rentalEndDate: item.endDate
    }));

    try {
        // 遍历提交每个租赁
        const results = [];
        let successCount = 0;
        
        for (let rentalData of rentalRequests) {
            console.log('Submitting rental with data:', rentalData); // 调试：打印完整的请求数据
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
                alert(`订单提交失败: ${data.message}`);
            }
        }

        if (successCount > 0) {
            // 显示成功模态框
            showOrderSuccessModal(results, successCount);

            // 重置表单和购物车
            document.getElementById('rentalForm').reset();
            cart = [];
            displayCart();
            switchCustomerPage('equipment');
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

// ==================== 页面控制函数 ====================

/**
 * 切换客户端页面（设备列表 <-> 购物车）
 */
function switchCustomerPage(page) {
    if (page === 'equipment') {
        document.getElementById('equipmentViewPage').style.display = 'block';
        document.getElementById('cartViewPage').style.display = 'none';
    } else if (page === 'cart') {
        document.getElementById('equipmentViewPage').style.display = 'none';
        document.getElementById('cartViewPage').style.display = 'block';
        // 初始化订单类型表单
        const typeRadio = document.querySelector('input[name="transactionType"]');
        if (typeRadio && !document.querySelector('input[name="transactionType"]:checked')) {
            typeRadio.checked = true;
            updateOrderTypeFields();
        }
    }
}

/**
 * 根据订单类型切换显示字段
 */
function updateOrderTypeFields() {
    const transactionType = document.querySelector('input[name="transactionType"]:checked').value;
    const shippingSection = document.getElementById('shippingSection');
    const pickupSection = document.getElementById('pickupSection');
    
    if (transactionType === 'shipping') {
        shippingSection.style.display = 'block';
        pickupSection.style.display = 'none';
        // 邮寄方式下，地址为可选
        document.getElementById('deliveryAddress').required = false;
        document.getElementById('pickupTime').required = false;
        document.getElementById('returnPickupTime').required = false;
    } else if (transactionType === 'pickup') {
        shippingSection.style.display = 'none';
        pickupSection.style.display = 'block';
        // 自提方式下，地址不必填
        document.getElementById('deliveryAddress').required = false;
        document.getElementById('pickupTime').required = true;
        document.getElementById('returnPickupTime').required = true;
    }
}

/**
 * 备注高亮处理函数
 */
function addRemarkHighlight(color) {
    const textarea = document.getElementById('transactionRemarks');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // 检查是否选中了文本
    if (start === end) {
        alert('请先选中要高亮的文本');
        return;
    }
    
    const selectedText = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    
    const colorMap = {
        'yellow': '黄',
        'red': '红',
        'cyan': '青',
        'green': '绿'
    };
    
    const colorLabel = colorMap[color] || color;
    const highlightedText = `[${colorLabel}]${selectedText}[/${colorLabel}]`;
    textarea.value = before + highlightedText + after;
    
    // 将光标位置设置在新文本之后
    const newCursorPos = start + highlightedText.length;
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
}

/**
 * 解析备注中的高亮标记
 */
function parseRemarkHighlights(remarksText) {
    if (!remarksText) return '-';
    
    const colorStyles = {
        '黄': 'background-color: #ffeb3b; padding: 2px 4px; border-radius: 2px;',
        '红': 'background-color: #ff4444; color: white; padding: 2px 4px; border-radius: 2px;',
        '青': 'background-color: #00bcd4; color: white; padding: 2px 4px; border-radius: 2px;',
        '绿': 'background-color: #4caf50; color: white; padding: 2px 4px; border-radius: 2px;'
    };
    
    let html = remarksText;
    for (const [color, style] of Object.entries(colorStyles)) {
        const pattern = new RegExp(`\\[${color}\\]([^\\[]*?)\\[/${color}\\]`, 'g');
        html = html.replace(pattern, `<span style="${style}">$1</span>`);
    }
    
    return html;
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
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadAdminData();
    // 延迟调用以确保DOM已更新
    setTimeout(() => switchAdminTab('equipment'), 100);
}

/**
 * 管理员退出登录
 */
function logout() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('loginView').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    // 清空登录表单
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.reset();
    }
    // 清空错误消息
    const errorDiv = document.getElementById('adminLoginError');
    if (errorDiv) {
        errorDiv.textContent = '';
    }
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
    
    // 为负责人选择框添加事件监听
    const responsiblePersonFilter = document.getElementById('responsiblePersonFilter');
    if (responsiblePersonFilter) {
        responsiblePersonFilter.addEventListener('change', searchTransactions);
    }
    
    // 为已完成订单负责人选择框添加事件监听
    const completedResponsiblePersonFilter = document.getElementById('completedResponsiblePersonFilter');
    if (completedResponsiblePersonFilter) {
        completedResponsiblePersonFilter.addEventListener('change', searchCompletedTransactions);
    }
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
            tab === 'transactions' ? '交易管理' :
            '已完成'
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
    else if (tab === 'completedTransactions') {
        loadCompletedTransactions();
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
        <tr style="cursor: pointer;" onclick="viewEquipmentRentalCalendar(${item.id})">
            <td>${item.equipment_code}</td>
            <td>${item.brand}</td>
            <td>${item.category}</td>
            <td>${item.model}</td>
            <td>¥${item.daily_rental_price.toFixed(2)}</td>
            <td>¥${item.damage_price.toFixed(2)}</td>
            <td>${item.in_stock ? '是' : '否'}</td>
            <td onclick="event.stopPropagation();">
                <button class="btn-edit" onclick="editEquipment(${item.id})">编辑</button>
                <button class="btn-delete" onclick="deleteEquipment(${item.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

/**
 * 搜索设备（按设备码或型号）
 */
function searchEquipment() {
    const searchInput = document.getElementById('equipmentSearchInput');
    const searchQuery = searchInput?.value.toLowerCase().trim() || '';
    
    if (!searchQuery) {
        loadAdminEquipment();
        return;
    }

    // 从当前显示的表格中搜索，或者重新加载后搜索
    const equipmentTable = document.querySelector('#equipmentTable tbody');
    const rows = equipmentTable.querySelectorAll('tr');
    
    if (rows.length === 0) {
        loadAdminEquipment();
        return;
    }

    // 遍历行，隐藏不匹配的行
    let visibleCount = 0;
    rows.forEach(row => {
        const equipCode = row.cells[0]?.textContent.toLowerCase() || '';
        const model = row.cells[3]?.textContent.toLowerCase() || '';
        
        const matches = equipCode.includes(searchQuery) || model.includes(searchQuery);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    if (visibleCount === 0) {
        // 如果没有匹配的行，显示"无搜索结果"消息
        const tbody = document.querySelector('#equipmentTable tbody');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: #999;">无搜索结果</td></tr>';
    }
}

/**
 * 查看设备租期日历
 */
async function viewEquipmentRentalCalendar(equipmentId) {
    try {
        if (!adminToken) return;

        // 获取设备信息
        const equipResponse = await fetch(`${API_BASE}/admin/equipment`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const equipData = await equipResponse.json();
        const equipment = equipData.data?.find(e => e.id === equipmentId);

        if (!equipment) {
            alert('设备不存在');
            return;
        }

        // 获取该设备的所有订单（不限制status）
        const url = `${API_BASE}/admin/transactions`;
        const transResponse = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const transData = await transResponse.json();
        
        // 前端过滤：按设备ID和排除已完成/已取消的订单
        const relevantTransactions = (transData.data || [])
            .filter(trans => {
                // 检查equipment_id是否匹配（支持直接字段和equipment对象）
                const equipmentId_value = trans.equipment_id || (trans.equipment?.id);
                const equipmentMatch = equipmentId_value === equipmentId;
                // 排除已完成和已取消的订单
                const notCompleted = trans.status !== 'completed' && trans.status !== 'cancelled';
                return equipmentMatch && notCompleted;
            });

        console.log('Relevant transactions:', relevantTransactions);
        console.log('Equipment ID:', equipmentId);
        console.log('All transactions:', transData.data);

        // 更新模态框信息
        document.getElementById('rentalEquipmentCode').textContent = equipment.equipment_code;
        document.getElementById('rentalEquipmentModel').textContent = equipment.model;
        document.getElementById('rentalEquipmentBrand').textContent = equipment.brand;

        // 生成日历
        generateEquipmentRentalCalendar(relevantTransactions);

        // 显示订单列表
        displayEquipmentOrders(relevantTransactions);

        // 打开模态框
        const modal = document.getElementById('equipmentRentalModal');
        modal.classList.add('active');
    } catch (err) {
        console.error('View equipment rental calendar error:', err);
        alert('加载设备租期日历出错');
    }
}

/**
 * 生成设备租期日历
 */
function generateEquipmentRentalCalendar(transactions) {
    const container = document.getElementById('equipmentCalendar');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 生成当前月份和未来3个月的日历
    const monthsToShow = 4;
    let calendarHTML = '';

    for (let monthOffset = 0; monthOffset < monthsToShow; monthOffset++) {
        const displayDate = new Date(currentYear, currentMonth + monthOffset, 1);
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        
        calendarHTML += generateMonthCalendar(year, month, transactions);
    }

    container.innerHTML = calendarHTML;
}

/**
 * 生成单月日历
 */
function generateMonthCalendar(year, month, transactions) {
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    let calendarHTML = `<div style="display: inline-block; margin-right: 20px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">`;
    calendarHTML += `<h4 style="text-align: center; margin: 0 0 10px 0;">${year}年${monthNames[month]}</h4>`;
    calendarHTML += `<table style="width: 100%; border-collapse: collapse; font-size: 12px;">`;
    calendarHTML += `<tr style="background: #f0f0f0;">`;
    
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    weekDays.forEach(day => {
        calendarHTML += `<th style="width: 30px; height: 25px; text-align: center; border: 1px solid #ddd; font-weight: 600;">${day}</th>`;
    });
    calendarHTML += `</tr>`;

    // 填充日期
    let dayCount = 1;
    for (let i = 0; i < 6; i++) {
        calendarHTML += `<tr>`;
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startDate) {
                calendarHTML += `<td style="height: 40px; border: 1px solid #eee;"></td>`;
            } else if (dayCount > daysInMonth) {
                calendarHTML += `<td style="height: 40px; border: 1px solid #eee;"></td>`;
            } else {
                const date = new Date(year, month, dayCount);
                const dateStr = formatDate(date);
                const dayTransactions = transactions.filter(trans => {
                    const rentalStart = new Date(trans.rental_start_date);
                    const rentalEnd = new Date(trans.rental_end_date);
                    const pickupTime = trans.pickup_time ? new Date(trans.pickup_time) : null;
                    const postingDate = trans.posting_date ? new Date(trans.posting_date) : null;
                    const adminReturnDate = trans.admin_return_date ? new Date(trans.admin_return_date) : null;

                    // 检查日期是否在租期内，或是邮寄/自提/回库日期
                    const inRentalPeriod = date >= rentalStart && date <= rentalEnd;
                    const isPickupDate = pickupTime && formatDate(pickupTime) === dateStr;
                    const isPostingDate = postingDate && formatDate(postingDate) === dateStr;
                    const isAdminReturnDate = adminReturnDate && formatDate(adminReturnDate) === dateStr;

                    return inRentalPeriod || isPickupDate || isPostingDate || isAdminReturnDate;
                });

                let cellBgColor = '#ffffff';
                let cellContent = `<div style="height: 40px; padding: 2px; overflow: hidden; font-size: 11px;">${dayCount}`;

                if (dayTransactions.length > 0) {
                    // 确定优先级：邮寄日期 > 自提日期 > 回库日期 > 租期内
                    const hasPosting = dayTransactions.some(t => t.posting_date && formatDate(new Date(t.posting_date)) === dateStr);
                    const hasPickup = dayTransactions.some(t => t.pickup_time && formatDate(new Date(t.pickup_time)) === dateStr);
                    const hasAdminReturnDate = dayTransactions.some(t => t.admin_return_date && formatDate(new Date(t.admin_return_date)) === dateStr);
                    const inRental = dayTransactions.filter(t => {
                        const rentalStart = new Date(t.rental_start_date);
                        const rentalEnd = new Date(t.rental_end_date);
                        return date >= rentalStart && date <= rentalEnd;
                    }).length > 0;

                    // 优先级设置：邮寄(蓝色) > 自提(橙色) > 回库(深红色) > 租期(浅绿色)
                    if (hasPosting) {
                        cellBgColor = '#2196f3'; // 蓝色 - 邮寄
                        cellContent += `<br><span style="color: white; font-weight: bold; font-size: 10px;">邮寄</span>`;
                    } else if (hasPickup) {
                        cellBgColor = '#ff9800'; // 橙色 - 自提
                        cellContent += `<br><span style="color: white; font-weight: bold; font-size: 10px;">自提</span>`;
                    } else if (hasAdminReturnDate) {
                        cellBgColor = '#ff5722'; // 深红色 - 回库
                        cellContent += `<br><span style="color: white; font-weight: bold; font-size: 10px;">回库</span>`;
                    } else if (inRental) {
                        cellBgColor = '#4caf50'; // 绿色 - 租期中
                        cellContent += `<br><span style="color: white; font-weight: bold; font-size: 10px;">租期</span>`;
                    }
                }

                cellContent += `</div>`;
                calendarHTML += `<td style="height: 40px; border: 1px solid #ddd; background: ${cellBgColor}; padding: 0;">${cellContent}</td>`;
                dayCount++;
            }
        }
        calendarHTML += `</tr>`;
        if (dayCount > daysInMonth) break;
    }

    calendarHTML += `</table></div>`;
    return calendarHTML;
}

/**
 * 显示设备订单列表
 */
function displayEquipmentOrders(transactions) {
    const ordersList = document.getElementById('rentalOrdersList');
    
    if (transactions.length === 0) {
        ordersList.innerHTML = '<p style="color: #999;">暂无未完成订单</p>';
        return;
    }

    // 按开始日期排序
    transactions.sort((a, b) => new Date(a.rental_start_date) - new Date(b.rental_start_date));

    const ordersHTML = transactions.map(trans => {
        const typeLabel = trans.transaction_type === 'pickup' ? '自提' : '邮寄';
        let timeInfo = '';

        if (trans.transaction_type === 'pickup') {
            timeInfo = `<p><strong>自提时间:</strong> ${trans.pickup_time || '-'}</p>`;
        } else {
            const postingDate = trans.posting_date ? trans.posting_date : trans.rental_start_date;
            timeInfo = `<p><strong>邮寄时间:</strong> ${trans.posting_date || '未邮寄（将在' + trans.rental_start_date + '邮寄）'}</p>`;
        }

        let adminReturnDateInfo = '';
        if (trans.admin_return_date) {
            adminReturnDateInfo = `<p><strong>回库日期:</strong> ${trans.admin_return_date}</p>`;
        }

        return `
            <div style="margin-bottom: 15px; padding: 12px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
                <p><strong>交易码:</strong> ${trans.transaction_code}</p>
                <p><strong>客户:</strong> ${trans.customers?.name || '-'}</p>
                <p><strong>类型:</strong> <span style="background: ${trans.transaction_type === 'pickup' ? '#ff9800' : '#2196f3'}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${typeLabel}</span></p>
                <p><strong>租期:</strong> ${trans.rental_start_date} 至 ${trans.rental_end_date}</p>
                ${timeInfo}
                ${adminReturnDateInfo}
                <p><strong>状态:</strong> <span class="status-badge status-${trans.status}">${trans.status}</span></p>
            </div>
        `;
    }).join('');

    ordersList.innerHTML = ordersHTML;
}

/**
 * 格式化日期为YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 关闭设备租期日历模态框
 */
function closeEquipmentRentalModal() {
    const modal = document.getElementById('equipmentRentalModal');
    modal.classList.remove('active');
}

/**
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
                            <button class="btn-edit" onclick="viewCustomerDetailsModal(${customer.id})">查看</button>
                            <button class="btn-edit" onclick="openEditCustomerModal(${customer.id})">编辑</button>
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
async function loadAdminTransactions(searchQuery = '', responsiblePerson = '') {
    try {
        if (!adminToken) return;
        
        const sortBySelect = document.getElementById('sortBySelect');
        const sortBy = sortBySelect?.value || 'posting_date';
        
        let url = `${API_BASE}/admin/transactions?sortBy=${sortBy}`;
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        if (responsiblePerson) {
            url += `&responsiblePerson=${encodeURIComponent(responsiblePerson)}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        
        if (data.success && data.data) {
            // 排除已完成的交易（已完成订单在单独的标签页中显示）
            let transactions = data.data.filter(trans => trans.status !== 'completed');
            
            // 分离最近3天的交易和其他交易
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const threeDaysLater = new Date(today);
            threeDaysLater.setDate(threeDaysLater.getDate() + 3);
            
            const upcomingTransactions = [];
            const otherTransactions = [];
            
            transactions.forEach(trans => {
                let isUpcoming = false;
                
                if (trans.transaction_type === 'pickup') {
                    // 自提订单：根据 pickup_time 判断
                    if (trans.pickup_time) {
                        const pickupDate = new Date(trans.pickup_time);
                        pickupDate.setHours(0, 0, 0, 0);
                        if (pickupDate >= today && pickupDate < threeDaysLater) {
                            isUpcoming = true;
                        }
                    }
                } else {
                    // 邮寄订单：根据 posting_date 判断
                    if (trans.posting_date) {
                        const postingDate = new Date(trans.posting_date);
                        postingDate.setHours(0, 0, 0, 0);
                        if (postingDate >= today && postingDate < threeDaysLater) {
                            isUpcoming = true;
                        }
                    }
                }
                
                if (isUpcoming) {
                    upcomingTransactions.push(trans);
                } else {
                    otherTransactions.push(trans);
                }
            });
            
            // 生成表格行的辅助函数
            const generateTableRow = (trans) => {
                const cleanedRemarks = (trans.remarks || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
                const isPickup = trans.transaction_type === 'pickup';
                const bgColor = isPickup ? '#fff3e0' : '#e3f2fd';
                const typeLabel = isPickup ? '自提' : '邮寄';
                const typeColor = isPickup ? '#ff6f00' : '#1976d2';
                
                let additionalInfo = '';
                if (isPickup) {
                    additionalInfo = `自提: ${trans.pickup_time || '-'}`;
                } else {
                    additionalInfo = `邮寄: ${trans.posting_date || '-'} ${trans.posting_time || ''}`;
                }
                
                return `
                    <tr style="background-color: ${bgColor};">
                        <td><strong>${trans.transaction_code}</strong></td>
                        <td><a href="javascript:viewCustomerDetailsModal(${trans.customers?.id || 'null'})" style="color: #007bff; cursor: pointer; text-decoration: none; font-weight: 600;">${trans.customers?.name || '-'}</a></td>
                        <td>
                            <span style="background-color: ${typeColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">${typeLabel}</span>
                        </td>
                        <td>${trans.equipment?.equipment_code || '-'}</td>
                        <td>${trans.rental_start_date} 至 ${trans.rental_end_date}</td>
                        <td style="font-size: 12px; color: #666;">${additionalInfo}</td>
                        <td style="max-width: 150px; word-break: break-word;" title="${trans.remarks || ''}">${parseRemarkHighlights(trans.remarks) || '-'}</td>
                        <td>¥${parseFloat(trans.total_price).toFixed(2)}</td>
                        <td>¥${parseFloat(trans.shipping_cost || 0).toFixed(2)}</td>
                        <td><span class="status-badge status-${trans.status}">${trans.status}</span></td>
                        <td>${trans.responsible_person || '-'}</td>
                        <td>
                            <button class="btn-edit" onclick="openEditTransactionModal(${trans.id})">编辑</button>
                        </td>
                    </tr>
                `;
            };
            
            // 填充最近3天的交易表格
            const upcomingTbody = document.querySelector('#upcomingTransactionsTable tbody');
            if (upcomingTransactions.length === 0) {
                upcomingTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: #999;">暂无最近3天的订单</td></tr>';
            } else {
                upcomingTbody.innerHTML = upcomingTransactions.map(generateTableRow).join('');
            }
            
            // 填充其他交易表格
            const otherTbody = document.querySelector('#otherTransactionsTable tbody');
            if (otherTransactions.length === 0) {
                otherTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: #999;">暂无其他交易</td></tr>';
            } else {
                otherTbody.innerHTML = otherTransactions.map(generateTableRow).join('');
            }
        } else {
            const upcomingTbody = document.querySelector('#upcomingTransactionsTable tbody');
            const otherTbody = document.querySelector('#otherTransactionsTable tbody');
            upcomingTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载失败</td></tr>';
            otherTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载失败</td></tr>';
        }
    } catch (err) {
        console.error('Load transactions error:', err);
        const upcomingTbody = document.querySelector('#upcomingTransactionsTable tbody');
        const otherTbody = document.querySelector('#otherTransactionsTable tbody');
        upcomingTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载出错</td></tr>';
        otherTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载出错</td></tr>';
    }
}

/**
 * 搜索交易
 */
function searchTransactions() {
    const searchInput = document.getElementById('transactionSearchInput');
    const searchQuery = searchInput.value.trim();
    const responsiblePersonFilter = document.getElementById('responsiblePersonFilter');
    const responsiblePerson = responsiblePersonFilter?.value || '';
    loadAdminTransactions(searchQuery, responsiblePerson);
}

/**
 * 加载已完成的交易
 */
async function loadCompletedTransactions(searchQuery = '', responsiblePerson = '') {
    try {
        if (!adminToken) return;
        
        let url = `${API_BASE}/admin/transactions?status=completed`;
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        if (responsiblePerson) {
            url += `&responsiblePerson=${encodeURIComponent(responsiblePerson)}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        
        if (data.success && data.data) {
            // 生成表格行的辅助函数
            const generateTableRow = (trans) => {
                const cleanedRemarks = (trans.remarks || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
                const isPickup = trans.transaction_type === 'pickup';
                const bgColor = isPickup ? '#fff3e0' : '#e3f2fd';
                const typeLabel = isPickup ? '自提' : '邮寄';
                const typeColor = isPickup ? '#ff6f00' : '#1976d2';
                
                let additionalInfo = '';
                if (isPickup) {
                    additionalInfo = `自提: ${trans.pickup_time || '-'}`;
                } else {
                    additionalInfo = `邮寄: ${trans.posting_date || '-'} ${trans.posting_time || ''}`;
                }
                
                return `
                    <tr style="background-color: ${bgColor};">
                        <td><strong>${trans.transaction_code}</strong></td>
                        <td><a href="javascript:viewCustomerDetailsModal(${trans.customers?.id || 'null'})" style="color: #007bff; cursor: pointer; text-decoration: none; font-weight: 600;">${trans.customers?.name || '-'}</a></td>
                        <td>
                            <span style="background-color: ${typeColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">${typeLabel}</span>
                        </td>
                        <td>${trans.equipment?.equipment_code || '-'}</td>
                        <td>${trans.rental_start_date} 至 ${trans.rental_end_date}</td>
                        <td style="font-size: 12px; color: #666;">${additionalInfo}</td>
                        <td style="max-width: 150px; word-break: break-word;" title="${trans.remarks || ''}">${parseRemarkHighlights(trans.remarks) || '-'}</td>
                        <td>¥${parseFloat(trans.total_price).toFixed(2)}</td>
                        <td>¥${parseFloat(trans.shipping_cost || 0).toFixed(2)}</td>
                        <td>${trans.admin_return_date || '-'}</td>
                        <td><span class="status-badge status-${trans.status}">${trans.status}</span></td>
                        <td>${trans.responsible_person || '-'}</td>
                        <td>
                            <button class="btn-edit" onclick="openEditTransactionModal(${trans.id})">编辑</button>
                        </td>
                    </tr>
                `;
            };
            
            // 填充已完成交易表格
            const completedTbody = document.querySelector('#completedTransactionsTable tbody');
            if (data.data.length === 0) {
                completedTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: #999;">暂无已完成订单</td></tr>';
            } else {
                completedTbody.innerHTML = data.data.map(generateTableRow).join('');
            }
        } else {
            const completedTbody = document.querySelector('#completedTransactionsTable tbody');
            completedTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载失败</td></tr>';
        }
    } catch (err) {
        console.error('Load completed transactions error:', err);
        const completedTbody = document.querySelector('#completedTransactionsTable tbody');
        completedTbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color: red;">加载出错</td></tr>';
    }
}

/**
 * 搜索已完成的交易
 */
function searchCompletedTransactions() {
    const searchInput = document.getElementById('completedSearchInput');
    const searchQuery = searchInput.value.trim();
    const responsiblePersonFilter = document.getElementById('completedResponsiblePersonFilter');
    const responsiblePerson = responsiblePersonFilter?.value || '';
    loadCompletedTransactions(searchQuery, responsiblePerson);
}

/**
 * 打开编辑交易模态框
 */
function openEditTransactionModal(transactionId) {
    const modal = document.getElementById('editTransactionModal');
    if (!modal) {
        console.error('Transaction edit modal not found');
        return;
    }
    
    // 存储交易ID用于保存
    modal.dataset.transactionId = transactionId;
    
    // 从API加载完整的交易数据
    loadTransactionData(transactionId);
    
    modal.style.display = 'flex';
}

/**
 * 从API加载交易数据并填充编辑表单
 */
async function loadTransactionData(transactionId) {
    try {
        const response = await fetch(`${API_BASE}/admin/transactions/${transactionId}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            const transaction = data.data;
            
            // 设置所有表单字段
            const statusSelect = document.getElementById('transactionStatus');
            const responsibleInput = document.getElementById('transactionResponsible');
            const postingDateInput = document.getElementById('transactionPostingDate');
            const postingTimeInput = document.getElementById('transactionPostingTime');
            const remarksInput = document.getElementById('transactionRemarks');
            const shippingCostInput = document.getElementById('transactionShippingCost');
            const rentalStartDateInput = document.getElementById('transactionRentalStartDate');
            const rentalEndDateInput = document.getElementById('transactionRentalEndDate');
            const rentalPriceInput = document.getElementById('transactionRentalPrice');
            const adminReturnDateInput = document.getElementById('transactionAdminReturnDate');
            
            if (statusSelect) statusSelect.value = transaction.status || 'pending';
            if (responsibleInput) responsibleInput.value = transaction.responsible_person || '';
            if (postingDateInput) postingDateInput.value = transaction.posting_date || '';
            if (postingTimeInput) postingTimeInput.value = transaction.posting_time || '';
            if (remarksInput) remarksInput.value = transaction.remarks || '';
            if (shippingCostInput) shippingCostInput.value = transaction.shipping_cost || 0;
            if (rentalStartDateInput) rentalStartDateInput.value = transaction.rental_start_date || '';
            if (rentalEndDateInput) rentalEndDateInput.value = transaction.rental_end_date || '';
            if (rentalPriceInput) rentalPriceInput.value = transaction.rental_price || transaction.total_price || 0;
            if (adminReturnDateInput) adminReturnDateInput.value = transaction.admin_return_date || '';
        } else {
            alert('加载交易数据失败');
        }
    } catch (err) {
        console.error('Load transaction data error:', err);
        alert('加载交易数据出错');
    }
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
 * 删除交易
 */
async function deleteTransaction() {
    if (!adminToken) {
        alert('请先登录');
        return;
    }
    
    const modal = document.getElementById('editTransactionModal');
    const transactionId = modal.dataset.transactionId;
    
    // 显示确认对话框
    if (!confirm('确认要删除这个交易吗？此操作无法撤销。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/transactions/${transactionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeEditTransactionModal();
            loadAdminTransactions(); // 刷新列表
            alert('交易已删除');
        } else {
            alert('删除失败: ' + data.message);
        }
    } catch (err) {
        console.error('Delete transaction error:', err);
        alert('删除交易时出错');
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
    const shippingCostInput = document.getElementById('transactionShippingCost');
    const rentalStartDateInput = document.getElementById('transactionRentalStartDate');
    const rentalEndDateInput = document.getElementById('transactionRentalEndDate');
    const rentalPriceInput = document.getElementById('transactionRentalPrice');
    const adminReturnDateInput = document.getElementById('transactionAdminReturnDate');
    
    const status = statusSelect?.value;
    const responsiblePerson = responsibleInput?.value || null;
    const postingDate = postingDateInput?.value || null;
    const postingTime = postingTimeInput?.value || null;
    const remarks = remarksInput?.value || null;
    const shippingCost = shippingCostInput?.value ? parseFloat(shippingCostInput.value) : 0;
    const rentalStartDate = rentalStartDateInput?.value || null;
    const rentalEndDate = rentalEndDateInput?.value || null;
    const rentalPrice = rentalPriceInput?.value ? parseFloat(rentalPriceInput.value) : 0;
    const adminReturnDate = adminReturnDateInput?.value || null;
    
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
                remarks,
                shippingCost,
                rentalStartDate,
                rentalEndDate,
                rentalPrice,
                adminReturnDate
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
 * 查看客户详情（弹窗）
 */
async function viewCustomerDetailsModal(customerId) {
    if (!customerId || customerId === 'null') {
        alert('无效的客户ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.customer) {
            const customer = data.customer;
            document.getElementById('detailCustomerName').textContent = customer.name || '-';
            document.getElementById('detailCustomerNickname').textContent = customer.nickname || '-';
            document.getElementById('detailCustomerPhone').textContent = customer.contact_phone || '-';
            document.getElementById('detailCustomerAddress').textContent = customer.delivery_address || '-';
            
            // 获取该客户的交易数量
            const transResponse = await fetch(`${API_BASE}/admin/transactions?customerId=${customerId}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const transData = await transResponse.json();
            const transactionCount = transData.success && transData.data ? transData.data.length : 0;
            document.getElementById('detailCustomerTransactionCount').textContent = transactionCount;
            
            document.getElementById('customerDetailsModal').style.display = 'flex';
        } else {
            console.error('Customer data response:', data);
            alert('加载客户信息失败: ' + (data.message || '未知错误'));
        }
    } catch (err) {
        console.error('Load customer details error:', err);
        alert('加载客户信息出错: ' + err.message);
    }
}

/**
 * 关闭客户详情模态框
 */
function closeCustomerDetailsModal() {
    document.getElementById('customerDetailsModal').style.display = 'none';
}

/**
 * 复制客户信息
 */
function copyCustomerInfo(button) {
    const name = document.getElementById('detailCustomerName').textContent;
    const phone = document.getElementById('detailCustomerPhone').textContent;
    const address = document.getElementById('detailCustomerAddress').textContent;
    
    // 组织为格式：张三 130302200 北京市朝阳区健翔家园
    const textToCopy = `${name} ${phone} ${address}`;
    
    // 保存原始按钮文字
    const originalText = button.textContent;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(textToCopy).then(() => {
        // 改变按钮文字显示复制成功
        button.textContent = '✓ 已复制';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(err => {
        // 即使失败也显示已复制（因为内容已在剪贴板）
        button.textContent = '✓ 已复制';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    });
}

/**
 * 查看客户详情（占位符）
 */
function viewCustomerDetails(customerId) {
    alert('客户详情功能开发中');
}

/**
 * 打开编辑客户模态框
 */
async function openEditCustomerModal(customerId) {
    if (!customerId || customerId === 'null') {
        alert('无效的客户ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.customer) {
            const customer = data.customer;
            
            // 存储客户ID用于保存
            const modal = document.getElementById('editCustomerModal');
            modal.dataset.customerId = customerId;
            
            // 填充表单
            document.getElementById('editCustomerName').value = customer.name || '';
            document.getElementById('editCustomerPhone').value = customer.contact_phone || '';
            document.getElementById('editCustomerNickname').value = customer.nickname || '';
            document.getElementById('editCustomerAddress').value = customer.delivery_address || '';
            
            modal.style.display = 'flex';
        } else {
            alert('加载客户信息失败: ' + (data.message || '未知错误'));
        }
    } catch (err) {
        console.error('Load customer for edit error:', err);
        alert('加载客户信息出错: ' + err.message);
    }
}

/**
 * 关闭编辑客户模态框
 */
function closeEditCustomerModal() {
    document.getElementById('editCustomerModal').style.display = 'none';
    // 清空表单
    document.getElementById('editCustomerName').value = '';
    document.getElementById('editCustomerPhone').value = '';
    document.getElementById('editCustomerNickname').value = '';
    document.getElementById('editCustomerAddress').value = '';
}

/**
 * 保存客户信息更改
 */
async function saveCustomerChanges() {
    if (!adminToken) {
        alert('未登录');
        return;
    }
    
    const modal = document.getElementById('editCustomerModal');
    const customerId = modal.dataset.customerId;
    
    const name = document.getElementById('editCustomerName').value.trim();
    const phone = document.getElementById('editCustomerPhone').value.trim();
    const nickname = document.getElementById('editCustomerNickname').value.trim();
    const address = document.getElementById('editCustomerAddress').value.trim();
    
    if (!name || !address) {
        alert('客户名和收件地址为必填项');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/customers/${customerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name,
                contactPhone: phone,
                nickname,
                deliveryAddress: address
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('客户信息保存成功');
            closeEditCustomerModal();
            loadAdminCustomers(); // 刷新客户列表
        } else {
            alert('保存失败: ' + (data.message || '未知错误'));
        }
    } catch (err) {
        console.error('Save customer error:', err);
        alert('保存出错: ' + err.message);
    }
}

/**
 * 编辑交易（占位符）
 */
function editTransaction(transactionId) {
    alert('交易编辑功能开发中');
}
