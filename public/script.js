// API base URL
const API_BASE = '/api';
let currentToken = localStorage.getItem('token');

// DOM elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const forms = document.querySelectorAll('.form');
const userPanel = document.getElementById('userPanel');
const formContainer = document.querySelector('.form-container');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabLinks();
    setupFormHandlers();
    setupLogout();
    
    // Check if already logged in
    if (currentToken) {
        loadUserPanel();
    }
});

// Tab switching
function setupTabLinks() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update visible form
            forms.forEach(form => form.classList.remove('active'));
            document.getElementById(tabName + 'Form').classList.add('active');
        });
    });
}

// Form handlers
function setupFormHandlers() {
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '登录失败');
        }
        
        // Save token
        currentToken = data.token;
        localStorage.setItem('token', currentToken);
        
        // Show success and load panel
        showMessage(errorDiv, data.message, 'success');
        setTimeout(() => loadUserPanel(), 500);
    } catch (err) {
        showMessage(errorDiv, err.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerPassword2').value;
    const errorDiv = document.getElementById('registerError');
    
    // Validate
    if (password !== confirmPassword) {
        return showMessage(errorDiv, '两次输入的密码不一致');
    }
    
    if (username.length < 3) {
        return showMessage(errorDiv, '用户名至少3个字符');
    }
    
    if (password.length < 6) {
        return showMessage(errorDiv, '密码至少6个字符');
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '注册失败');
        }
        
        // Clear form and show success
        registerForm.reset();
        showMessage(errorDiv, '注册成功！请登录', 'success');
        
        // Switch to login tab
        setTimeout(() => {
            document.querySelector('[data-tab="login"]').click();
        }, 1000);
    } catch (err) {
        showMessage(errorDiv, err.message);
    }
}

async function loadUserPanel() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取用户信息失败');
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Hide forms, show panel
        if (formContainer) {
            formContainer.style.display = 'none';
        }
        userPanel.style.display = 'block';
        
        // Update panel info
        document.getElementById('userId').textContent = user.id;
        document.getElementById('displayUsername').textContent = user.username;
        document.getElementById('createdAt').textContent = new Date(user.created_at).toLocaleString('zh-CN');
    } catch (err) {
        console.error('Failed to load user panel:', err);
        logout();
    }
}

function setupLogout() {
    logoutBtn.addEventListener('click', logout);
}

function logout() {
    localStorage.removeItem('token');
    currentToken = null;
    
    // Reset forms
    loginForm.reset();
    registerForm.reset();
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
    
    // Show forms again
    if (formContainer) {
        formContainer.style.display = 'block';
    }
    userPanel.style.display = 'none';
    
    // Reset to login tab
    document.querySelector('[data-tab="login"]').click();
}

function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.classList.add('show');
    
    if (type === 'success') {
        element.style.color = '#28a745';
    } else {
        element.style.color = '#dc3545';
    }
    
    // Auto hide after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.classList.remove('show');
            element.textContent = '';
        }, 5000);
    }
}
