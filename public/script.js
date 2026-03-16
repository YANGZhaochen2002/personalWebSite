const API_BASE = '/api';
let adminToken = localStorage.getItem('adminToken');
let currentTab = 'customer';
let selectedEquipment = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadEquipment();
    loadFilters();

    // 如果已登录管理员，显示管理员界面
    if (adminToken) {
        showAdminDashboard();
    }

    // 表单提交
    document.getElementById('rentalForm').addEventListener('submit', handleRentalSubmit);
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('adminRegisterForm').addEventListener('submit', handleAdminRegister);
    document.getElementById('equipmentFormSubmit').addEventListener('submit', handleAddEquipment);

    // 日期变化事件
    document.getElementById('rentalStartDate').addEventListener('change', updateTotalPrice);
    document.getElementById('rentalEndDate').addEventListener('change', updateTotalPrice);
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
        const minPrice = document.getElementById('minPriceFilter')?.value;
        const maxPrice = document.getElementById('maxPriceFilter')?.value;

        if (brand) params.append('brand', brand);
        if (category) params.append('category', category);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);

        const response = await fetch(`${API_BASE}/customer/equipment?${params}`);
        const data = await response.json();

        if (data.success) {
            displayEquipment(data.data);
        } else {
            showError('equipmentList', '加载设备失败');
        }
    } catch (err) {
        console.error('Load equipment error:', err);
        showError('equipmentList', '加载设备出错');
    }
}

/**
 * 显示设备列表
 */
function displayEquipment(equipment) {
    const container = document.getElementById('equipmentList');
    
    if (!equipment || equipment.length === 0) {
        container.innerHTML = '<p class="loading">暂无可租设备</p>';
        return;
    }

    container.innerHTML = equipment.map(item => `
        <div class="equipment-card ${selectedEquipment?.id === item.id ? 'selected' : ''}" onclick="selectEquipment(${item.id}, '${item.model}', ${item.daily_rental_price})">
            <h4>${item.brand} - ${item.model}</h4>
            <p><strong>种类:</strong> ${item.category}</p>
            <p><strong>设备码:</strong> ${item.equipment_code}</p>
            <p><strong>赔损价格:</strong> ¥${item.damage_price.toFixed(2)}</p>
            <div class="price">日租金: ¥${item.daily_rental_price.toFixed(2)}</div>
            <button class="btn-select" type="button">选择租赁</button>
        </div>
    `).join('');
}

/**
 * 加载筛选选项
 */
async function loadFilters() {
    try {
        const response = await fetch(`${API_BASE}/customer/equipment/filters`);
        const data = await response.json();

        if (data.success) {
            // 填充品牌
            const brandSelect = document.getElementById('brandFilter');
            data.brands.forEach(brand => {
                const option = document.createElement('option');
                option.value = brand;
                option.textContent = brand;
                brandSelect.appendChild(option);
            });

            // 填充种类
            const categorySelect = document.getElementById('categoryFilter');
            data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Load filters error:', err);
    }
}

/**
 * 应用筛选器
 */
function applyFilters() {
    loadEquipment();
}

/**
 * 选择设备
 */
function selectEquipment(id, model, dailyPrice) {
    selectedEquipment = { id, model, dailyPrice };
    
    // 更新显示
    document.getElementById('selectedEquipmentInfo').innerHTML = `
        <div style="background: white; padding: 15px; border-left: 4px solid #667eea; border-radius: 5px;">
            <p><strong>已选择设备：</strong> ${model}</p>
            <p><strong>日租金：</strong> ¥${dailyPrice.toFixed(2)}</p>
        </div>
    `;

    // 重新加载列表以显示选中状态
    loadEquipment();
    
    // 更新总价格
    updateTotalPrice();
}

/**
 * 更新总租金
 */
function updateTotalPrice() {
    if (!selectedEquipment) {
        document.getElementById('totalPriceInfo').textContent = '总租金: ¥0.00';
        return;
    }

    const startDate = new Date(document.getElementById('rentalStartDate').value);
    const endDate = new Date(document.getElementById('rentalEndDate').value);

    if (startDate >= endDate || !document.getElementById('rentalStartDate').value) {
        document.getElementById('totalPriceInfo').textContent = '总租金: ¥0.00';
        return;
    }

    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const totalPrice = selectedEquipment.dailyPrice * days;
    document.getElementById('totalPriceInfo').textContent = `总租金: ¥${totalPrice.toFixed(2)} (${days}天)`;
}

/**
 * 提交租赁订单
 */
async function handleRentalSubmit(e) {
    e.preventDefault();

    if (!selectedEquipment) {
        alert('请先选择要租赁的设备');
        return;
    }

    const rentalData = {
        name: document.getElementById('customerName').value,
        contactPhone: document.getElementById('customerPhone').value || null,
        nickname: document.getElementById('customerNickname').value || null,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        equipmentId: selectedEquipment.id,
        rentalStartDate: document.getElementById('rentalStartDate').value,
        rentalEndDate: document.getElementById('rentalEndDate').value
    };

    try {
        const response = await fetch(`${API_BASE}/customer/rental`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rentalData)
        });

        const data = await response.json();

        if (data.success) {
            // 显示成功模态框
            document.getElementById('transactionCodeDisplay').textContent = data.transactionCode;
            document.getElementById('successModal').style.display = 'flex';

            // 重置表单
            document.getElementById('rentalForm').reset();
            selectedEquipment = null;
            document.getElementById('selectedEquipmentInfo').innerHTML = '请先选择设备';
            document.getElementById('totalPriceInfo').textContent = '总租金: ¥0.00';
            loadEquipment();
        } else {
            alert('提交失败: ' + data.message);
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
            loadAdminData();
        } else {
            showError('adminLoginError', data.message || '登录失败');
        }
    } catch (err) {
        console.error('Admin login error:', err);
        showError('adminLoginError', '登录出错');
    }
}

/**
 * 管理员注册
 */
async function handleAdminRegister(e) {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // 验证
    if (password !== confirmPassword) {
        showError('adminRegisterError', '两次输入的密码不一致');
        return;
    }

    if (password.length < 6) {
        showError('adminRegisterError', '密码至少需要6个字符');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            alert('注册成功！请使用新账户登录');
            // 切换到登录表单
            toggleAdminAuth('login');
            // 清空注册表单
            document.getElementById('adminRegisterForm').reset();
            // 自动填充用户名
            document.getElementById('adminUsername').value = username;
        } else {
            showError('adminRegisterError', data.message || '注册失败');
        }
    } catch (err) {
        console.error('Admin register error:', err);
        showError('adminRegisterError', '注册出错，请重试');
    }
}

/**
 * 切换登录/注册表单
 */
function toggleAdminAuth(mode) {
    const forms = document.querySelectorAll('.auth-form');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    forms.forEach(form => form.classList.remove('active'));
    toggleBtns.forEach(btn => btn.classList.remove('active'));

    if (mode === 'login') {
        document.getElementById('adminLoginForm').classList.add('active');
        toggleBtns[0].classList.add('active');
    } else if (mode === 'register') {
        document.getElementById('adminRegisterForm').classList.add('active');
        toggleBtns[1].classList.add('active');
    }
}

/**
 * 显示管理员仪表板
 */
function showAdminDashboard() {
    document.getElementById('adminLoginPanel').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
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
            document.getElementById('stat-revenue').textContent = `¥${data.stats.totalRevenue}`;
        }
    } catch (err) {
        console.error('Load stats error:', err);
    }

    // 加载设备列表
    loadAdminEquipment();
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

    if (tab === 'customers') loadAdminCustomers();
    if (tab === 'transactions') loadAdminTransactions();
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
async function loadAdminCustomers() {
    try {
        const response = await fetch(`${API_BASE}/admin/customers`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        if (data.success) {
            const tbody = document.querySelector('#customersTable tbody');
            tbody.innerHTML = data.data.map(customer => `
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
        }
    } catch (err) {
        console.error('Load customers error:', err);
    }
}

/**
 * 加载交易信息
 */
async function loadAdminTransactions() {
    try {
        const response = await fetch(`${API_BASE}/admin/transactions`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        const data = await response.json();
        if (data.success) {
            const tbody = document.querySelector('#transactionsTable tbody');
            tbody.innerHTML = data.data.map(trans => `
                <tr>
                    <td>${trans.transaction_code}</td>
                    <td>${trans.customers.name}</td>
                    <td>${trans.equipment.model}</td>
                    <td>${trans.rental_start_date} 至 ${trans.rental_end_date}</td>
                    <td>¥${parseFloat(trans.total_price).toFixed(2)}</td>
                    <td>${trans.status}</td>
                    <td>${trans.responsible_person || '-'}</td>
                    <td>
                        <button class="btn-edit" onclick="editTransaction(${trans.id})">编辑</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Load transactions error:', err);
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
