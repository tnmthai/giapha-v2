// ==================== State ====================
let currentUser = null;
let families = [];
let currentFamily = null;
let chartInstance = null;
let editTreeInstance = null;
let allMembers = []; // Cache for connect mode
let searchTimer = null;

// Connect mode state (Feature 9)
let connectMode = false;
let connectFirst = null; // {id, name}

// Member detail state (Feature 8)
let currentDetailMemberId = null;

// Photo upload state (Feature 1)
let photoUploadMemberId = null;

// ==================== API helpers ====================
async function api(url, opts = {}) {
    const headers = {};
    if (opts.body && typeof opts.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { headers, ...opts });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

async function apiUpload(url, formData) {
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Upload failed');
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

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

// ==================== Modal helpers ====================
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
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
        document.getElementById('user-display').textContent = currentUser.display_name || currentUser.username;
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
            <div class="family-card-header">
                <h4>📖 ${esc(f.name)}</h4>
                ${!f.owned ? '<span class="badge badge-shared">Được chia sẻ</span>' : ''}
            </div>
            <p>${esc(f.description || 'Không có mô tả')}</p>
            <div class="member-count">${f.member_count || 0} thành viên</div>
        </div>
    `).join('');
}

function showCreateFamilyModal() {
    document.getElementById('family-name-input').value = '';
    document.getElementById('family-desc-input').value = '';
    openModal('modal-create-family');
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
        closeModal('modal-create-family');
        toast('Tạo gia phả thành công!', 'success');
        loadFamilies();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Feature 6: Delete Family ====================
function confirmDeleteFamily() {
    if (!currentFamily) return;
    if (!confirm(`Xóa gia phả "${currentFamily.name}"?\n\nTất cả thành viên và quan hệ sẽ bị xóa vĩnh viễn.`)) return;
    deleteFamily();
}

async function deleteFamily() {
    try {
        await api(`/api/families/${currentFamily.id}`, { method: 'DELETE' });
        toast('Đã xóa gia phả', 'success');
        goBackToList();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Feature 7: Edit Family ====================
function showEditFamilyModal() {
    if (!currentFamily) return;
    document.getElementById('edit-family-name').value = currentFamily.name || '';
    document.getElementById('edit-family-desc').value = '';
    // Fetch current description
    const f = families.find(f => f.id === currentFamily.id);
    if (f) document.getElementById('edit-family-desc').value = f.description || '';
    openModal('modal-edit-family');
}

async function updateFamily() {
    const name = document.getElementById('edit-family-name').value.trim();
    const desc = document.getElementById('edit-family-desc').value.trim();
    if (!name) return toast('Nhập tên gia phả', 'error');
    try {
        const res = await api(`/api/families/${currentFamily.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description: desc }),
        });
        currentFamily.name = res.name;
        document.getElementById('tree-title').textContent = `📖 ${res.name}`;
        closeModal('modal-edit-family');
        toast('Đã cập nhật gia phả', 'success');
        loadFamilies();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Feature 5: Share ====================
function showShareModal() {
    if (!currentFamily) return;
    document.getElementById('share-username').value = '';
    openModal('modal-share');
    loadShareList();
}

async function loadShareList() {
    try {
        // Get family members data which includes share info via family endpoint
        const data = await api(`/api/families/${currentFamily.id}/members`);
        // We need to get share info from somewhere - let's use a dedicated approach
        // For now, show shared users from the family data
        const familyData = await api(`/api/families`);
        const fam = familyData.find(f => f.id === currentFamily.id);
        // The list endpoint doesn't return shared_with, so we'll fetch from members endpoint
        // which returns family info. We need a better approach - let's add shared info to the members endpoint
        document.getElementById('share-list').innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Nhập username và chọn quyền để chia sẻ.</p>';
    } catch (e) {
        console.warn('load share list:', e);
    }
}

async function shareFamily() {
    const username = document.getElementById('share-username').value.trim();
    const permission = document.getElementById('share-permission').value;
    if (!username) return toast('Nhập tên người dùng', 'error');
    try {
        await api(`/api/families/${currentFamily.id}/share`, {
            method: 'POST',
            body: JSON.stringify({ username, permission }),
        });
        toast(`Đã chia sẻ cho ${username} (${permission === 'edit' ? 'chỉnh sửa' : 'chỉ xem'})`, 'success');
        document.getElementById('share-username').value = '';
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Family Tree ====================
async function openFamily(familyId) {
    document.getElementById('family-list-view').style.display = 'none';
    document.getElementById('family-tree-view').style.display = 'flex';
    document.getElementById('tree-content').innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải...</div>';

    // Reset connect mode
    connectMode = false;
    connectFirst = null;
    document.getElementById('connect-status').style.display = 'none';
    document.getElementById('btn-connect-mode').classList.remove('btn-active');

    try {
        const data = await api(`/api/families/${familyId}/members`);
        currentFamily = data.family;
        allMembers = data.members;
        document.getElementById('tree-title').textContent = `📖 ${data.family.name}`;

        // Show/hide edit buttons based on ownership
        const canEdit = data.family.owned;
        document.getElementById('btn-share').style.display = canEdit ? '' : 'none';
        document.getElementById('btn-delete-family').style.display = canEdit ? '' : 'none';
        document.getElementById('btn-edit-member-detail').style.display = canEdit ? '' : 'none';

        if (data.members.length === 0) {
            document.getElementById('tree-content').innerHTML = `
                <div class="empty-state">
                    <div class="icon">👥</div>
                    <h3>Chưa có thành viên nào</h3>
                    <p>Thêm thành viên đầu tiên để bắt đầu</p>
                    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                        <button class="btn btn-primary" onclick="showAddMemberModal()" style="width:auto">👤 Thêm thành viên</button>
                        <button class="btn btn-secondary" onclick="seedFamily(${familyId})" style="width:auto">🌱 Nạp dữ liệu mẫu</button>
                    </div>
                </div>`;
            return;
        }

        renderTree(data.members);
    } catch (e) {
        toast('Lỗi tải cây gia đình: ' + e.message, 'error');
    }
}

// ==================== Feature 4: Badge colors ====================
function getRelBadge(relType) {
    const badges = {
        'spouse': null, // Default, no badge needed
        'ex_spouse': { label: 'Vợ/Chồng cũ', color: '#ff4d4f', bg: 'rgba(255,77,79,0.15)' },
        'stepchild': { label: 'Con riêng', color: '#faad14', bg: 'rgba(250,173,20,0.15)' },
        'step_parent': { label: 'Cha/Mẹ kế', color: '#faad14', bg: 'rgba(250,173,20,0.15)' },
        'adopted_child': { label: 'Con nuôi', color: '#4a9eff', bg: 'rgba(74,158,255,0.15)' },
        'adoptive_parent': { label: 'Cha/Mẹ nuôi', color: '#4a9eff', bg: 'rgba(74,158,255,0.15)' },
        'child': null,
        'parent': null,
    };
    return badges[relType] || null;
}

function buildBadgesHtml(datum) {
    const relTypes = datum.rel_types || {};
    const badges = new Set();
    for (const [id, type] of Object.entries(relTypes)) {
        const badge = getRelBadge(type);
        if (badge) badges.add(JSON.stringify(badge));
    }
    if (badges.size === 0) return '';
    return Array.from(badges).map(b => {
        const { label, color, bg } = JSON.parse(b);
        return `<span class="rel-badge" style="color:${color};background:${bg}">${label}</span>`;
    }).join('');
}

function renderTree(members) {
    const container = document.getElementById('tree-content');
    container.innerHTML = '<div id="FamilyChart" class="f3" style="width:100%;height:100%;background-color:#0a0a0a;color:#fff;"></div>';

    const chartEl = document.getElementById('FamilyChart');

    try {
        const f3Chart = f3.createChart('#FamilyChart', members)
            .setTransitionTime(200)
            .setCardXSpacing(250)
            .setCardYSpacing(150);

        const card = f3Chart.setCardHtml()
            .setCardDisplay([['name'], ['birth_date', 'death_date']])
            .setMiniTree(true)
            .setOnHoverPathToMain()
            .setHtml((d) => {
                const datum = d.data || d;
                const photo = datum.data?.photo || '';
                const name = datum.data?.name || 'Thành viên';
                const birthDate = datum.data?.birth_date || '';
                const deathDate = datum.data?.death_date || '';
                const gender = datum.data?.gender || 'M';
                const isAlive = datum.data?.is_alive;
                const badgesHtml = buildBadgesHtml(datum);

                let photoHtml = '';
                if (photo) {
                    photoHtml = `<div class="card-photo"><img src="${esc(photo)}" alt="" onerror="this.style.display='none'"></div>`;
                } else {
                    photoHtml = `<div class="card-photo card-photo-placeholder">${gender === 'F' ? '👩' : '👨'}</div>`;
                }

                let dateStr = '';
                if (birthDate) {
                    dateStr = birthDate;
                    if (!isAlive && deathDate) dateStr += ' - ' + deathDate;
                    else if (!isAlive) dateStr += ' ✝';
                }

                return `
                    <div class="custom-card ${gender === 'F' ? 'card-female' : 'card-male'}" data-member-id="${datum.id}">
                        ${photoHtml}
                        <div class="card-info">
                            <div class="card-name">${esc(name)}</div>
                            ${dateStr ? `<div class="card-dates">${esc(dateStr)}</div>` : ''}
                            ${badgesHtml ? `<div class="card-badges">${badgesHtml}</div>` : ''}
                        </div>
                        <div class="card-actions">
                            <button class="card-btn" onclick="event.stopPropagation();showMemberDetail(${datum.id})" title="Chi tiết">ℹ️</button>
                            <button class="card-btn" onclick="event.stopPropagation();showPhotoUpload(${datum.id})" title="Ảnh">📷</button>
                        </div>
                    </div>
                `;
            });

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

                    if (datum.rels) {
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

        // Feature 9: Add click handlers for connect mode
        setTimeout(() => {
            document.querySelectorAll('.custom-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (!connectMode) return;
                    e.stopPropagation();
                    const memberId = card.dataset.memberId;
                    const member = allMembers.find(m => m.id === memberId);
                    if (!member) return;
                    handleConnectClick(memberId, member.data.name);
                });
            });
        }, 500);

    } catch (e) {
        console.error('Chart error:', e);
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Lỗi hiển thị</h3><p>${esc(e.message)}</p></div>`;
    }
}

async function syncRelationships(datum) {
    if (!datum.rels) return;
    const memberId = datum.id;
    const familyData = await api(`/api/families/${currentFamily.id}/members`);
    const existingMember = familyData.members.find(m => m.id === String(memberId));
    if (!existingMember) return;

    const existingRels = existingMember.rels;
    const newSpouses = new Set(datum.rels.spouses || []);
    const newChildren = new Set(datum.rels.children || []);
    const newParents = new Set(datum.rels.parents || []);

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

// ==================== Add Member Modal ====================
function showAddMemberModal() {
    document.getElementById('member-name-input').value = '';
    document.getElementById('member-gender-input').value = 'M';
    document.getElementById('member-birth-input').value = '';
    document.getElementById('member-death-input').value = '';
    document.getElementById('member-birthplace-input').value = '';
    document.getElementById('member-occupation-input').value = '';
    openModal('modal-add-member');
}

async function addFirstMember() {
    const name = document.getElementById('member-name-input').value.trim();
    if (!name) return toast('Nhập họ tên', 'error');

    try {
        await api(`/api/families/${currentFamily.id}/members`, {
            method: 'POST',
            body: JSON.stringify({
                full_name: name,
                gender: document.getElementById('member-gender-input').value,
                birth_date: document.getElementById('member-birth-input').value.trim(),
                death_date: document.getElementById('member-death-input').value.trim(),
                birth_place: document.getElementById('member-birthplace-input').value.trim(),
                occupation: document.getElementById('member-occupation-input').value.trim(),
            }),
        });
        closeModal('modal-add-member');
        toast('Đã thêm thành viên!', 'success');
        openFamily(currentFamily.id);
    } catch (e) {
        toast(e.message, 'error');
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
    // Reset connect mode
    connectMode = false;
    connectFirst = null;
    document.getElementById('connect-status').style.display = 'none';
    loadFamilies();
}

// ==================== Feature 1: Photo Upload ====================
function showPhotoUpload(memberId) {
    photoUploadMemberId = memberId;
    document.getElementById('photo-file-input').value = '';
    document.getElementById('photo-preview').innerHTML = '';
    openModal('modal-photo-upload');

    // Preview on file select
    document.getElementById('photo-file-input').onchange = function() {
        const file = this.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast('File quá lớn (tối đa 5MB)', 'error');
            this.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photo-preview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    };
}

async function uploadPhoto() {
    const fileInput = document.getElementById('photo-file-input');
    const file = fileInput.files[0];
    if (!file) return toast('Chọn ảnh', 'error');

    const formData = new FormData();
    formData.append('photo', file);

    try {
        await apiUpload(`/api/members/${photoUploadMemberId}/photo`, formData);
        closeModal('modal-photo-upload');
        toast('Đã upload ảnh!', 'success');
        // Refresh tree
        openFamily(currentFamily.id);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Feature 8: Member Detail ====================
async function showMemberDetail(memberId) {
    try {
        const member = await api(`/api/members/${memberId}`);
        currentDetailMemberId = memberId;

        const relLabels = {
            'spouse': 'Vợ/Chồng', 'ex_spouse': 'Vợ/Chồng cũ',
            'parent': 'Cha/Mẹ', 'step_parent': 'Cha/Mẹ kế', 'adoptive_parent': 'Cha/Mẹ nuôi',
            'child': 'Con', 'stepchild': 'Con riêng', 'adopted_child': 'Con nuôi',
        };

        let relsHtml = '';
        if (member.parents.length > 0) {
            relsHtml += '<div class="detail-section"><h4>👨‍👩‍👦 Cha/Mẹ</h4><ul>';
            for (const p of member.parents) {
                const badge = getRelBadge(p.type);
                const badgeHtml = badge ? ` <span class="rel-badge" style="color:${badge.color};background:${badge.bg}">${badge.label}</span>` : '';
                relsHtml += `<li onclick="showMemberDetail(${p.id});closeModal('modal-member-detail')" class="clickable">${esc(p.name)}${badgeHtml}</li>`;
            }
            relsHtml += '</ul></div>';
        }
        if (member.spouses.length > 0) {
            relsHtml += '<div class="detail-section"><h4>💑 Vợ/Chồng</h4><ul>';
            for (const s of member.spouses) {
                const badge = getRelBadge(s.type);
                const badgeHtml = badge ? ` <span class="rel-badge" style="color:${badge.color};background:${badge.bg}">${badge.label}</span>` : '';
                relsHtml += `<li onclick="showMemberDetail(${s.id});closeModal('modal-member-detail')" class="clickable">${esc(s.name)}${badgeHtml}</li>`;
            }
            relsHtml += '</ul></div>';
        }
        if (member.children.length > 0) {
            relsHtml += '<div class="detail-section"><h4>👶 Con</h4><ul>';
            for (const c of member.children) {
                const badge = getRelBadge(c.type);
                const badgeHtml = badge ? ` <span class="rel-badge" style="color:${badge.color};background:${badge.bg}">${badge.label}</span>` : '';
                relsHtml += `<li onclick="showMemberDetail(${c.id});closeModal('modal-member-detail')" class="clickable">${esc(c.name)}${badgeHtml}</li>`;
            }
            relsHtml += '</ul></div>';
        }

        let photoHtml = '';
        if (member.photo) {
            photoHtml = `<div class="detail-photo"><img src="${esc(member.photo)}" alt="${esc(member.full_name)}" onerror="this.style.display='none'"></div>`;
        }

        const genderLabel = member.gender === 'M' ? 'Nam' : 'Nữ';
        const statusLabel = member.is_alive ? '🟢 Còn sống' : '✝ Đã mất';

        document.getElementById('member-detail-content').innerHTML = `
            <div class="detail-header">
                ${photoHtml}
                <div class="detail-title">
                    <h3>${esc(member.full_name)}</h3>
                    <span class="detail-gender">${genderLabel}</span>
                    <span class="detail-status">${statusLabel}</span>
                </div>
            </div>
            <div class="detail-info">
                ${member.birth_date ? `<div class="detail-row"><span class="detail-label">Năm sinh:</span> ${esc(member.birth_date)}</div>` : ''}
                ${member.death_date ? `<div class="detail-row"><span class="detail-label">Năm mất:</span> ${esc(member.death_date)}</div>` : ''}
                ${member.birth_place ? `<div class="detail-row"><span class="detail-label">Nơi sinh:</span> ${esc(member.birth_place)}</div>` : ''}
                ${member.occupation ? `<div class="detail-row"><span class="detail-label">Nghề nghiệp:</span> ${esc(member.occupation)}</div>` : ''}
                ${member.bio ? `<div class="detail-row"><span class="detail-label">Tiểu sử:</span> ${esc(member.bio)}</div>` : ''}
            </div>
            ${relsHtml || '<p style="color:var(--text-secondary);margin-top:16px">Chưa có quan hệ nào</p>'}
        `;

        openModal('modal-member-detail');
    } catch (e) {
        toast('Lỗi tải thông tin: ' + e.message, 'error');
    }
}

function editFromDetail() {
    if (!currentDetailMemberId) return;
    closeModal('modal-member-detail');
    // Trigger the family-chart edit form
    // Find the card and trigger edit
    const card = document.querySelector(`[data-member-id="${currentDetailMemberId}"]`);
    if (card) {
        card.click();
    } else {
        toast('Click vào thẻ thành viên trên cây để sửa', 'info');
    }
}

// ==================== Feature 2: Search ====================
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(searchMembers, 300);
}

async function searchMembers() {
    const q = document.getElementById('search-input').value.trim();
    const resultsEl = document.getElementById('search-results');

    if (!q) {
        resultsEl.style.display = 'none';
        // Remove highlights
        document.querySelectorAll('.custom-card.search-match').forEach(c => c.classList.remove('search-match'));
        return;
    }

    try {
        const results = await api(`/api/families/${currentFamily.id}/members/search?q=${encodeURIComponent(q)}`);
        if (results.length === 0) {
            resultsEl.innerHTML = '<div class="search-result-item">Không tìm thấy</div>';
        } else {
            resultsEl.innerHTML = results.map(m => `
                <div class="search-result-item" onclick="highlightMember(${m.id})">
                    ${esc(m.full_name)}
                    <span class="search-meta">${esc(m.birth_date || '')} ${esc(m.occupation || '')}</span>
                </div>
            `).join('');
        }
        resultsEl.style.display = 'block';

        // Highlight matching cards on tree
        document.querySelectorAll('.custom-card').forEach(c => c.classList.remove('search-match'));
        for (const m of results) {
            const card = document.querySelector(`[data-member-id="${m.id}"]`);
            if (card) card.classList.add('search-match');
        }
    } catch (e) {
        console.warn('search error:', e);
    }
}

function highlightMember(memberId) {
    document.getElementById('search-results').style.display = 'none';
    const card = document.querySelector(`[data-member-id="${memberId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('search-highlight');
        setTimeout(() => card.classList.remove('search-highlight'), 2000);
    }
}

// ==================== Feature 3: Export ====================
function exportFamily() {
    if (!currentFamily) return;
    window.open(`/api/families/${currentFamily.id}/export`, '_blank');
    toast('Đang xuất file...', 'info');
}

// ==================== Feature 9: Connect Mode ====================
function toggleConnectMode() {
    connectMode = !connectMode;
    connectFirst = null;
    const btn = document.getElementById('btn-connect-mode');
    const status = document.getElementById('connect-status');

    if (connectMode) {
        btn.classList.add('btn-active');
        status.style.display = 'flex';
        status.querySelector('span').textContent = '🔗 Chế độ kết nối: Click người thứ nhất...';
        document.querySelectorAll('.custom-card').forEach(c => c.classList.add('connectable'));
        toast('Bật chế độ kết nối. Click vào 2 người để kết nối.', 'info');
    } else {
        btn.classList.remove('btn-active');
        status.style.display = 'none';
        document.querySelectorAll('.custom-card').forEach(c => {
            c.classList.remove('connectable');
            c.classList.remove('connect-selected');
        });
    }
}

function handleConnectClick(memberId, memberName) {
    if (!connectMode) return;

    if (!connectFirst) {
        // First selection
        connectFirst = { id: memberId, name: memberName };
        document.querySelectorAll('.custom-card').forEach(c => c.classList.remove('connect-selected'));
        const card = document.querySelector(`[data-member-id="${memberId}"]`);
        if (card) card.classList.add('connect-selected');
        document.getElementById('connect-status').querySelector('span').textContent =
            `🔗 Đã chọn: ${memberName} → Click người thứ hai...`;
    } else if (connectFirst.id === memberId) {
        // Clicked same person, deselect
        connectFirst = null;
        document.querySelectorAll('.custom-card').forEach(c => c.classList.remove('connect-selected'));
        document.getElementById('connect-status').querySelector('span').textContent =
            '🔗 Chế độ kết nối: Click người thứ nhất...';
    } else {
        // Second selection - show relationship picker
        document.getElementById('connect-desc').textContent =
            `Kết nối "${connectFirst.name}" → "${memberName}" với quan hệ:`;
        openModal('modal-connect');

        // Store for use in createConnection
        window._connectFrom = connectFirst.id;
        window._connectTo = memberId;

        // Reset visual
        document.querySelectorAll('.custom-card').forEach(c => c.classList.remove('connect-selected'));
        connectFirst = null;
        document.getElementById('connect-status').querySelector('span').textContent =
            '🔗 Chế độ kết nối: Click người thứ nhất...';
    }
}

async function createConnection(relType) {
    const fromId = window._connectFrom;
    const toId = window._connectTo;
    if (!fromId || !toId) return;

    const relLabels = {
        'spouse': 'vợ/chồng', 'parent': 'cha/mẹ', 'child': 'con',
        'step_parent': 'cha/mẹ kế', 'stepchild': 'con riêng',
        'adoptive_parent': 'cha/mẹ nuôi', 'adopted_child': 'con nuôi',
    };

    try {
        await api(`/api/members/${fromId}/relationships`, {
            method: 'POST',
            body: JSON.stringify({ to_member_id: parseInt(toId), relationship_type: relType }),
        });
        closeModal('modal-connect');
        toast(`Đã tạo quan hệ: ${relLabels[relType] || relType}`, 'success');
        openFamily(currentFamily.id);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Enter key handlers
    document.getElementById('login-password').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
    document.getElementById('reg-password').addEventListener('keypress', e => { if (e.key === 'Enter') register(); });
    document.getElementById('family-name-input').addEventListener('keypress', e => { if (e.key === 'Enter') createFamily(); });

    // Close search results on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            document.getElementById('search-results').style.display = 'none';
        }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
});
