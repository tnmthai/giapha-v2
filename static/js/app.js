// ==================== State ====================
let currentUser = null;
let families = [];
let currentFamily = null;
let chartInstance = null;
let editTreeInstance = null;

// ==================== API helpers ====================
async function api(url, opts = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ==================== Auth ====================
function showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
}

async function checkAuth() {
    try {
        currentUser = await api('/api/me');
        showApp();
        loadFamilies();
    } catch {
        showAuth();
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const displayName = document.getElementById('reg-displayname').value.trim();
    if (!username || !password) return toast('Nhập đầy đủ thông tin', 'error');
    try {
        await api('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, display_name: displayName }),
        });
        toast('Đăng ký thành công!', 'success');
        checkAuth();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) return toast('Nhập đầy đủ thông tin', 'error');
    try {
        await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        toast('Đăng nhập thành công!', 'success');
        checkAuth();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function logout() {
    await api('/api/logout', { method: 'POST' });
    currentUser = null;
    showAuth();
}

function toggleAuthForm(form) {
    document.getElementById('login-form').style.display = form === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = form === 'register' ? 'block' : 'none';
}

// ==================== Families ====================
async function loadFamilies() {
    try {
        families = await api('/api/families');
        renderFamilyList();
    } catch (e) {
        toast('Lỗi tải danh sách gia phả', 'error');
    }
}

function renderFamilyList() {
    const container = document.getElementById('family-list');
    if (families.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🌳</div>
                <h3>Chưa có gia phả nào</h3>
                <p>Tạo gia phả đầu tiên để bắt đầu xây dựng cây gia đình</p>
                <button class="btn btn-primary" onclick="showCreateFamilyModal()" style="width:auto">+ Tạo gia phả mới</button>
            </div>`;
        return;
    }
    container.innerHTML = families.map(f => `
        <div class="family-card" onclick="openFamily(${f.id})">
            <h4>📖 ${esc(f.name)}</h4>
            <p>${esc(f.description || 'Không có mô tả')}</p>
            <div class="member-count">${f.member_count || 0} thành viên</div>
        </div>
    `).join('');
}

function showCreateFamilyModal() {
    document.getElementById('modal-create-family').classList.add('active');
    document.getElementById('family-name-input').value = '';
    document.getElementById('family-desc-input').value = '';
}

function closeCreateFamilyModal() {
    document.getElementById('modal-create-family').classList.remove('active');
}

async function createFamily() {
    const name = document.getElementById('family-name-input').value.trim();
    const desc = document.getElementById('family-desc-input').value.trim();
    if (!name) return toast('Nhập tên gia phả', 'error');
    try {
        await api('/api/families', {
            method: 'POST',
            body: JSON.stringify({ name, description: desc }),
        });
        closeCreateFamilyModal();
        toast('Tạo gia phả thành công!', 'success');
        loadFamilies();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Family Tree ====================
async function openFamily(familyId) {
    document.getElementById('family-list-view').style.display = 'none';
    document.getElementById('family-tree-view').style.display = 'flex';
    document.getElementById('tree-content').innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';

    try {
        const data = await api(`/api/families/${familyId}/members`);
        currentFamily = data.family;
        document.getElementById('tree-title').textContent = `📖 ${data.family.name}`;

        if (data.members.length === 0) {
            document.getElementById('tree-content').innerHTML = `
                <div class="empty-state">
                    <div class="icon">👥</div>
                    <h3>Chưa có thành viên nào</h3>
                    <p>Thêm thành viên hoặc nạp dữ liệu mẫu</p>
                    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                        <button class="btn btn-primary" onclick="seedFamily(${familyId})" style="width:auto">🌱 Nạp dữ liệu mẫu</button>
                    </div>
                </div>`;
            return;
        }

        renderTree(data.members);
    } catch (e) {
        toast('Lỗi tải cây gia đình: ' + e.message, 'error');
    }
}

function renderTree(members) {
    const container = document.getElementById('tree-content');
    container.innerHTML = '<div id="FamilyChart" class="f3" style="width:100%;height:100%;background-color:#0a0a0a;color:#fff;"></div>';

    const chartEl = document.getElementById('FamilyChart');

    try {
        const f3Chart = f3.createChart('#FamilyChart', members);

        f3Chart.setCardHtml()
            .setCardDisplay([['name'], ['birth_date', 'death_date']])
            .setMiniTree(true)
            .setOnHoverPathToAncestors(true)
            .setOnHoverPathToDescendants(true);

        editTreeInstance = f3Chart.editTree()
            .setFields([
                { id: 'name', type: 'text', label: 'Họ và tên' },
                { id: 'gender', type: 'select', label: 'Giới tính', options: [{ value: 'M', label: 'Nam' }, { value: 'F', label: 'Nữ' }] },
                { id: 'birth_date', type: 'text', label: 'Năm sinh' },
                { id: 'death_date', type: 'text', label: 'Năm mất' },
                { id: 'birth_place', type: 'text', label: 'Nơi sinh' },
                { id: 'occupation', type: 'text', label: 'Nghề nghiệp' },
                { id: 'bio', type: 'text', label: 'Tiểu sử' },
            ])
            .setAddRelLabels({
                father: 'Thêm cha',
                mother: 'Thêm mẹ',
                spouse: 'Thêm vợ/chồng',
                son: 'Thêm con trai',
                daughter: 'Thêm con gái',
            })
            .setOnSubmit(async (e, datum, applyChanges, postSubmit) => {
                try {
                    const formData = new FormData(e.target);
                    const data = {};
                    formData.forEach((v, k) => { data[k] = v; });

                    if (datum.id && !datum._new) {
                        // Update existing member
                        await api(`/api/members/${datum.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                full_name: data.name || datum.data.name,
                                gender: data.gender || datum.data.gender,
                                birth_date: data.birth_date || datum.data.birth_date,
                                death_date: data.death_date || datum.data.death_date,
                                birth_place: data.birth_place || datum.data.birth_place,
                                occupation: data.occupation || datum.data.occupation,
                                bio: data.bio || datum.data.bio,
                            }),
                        });
                        toast('Đã cập nhật thành viên', 'success');
                    } else {
                        // New member
                        const res = await api(`/api/families/${currentFamily.id}/members`, {
                            method: 'POST',
                            body: JSON.stringify({
                                full_name: data.name || 'Thành viên mới',
                                gender: data.gender || 'M',
                                birth_date: data.birth_date || '',
                                death_date: data.death_date || '',
                                birth_place: data.birth_place || '',
                                occupation: data.occupation || '',
                                bio: data.bio || '',
                            }),
                        });
                        datum.id = String(res.id);
                        toast('Đã thêm thành viên mới', 'success');
                    }

                    // Handle relationships from editTree
                    if (datum.rels) {
                        // Sync relationships to backend
                        await syncRelationships(datum);
                    }

                    applyChanges();
                    postSubmit();
                } catch (err) {
                    toast('Lỗi lưu: ' + err.message, 'error');
                    postSubmit();
                }
            })
            .setOnDelete(async (datum, deletePerson, postSubmit) => {
                if (!confirm(`Xóa thành viên "${datum.data.name}"?`)) {
                    postSubmit();
                    return;
                }
                try {
                    await api(`/api/members/${datum.id}`, { method: 'DELETE' });
                    deletePerson();
                    toast('Đã xóa thành viên', 'success');
                } catch (err) {
                    toast('Lỗi xóa: ' + err.message, 'error');
                    postSubmit();
                }
            });

        f3Chart.updateTree({ initial: true });
        chartInstance = f3Chart;
    } catch (e) {
        console.error('Chart error:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Lỗi hiển thị</h3><p>${esc(e.message)}</p></div>`;
    }
}

async function syncRelationships(datum) {
    if (!datum.rels) return;
    const memberId = datum.id;

    // Get existing relationships
    const familyData = await api(`/api/families/${currentFamily.id}/members`);
    const existingMember = familyData.members.find(m => m.id === String(memberId));
    if (!existingMember) return;

    const existingRels = existingMember.rels;
    const newSpouses = new Set(datum.rels.spouses || []);
    const newChildren = new Set(datum.rels.children || []);
    const newParents = new Set(datum.rels.parents || []);

    // Add missing relationships
    for (const sp of newSpouses) {
        if (!(existingRels.spouses || []).includes(sp)) {
            try {
                await api(`/api/members/${memberId}/relationships`, {
                    method: 'POST',
                    body: JSON.stringify({ to_member_id: parseInt(sp), relationship_type: 'spouse' }),
                });
            } catch (e) { console.warn('sync spouse err:', e); }
        }
    }
    for (const ch of newChildren) {
        if (!(existingRels.children || []).includes(ch)) {
            try {
                await api(`/api/members/${memberId}/relationships`, {
                    method: 'POST',
                    body: JSON.stringify({ to_member_id: parseInt(ch), relationship_type: 'child' }),
                });
            } catch (e) { console.warn('sync child err:', e); }
        }
    }
    for (const p of newParents) {
        if (!(existingRels.parents || []).includes(p)) {
            try {
                await api(`/api/members/${memberId}/relationships`, {
                    method: 'POST',
                    body: JSON.stringify({ to_member_id: parseInt(p), relationship_type: 'parent' }),
                });
            } catch (e) { console.warn('sync parent err:', e); }
        }
    }
}

async function seedFamily(familyId) {
    if (!confirm('Nạp dữ liệu mẫu? Dữ liệu hiện tại sẽ bị xóa.')) return;
    try {
        const res = await api(`/api/families/${familyId}/seed`, { method: 'POST' });
        toast(`Đã nạp ${res.members_created} thành viên, ${res.relationships_created} mối quan hệ`, 'success');
        openFamily(familyId);
    } catch (e) {
        toast(e.message, 'error');
    }
}

function goBackToList() {
    document.getElementById('family-list-view').style.display = 'block';
    document.getElementById('family-tree-view').style.display = 'none';
    loadFamilies();
}

// ==================== Utils ====================
function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Set user display name
    const observer = new MutationObserver(() => {
        if (currentUser) {
            document.getElementById('user-display').textContent = currentUser.display_name || currentUser.username;
        }
    });
    observer.observe(document.getElementById('app-screen'), { attributes: true });

    // Enter key handlers
    document.getElementById('login-password').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
    document.getElementById('reg-password').addEventListener('keypress', e => { if (e.key === 'Enter') register(); });
    document.getElementById('family-name-input').addEventListener('keypress', e => { if (e.key === 'Enter') createFamily(); });
});
