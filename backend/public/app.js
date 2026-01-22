// MQTT Dashboard Pro - Frontend Application
const API_BASE = window.location.origin;
let token = localStorage.getItem('mqtt_token');
let ws = null;
let activityChart = null;
let sensorChart = null;
let liveMessages = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showMainApp();
    } else {
        showLoginPage();
    }
});

// Authentication
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    initApp();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('mqtt_token', token);
            showMainApp();
        } else {
            document.getElementById('loginError').style.display = 'block';
            document.getElementById('loginError').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('loginError').textContent = 'Connection error';
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('mqtt_token');
    token = null;
    if (ws) ws.close();
    showLoginPage();
});

// Initialize Main App
function initApp() {
    initWebSocket();
    initNavigation();
    loadStats();
    loadDevices();
    loadKeys();
    loadTopics();
    initActivityChart();
    
    // Refresh stats every 30 seconds
    setInterval(loadStats, 30000);
}

// WebSocket Connection
function initWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('wsStatus').classList.add('connected');
        document.getElementById('wsStatusText').textContent = 'Connected';
    };

    ws.onclose = () => {
        document.getElementById('wsStatus').classList.remove('connected');
        document.getElementById('wsStatusText').textContent = 'Disconnected';
        setTimeout(initWebSocket, 3000);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
    };
}

function handleWSMessage(data) {
    switch (data.type) {
        case 'message':
            addLiveMessage(data);
            break;
        case 'device_connected':
            showToast(`Device connected: ${data.clientId}`, 'success');
            loadStats();
            loadDevices();
            break;
        case 'device_disconnected':
            showToast(`Device disconnected: ${data.clientId}`, 'warning');
            loadStats();
            loadDevices();
            break;
    }
}

function addLiveMessage(msg) {
    liveMessages.unshift(msg);
    if (liveMessages.length > 20) liveMessages.pop();
    
    const feed = document.getElementById('liveFeed');
    feed.innerHTML = liveMessages.map(m => `
        <div class="message-item">
            <div class="topic">${m.topic}</div>
            <div class="payload">${m.payload}</div>
            <div class="meta">${m.clientId} • ${new Date(m.timestamp).toLocaleTimeString()}</div>
        </div>
    `).join('');
}

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            
            document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;
            
            // Load section data
            if (section === 'messages') loadMessages();
            if (section === 'logs') loadLogs();
            if (section === 'charts') loadChartTopics();
        });
    });
}

// API Helper
async function api(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('mqtt_token');
        showLoginPage();
        throw new Error('Session expired');
    }

    return response.json();
}

// Stats
async function loadStats() {
    try {
        const stats = await api('/api/stats');
        document.getElementById('statDevices').textContent = stats.totalDevices;
        document.getElementById('statOnline').textContent = stats.connectedClients || stats.onlineDevices;
        document.getElementById('statKeys').textContent = stats.activeKeys;
        document.getElementById('statMessages').textContent = formatNumber(stats.totalMessages);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Devices
async function loadDevices() {
    try {
        const devices = await api('/api/devices');
        const tbody = document.getElementById('devicesTable');
        
        tbody.innerHTML = devices.map(device => `
            <tr>
                <td><strong>${device.name}</strong></td>
                <td><code>${device.client_id || '-'}</code></td>
                <td>${device.type}</td>
                <td>${device.location || '-'}</td>
                <td><span class="status-badge ${device.status}">${device.status}</span></td>
                <td>${device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="editDevice('${device.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDevice('${device.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Update device select in key modal
        const keyDevice = document.getElementById('keyDevice');
        keyDevice.innerHTML = '<option value="">None</option>' + 
            devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            
        // Update filter
        const filterDevice = document.getElementById('filterDevice');
        filterDevice.innerHTML = '<option value="">All Devices</option>' + 
            devices.map(d => `<option value="${d.client_id}">${d.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load devices:', error);
    }
}

function showDeviceModal(device = null) {
    document.getElementById('deviceId').value = device?.id || '';
    document.getElementById('deviceName').value = device?.name || '';
    document.getElementById('deviceClientId').value = device?.client_id || '';
    document.getElementById('deviceType').value = device?.type || 'esp32';
    document.getElementById('deviceLocation').value = device?.location || '';
    document.getElementById('deviceDescription').value = device?.description || '';
    
    new bootstrap.Modal(document.getElementById('deviceModal')).show();
}

async function editDevice(id) {
    const device = await api(`/api/devices/${id}`);
    showDeviceModal(device);
}

document.getElementById('deviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('deviceId').value;
    const data = {
        name: document.getElementById('deviceName').value,
        client_id: document.getElementById('deviceClientId').value,
        type: document.getElementById('deviceType').value,
        location: document.getElementById('deviceLocation').value,
        description: document.getElementById('deviceDescription').value
    };

    try {
        if (id) {
            await api(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await api('/api/devices', { method: 'POST', body: JSON.stringify(data) });
        }
        bootstrap.Modal.getInstance(document.getElementById('deviceModal')).hide();
        loadDevices();
        loadStats();
        showToast('Device saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save device', 'error');
    }
});

async function deleteDevice(id) {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
        await api(`/api/devices/${id}`, { method: 'DELETE' });
        loadDevices();
        loadStats();
        showToast('Device deleted', 'success');
    } catch (error) {
        showToast('Failed to delete device', 'error');
    }
}

// API Keys
async function loadKeys() {
    try {
        const keys = await api('/api/keys');
        const tbody = document.getElementById('keysTable');
        
        tbody.innerHTML = keys.map(key => `
            <tr>
                <td><strong>${key.name}</strong></td>
                <td><code>${maskKey(key.key)}</code></td>
                <td>${key.device_name || '-'}</td>
                <td>
                    <span class="status-badge ${key.is_active ? 'online' : 'offline'}">
                        ${key.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${key.last_used ? new Date(key.last_used).toLocaleString() : 'Never'}</td>
                <td>
                    <button class="btn btn-sm btn-${key.is_active ? 'warning' : 'success'} me-1" 
                            onclick="toggleKey('${key.id}')">
                        <i class="bi bi-${key.is_active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteKey('${key.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

function maskKey(key) {
    if (!key) return '-';
    return key.substring(0, 10) + '...' + key.substring(key.length - 4);
}

function showKeyModal() {
    document.getElementById('keyName').value = '';
    document.getElementById('keyDevice').value = '';
    document.getElementById('keyExpires').value = '';
    new bootstrap.Modal(document.getElementById('keyModal')).show();
}

document.getElementById('keyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('keyName').value,
        device_id: document.getElementById('keyDevice').value || null,
        expires_at: document.getElementById('keyExpires').value || null
    };

    try {
        const result = await api('/api/keys', { method: 'POST', body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('keyModal')).hide();
        
        document.getElementById('newKeyValue').textContent = result.key;
        new bootstrap.Modal(document.getElementById('newKeyModal')).show();
        
        loadKeys();
        loadStats();
    } catch (error) {
        showToast('Failed to generate key', 'error');
    }
});

async function toggleKey(id) {
    try {
        await api(`/api/keys/${id}/toggle`, { method: 'PATCH' });
        loadKeys();
    } catch (error) {
        showToast('Failed to toggle key status', 'error');
    }
}

async function deleteKey(id) {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    try {
        await api(`/api/keys/${id}`, { method: 'DELETE' });
        loadKeys();
        loadStats();
        showToast('API key deleted', 'success');
    } catch (error) {
        showToast('Failed to delete API key', 'error');
    }
}

function copyKey() {
    const key = document.getElementById('newKeyValue').textContent;
    navigator.clipboard.writeText(key);
    showToast('Key copied to clipboard', 'success');
}

// Messages
async function loadMessages() {
    try {
        const topic = document.getElementById('filterTopic').value;
        const device = document.getElementById('filterDevice').value;
        const limit = document.getElementById('filterLimit').value;
        
        let url = `/api/data?limit=${limit}`;
        if (topic) url += `&topic=${encodeURIComponent(topic)}`;
        if (device) url += `&device_id=${encodeURIComponent(device)}`;
        
        const messages = await api(url);
        const container = document.getElementById('messageHistory');
        
        container.innerHTML = messages.map(msg => `
            <div class="message-item">
                <div class="topic">${msg.topic}</div>
                <div class="payload">${msg.payload}</div>
                <div class="meta">${msg.device_id || 'Unknown'} • ${new Date(msg.created_at).toLocaleString()}</div>
            </div>
        `).join('') || '<p class="text-muted text-center">No messages found</p>';
        
        // Update topic filter
        const topics = [...new Set(messages.map(m => m.topic))];
        const filterTopic = document.getElementById('filterTopic');
        filterTopic.innerHTML = '<option value="">All Topics</option>' + 
            topics.map(t => `<option value="${t}">${t}</option>`).join('');
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

// Topics
async function loadTopics() {
    try {
        const topics = await api('/api/topics');
        const tbody = document.getElementById('topicsTable');
        
        tbody.innerHTML = topics.map(topic => `
            <tr>
                <td><code>${topic.name}</code></td>
                <td>${topic.description || '-'}</td>
                <td>${topic.data_type}</td>
                <td>${topic.unit || '-'}</td>
                <td>${topic.min_value !== null ? `${topic.min_value} - ${topic.max_value}` : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteTopic('${topic.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" class="text-center">No topics configured</td></tr>';
    } catch (error) {
        console.error('Failed to load topics:', error);
    }
}

function showTopicModal() {
    document.getElementById('topicName').value = '';
    document.getElementById('topicDescription').value = '';
    document.getElementById('topicDataType').value = 'number';
    document.getElementById('topicUnit').value = '';
    document.getElementById('topicMin').value = '';
    document.getElementById('topicMax').value = '';
    new bootstrap.Modal(document.getElementById('topicModal')).show();
}

document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('topicName').value,
        description: document.getElementById('topicDescription').value,
        data_type: document.getElementById('topicDataType').value,
        unit: document.getElementById('topicUnit').value,
        min_value: document.getElementById('topicMin').value ? parseFloat(document.getElementById('topicMin').value) : null,
        max_value: document.getElementById('topicMax').value ? parseFloat(document.getElementById('topicMax').value) : null
    };

    try {
        await api('/api/topics', { method: 'POST', body: JSON.stringify(data) });
        bootstrap.Modal.getInstance(document.getElementById('topicModal')).hide();
        loadTopics();
        showToast('Topic added successfully', 'success');
    } catch (error) {
        showToast('Failed to add topic', 'error');
    }
});

async function deleteTopic(id) {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    
    try {
        await api(`/api/topics/${id}`, { method: 'DELETE' });
        loadTopics();
        showToast('Topic deleted', 'success');
    } catch (error) {
        showToast('Failed to delete topic', 'error');
    }
}

// Publish
document.getElementById('publishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        topic: document.getElementById('pubTopic').value,
        message: document.getElementById('pubMessage').value,
        qos: parseInt(document.getElementById('pubQos').value),
        retain: document.getElementById('pubRetain').value === 'true'
    };

    try {
        await api('/api/publish', { method: 'POST', body: JSON.stringify(data) });
        showToast('Message published successfully', 'success');
    } catch (error) {
        showToast('Failed to publish message', 'error');
    }
});

// Charts
function initActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Messages',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

async function loadChartTopics() {
    try {
        const topics = await api('/api/data/topics');
        const select = document.getElementById('chartTopic');
        select.innerHTML = '<option value="">Select Topic</option>' + 
            topics.map(t => `<option value="${t}">${t}</option>`).join('');
    } catch (error) {
        console.error('Failed to load chart topics:', error);
    }
}

async function loadChartData() {
    const topic = document.getElementById('chartTopic').value;
    const hours = document.getElementById('chartPeriod').value;
    
    if (!topic) {
        showToast('Please select a topic', 'warning');
        return;
    }

    try {
        const data = await api(`/api/data/chart?topic=${encodeURIComponent(topic)}&hours=${hours}`);
        
        if (sensorChart) sensorChart.destroy();
        
        const ctx = document.getElementById('sensorChart').getContext('2d');
        sensorChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.hour).toLocaleString()),
                datasets: [
                    {
                        label: 'Average',
                        data: data.map(d => d.avg_value),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Min',
                        data: data.map(d => d.min_value),
                        borderColor: '#38ef7d',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Max',
                        data: data.map(d => d.max_value),
                        borderColor: '#f45c43',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    } catch (error) {
        showToast('Failed to load chart data', 'error');
    }
}

// Connection Logs
async function loadLogs() {
    try {
        const logs = await api('/api/data/logs');
        const tbody = document.getElementById('logsTable');
        
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${new Date(log.created_at).toLocaleString()}</td>
                <td><code>${log.client_id}</code></td>
                <td>${log.device_name || '-'}</td>
                <td>
                    <span class="status-badge ${log.event === 'connected' ? 'online' : 'offline'}">
                        ${log.event}
                    </span>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-center">No logs found</td></tr>';
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

// Utilities
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'} position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 250px;';
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'} me-2"></i>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Filter listeners
document.getElementById('filterTopic')?.addEventListener('change', loadMessages);
document.getElementById('filterDevice')?.addEventListener('change', loadMessages);
document.getElementById('filterLimit')?.addEventListener('change', loadMessages);
