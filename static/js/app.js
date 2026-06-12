// ==================== State ====================
let currentUser = null;
let families = [];
let currentFamily = null;
let allMembers = [];
let searchTimer = null;

// JointJS instances
let graph = null;
let paper = null;
let paperScroller = null;

// Connect mode state
let connectMode = false;
let connectFirst = null;

// Member edit state
let editingMemberId = null;

// Photo upload state
let photoUploadMemberId = null;

// Current detail member
let currentDetailMemberId = null;

// Element → member ID mapping
let elementMemberMap = {};

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

// ==================== Delete Family ====================
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

// ==================== Edit Family ====================
function showEditFamilyModal() {
    if (!currentFamily) return;
    document.getElementById('edit-family-name').value = currentFamily.name || '';
    document.getElementById('edit-family-desc').value = '';
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

// ==================== Share ====================
function showShareModal() {
    if (!currentFamily) return;
    document.getElementById('share-username').value = '';
    openModal('modal-share');
    loadShareList();
}

async function loadShareList() {
    try {
        const familyData = await api(`/api/families`);
        const fam = familyData.find(f => f.id === currentFamily.id);
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

// ==================== Badge colors ====================
function getRelBadge(relType) {
    const badges = {
        'spouse': null,
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

// ==================== JointJS Custom Shape ====================
function defineCustomShapes() {
    joint.shapes.family = {};

    joint.shapes.family.Member = joint.shapes.standard.Rectangle.define('family.Member', {
        attrs: {
            body: {
                rx: 10, ry: 10,
                fill: '#1a1a1a',
                stroke: '#4a9eff',
                strokeWidth: 2,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            },
            label: {
                fill: '#ffffff',
                fontSize: 14,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                refX: '50%',
                refY: 55,
                textAnchor: 'middle',
                yAlignment: 'middle',
            }
        }
    }, {
        markup: [{
            tagName: 'rect',
            selector: 'body'
        }, {
            tagName: 'image',
            selector: 'photo'
        }, {
            tagName: 'text',
            selector: 'label'
        }, {
            tagName: 'text',
            selector: 'dates'
        }, {
            tagName: 'text',
            selector: 'badges'
        }, {
            tagName: 'text',
            selector: 'photoIcon'
        }]
    });
}

// ==================== Family Tree Rendering ====================
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

function renderTree(members) {
    const container = document.getElementById('tree-content');
    container.innerHTML = '<div id="jointjs-canvas" style="width:100%;height:100%;position:relative;"></div>';

    // Define custom shapes
    defineCustomShapes();

    // Create graph and paper
    graph = new joint.dia.Graph();

    paper = new joint.dia.Paper({
        el: document.getElementById('jointjs-canvas'),
        model: graph,
        width: '100%',
        height: '100%',
        gridSize: 10,
        drawGrid: { name: 'mesh', args: { color: '#1a1a2e' } },
        background: { color: '#0a0a0a' },
        interactive: { elementMove: true },
        linkPinning: false,
        defaultLink: new joint.shapes.standard.Link({
            attrs: {
                line: {
                    stroke: '#4a9eff',
                    strokeWidth: 2,
                    targetMarker: {
                        'type': 'path',
                        'd': 'M 6 -3 0 0 6 3 z',
                        fill: '#4a9eff'
                    }
                }
            }
        }),
        defaultConnectionPoint: { name: 'boundary' },
        snapLinks: { radius: 20 },
    });

    elementMemberMap = {};

    // Build element map for position lookup
    const posMap = {};
    members.forEach(m => {
        posMap[m.id] = { x: m.pos_x || 0, y: m.pos_y || 0, hasPos: !!(m.pos_x || m.pos_y) };
    });

    // Auto-layout: compute positions for members without saved positions
    const positions = computeLayout(members, posMap);

    // Create JointJS elements for each member
    members.forEach((m, idx) => {
        const pos = positions[m.id] || { x: 100 + idx * 250, y: 100 };
        const datum = m.data;
        const gender = datum.gender || 'M';
        const strokeColor = gender === 'F' ? '#ff69b4' : '#4a9eff';
        const bodyFill = gender === 'F' ? '#2a1a2a' : '#1a1a2a';

        // Build date string
        let dateStr = '';
        if (datum.birth_date) {
            dateStr = datum.birth_date;
            if (!datum.is_alive && datum.death_date) dateStr += ' - ' + datum.death_date;
            else if (!datum.is_alive) dateStr += ' ✝';
        }

        // Build badges text
        const relTypes = m.rel_types || {};
        const badgeLabels = [];
        for (const [id, type] of Object.entries(relTypes)) {
            const badge = getRelBadge(type);
            if (badge) badgeLabels.push(badge.label);
        }

        const CARD_W = 200;
        const CARD_H = 120;

        const attrs = {
            body: {
                fill: bodyFill,
                stroke: strokeColor,
                strokeWidth: 2,
                rx: 10,
                ry: 10,
            },
            label: {
                text: datum.name || 'Thành viên',
                fill: '#ffffff',
                fontSize: 14,
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif',
                refX: '50%',
                refY: 60,
                textAnchor: 'middle',
                yAlignment: 'middle',
            },
            dates: {
                text: dateStr,
                fill: '#aaaaaa',
                fontSize: 11,
                fontFamily: 'Arial, sans-serif',
                refX: '50%',
                refY: 78,
                textAnchor: 'middle',
                yAlignment: 'middle',
            },
            badges: {
                text: badgeLabels.join(', '),
                fill: '#4a9eff',
                fontSize: 10,
                fontFamily: 'Arial, sans-serif',
                refX: '50%',
                refY: 95,
                textAnchor: 'middle',
                yAlignment: 'middle',
            },
            photoIcon: {
                text: gender === 'F' ? '👩' : '👨',
                fontSize: 28,
                refX: '50%',
                refY: 28,
                textAnchor: 'middle',
                yAlignment: 'middle',
            }
        };

        // If photo exists, use image instead of icon
        if (datum.photo) {
            attrs.photo = {
                'xlink:href': datum.photo,
                width: 40,
                height: 40,
                x: (CARD_W - 40) / 2,
                y: 8,
                preserveAspectRatio: 'xMidYMid slice',
            };
        }

        const element = new joint.shapes.family.Member({
            position: { x: pos.x, y: pos.y },
            size: { width: CARD_W, height: CARD_H },
            attrs: attrs,
            id: m.id,
        });

        element.addTo(graph);
        elementMemberMap[element.id] = m.id;
    });

    // Create links for relationships
    const linkSet = new Set();
    members.forEach(m => {
        const fromId = m.id;

        // Spouse links (horizontal)
        (m.rels.spouses || []).forEach(toId => {
            const key = [Math.min(fromId, toId), Math.max(fromId, toId)].join('-');
            if (linkSet.has(key)) return;
            linkSet.add(key);

            const fromEl = graph.getCell(fromId);
            const toEl = graph.getCell(toId);
            if (!fromEl || !toEl) return;

            const link = new joint.shapes.standard.Link({
                source: { id: fromId },
                target: { id: toId },
                attrs: {
                    line: {
                        stroke: '#ff69b4',
                        strokeWidth: 2,
                        strokeDasharray: '5 3',
                        targetMarker: null,
                    }
                },
                labels: [{
                    position: 0.5,
                    attrs: {
                        text: {
                            text: '💑',
                            fontSize: 14,
                        },
                        rect: {
                            fill: '#0a0a0a',
                            stroke: '#ff69b4',
                            strokeWidth: 1,
                            rx: 8,
                            ry: 8,
                        }
                    }
                }]
            });
            link.addTo(graph);
        });

        // Parent → child links (vertical)
        (m.rels.children || []).forEach(toId => {
            const key = `${fromId}-${toId}`;
            if (linkSet.has(key)) return;
            linkSet.add(key);

            const fromEl = graph.getCell(fromId);
            const toEl = graph.getCell(toId);
            if (!fromEl || !toEl) return;

            const link = new joint.shapes.standard.Link({
                source: { id: fromId },
                target: { id: toId },
                attrs: {
                    line: {
                        stroke: '#4a9eff',
                        strokeWidth: 2,
                        targetMarker: {
                            'type': 'path',
                            'd': 'M 6 -3 0 0 6 3 z',
                            fill: '#4a9eff'
                        }
                    }
                },
                labels: [{
                    position: 0.5,
                    attrs: {
                        text: {
                            text: '',
                            fontSize: 10,
                        },
                        rect: {
                            fill: 'transparent',
                            stroke: 'none',
                        }
                    }
                }]
            });
            link.addTo(graph);
        });
    });

    // ==================== Event Handlers ====================

    // Click on element → show detail or handle connect mode
    paper.on('element:pointerclick', (elementView) => {
        const element = elementView.model;
        const memberId = elementMemberMap[element.id];
        if (!memberId) return;

        if (connectMode) {
            const member = allMembers.find(m => m.id === memberId);
            if (member) handleConnectClick(memberId, member.data.name);
            return;
        }

        showMemberDetail(memberId);
    });

    // Double-click on element → edit
    paper.on('element:pointerdblclick', (elementView) => {
        const element = elementView.model;
        const memberId = elementMemberMap[element.id];
        if (!memberId) return;
        showEditMemberModal(memberId);
    });

    // Double-click on blank → add new member
    paper.on('blank:pointerdblclick', (evt, x, y) => {
        showAddMemberModal(x, y);
    });

    // Element drag end → save position
    paper.on('element:pointerup', (elementView) => {
        const element = elementView.model;
        const memberId = elementMemberMap[element.id];
        if (!memberId) return;
        const pos = element.position();
        saveMemberPosition(memberId, pos.x, pos.y);
    });

    // Zoom with mouse wheel
    paper.on('blank:mousewheel', (evt, x, y, delta) => {
        evt.preventDefault();
        const currentScale = paper.scale().sx;
        const newScale = Math.max(0.2, Math.min(3, currentScale + delta * 0.1));
        paper.scale(newScale, newScale);
    });

    paper.on('element:mousewheel', (elementView, evt, x, y, delta) => {
        evt.preventDefault();
        const currentScale = paper.scale().sx;
        const newScale = Math.max(0.2, Math.min(3, currentScale + delta * 0.1));
        paper.scale(newScale, newScale);
    });

    // Initial fit to content
    setTimeout(() => zoomFit(), 100);
}

// ==================== Auto Layout ====================
function computeLayout(members, posMap) {
    const positions = {};
    const CARD_W = 200;
    const CARD_H = 120;
    const H_GAP = 60;
    const V_GAP = 80;

    // Check if any members have saved positions
    const anySaved = members.some(m => posMap[m.id] && posMap[m.id].hasPos);
    if (anySaved) {
        // Use saved positions
        members.forEach(m => {
            if (posMap[m.id] && posMap[m.id].hasPos) {
                positions[m.id] = { x: posMap[m.id].x, y: posMap[m.id].y };
            }
        });
    }

    // Find members without positions
    const unpositioned = members.filter(m => !positions[m.id]);
    if (unpositioned.length === 0) return positions;

    // Build parent-child relationships for tree layout
    const childrenMap = {};  // parentId → [childId]
    const parentMap = {};    // childId → [parentId]
    const spouseMap = {};    // memberId → [spouseId]

    members.forEach(m => {
        childrenMap[m.id] = m.rels.children || [];
        spouseMap[m.id] = m.rels.spouses || [];
        (m.rels.children || []).forEach(cid => {
            if (!parentMap[cid]) parentMap[cid] = [];
            parentMap[cid].push(m.id);
        });
    });

    // Find roots (no parents)
    const roots = members.filter(m => {
        const parents = parentMap[m.id] || [];
        return parents.length === 0;
    }).filter(m => !positions[m.id]);

    if (roots.length === 0 && unpositioned.length > 0) {
        // No clear roots, just lay out linearly
        unpositioned.forEach((m, i) => {
            positions[m.id] = { x: 100 + i * (CARD_W + H_GAP), y: 100 };
        });
        return positions;
    }

    // BFS tree layout
    const visited = new Set();
    const generationMap = {};  // memberId → generation number

    // Assign generations
    function assignGen(memberId, gen) {
        if (visited.has(memberId)) return;
        visited.add(memberId);
        generationMap[memberId] = gen;

        // Spouses get same generation
        (spouseMap[memberId] || []).forEach(sid => {
            if (!visited.has(sid)) {
                visited.add(sid);
                generationMap[sid] = gen;
            }
        });

        // Children get gen+1
        (childrenMap[memberId] || []).forEach(cid => {
            assignGen(cid, gen + 1);
        });
    }

    roots.forEach(r => assignGen(r.id, 0));

    // Also assign unvisited members
    unpositioned.forEach(m => {
        if (!visited.has(m.id)) {
            assignGen(m.id, 0);
        }
    });

    // Group by generation
    const generations = {};
    Object.entries(generationMap).forEach(([id, gen]) => {
        if (!generations[gen]) generations[gen] = [];
        generations[gen].push(id);
    });

    // Position each generation
    const genKeys = Object.keys(generations).map(Number).sort((a, b) => a - b);
    let maxX = 0;

    genKeys.forEach(gen => {
        const ids = generations[gen];
        const y = 50 + gen * (CARD_H + V_GAP);
        let x = 50;

        ids.forEach(id => {
            if (positions[id]) {
                x = Math.max(x, positions[id].x + CARD_W + H_GAP);
                return;
            }
            positions[id] = { x, y };
            x += CARD_W + H_GAP;
        });

        maxX = Math.max(maxX, x);
    });

    return positions;
}

// ==================== Save position ====================
async function saveMemberPosition(memberId, x, y) {
    try {
        await api(`/api/members/${memberId}`, {
            method: 'PUT',
            body: JSON.stringify({ pos_x: Math.round(x), pos_y: Math.round(y) }),
        });
    } catch (e) {
        console.warn('Failed to save position:', e);
    }
}

// ==================== Zoom Controls ====================
function zoomIn() {
    if (!paper) return;
    const currentScale = paper.scale().sx;
    const newScale = Math.min(3, currentScale + 0.2);
    paper.scale(newScale, newScale);
}

function zoomOut() {
    if (!paper) return;
    const currentScale = paper.scale().sx;
    const newScale = Math.max(0.2, currentScale - 0.2);
    paper.scale(newScale, newScale);
}

function zoomFit() {
    if (!paper || !graph) return;
    paper.scale(1, 1);
    paper.fitToContent({
        padding: 60,
        allowNewOrigin: 'any',
    });
}

// ==================== Add/Edit Member Modal ====================
let addMemberPosX = null;
let addMemberPosY = null;

function showAddMemberModal(x, y) {
    editingMemberId = null;
    addMemberPosX = x || null;
    addMemberPosY = y || null;
    document.getElementById('member-modal-title').textContent = 'Thêm thành viên';
    document.getElementById('member-name-input').value = '';
    document.getElementById('member-gender-input').value = 'M';
    document.getElementById('member-birth-input').value = '';
    document.getElementById('member-death-input').value = '';
    document.getElementById('member-birthplace-input').value = '';
    document.getElementById('member-occupation-input').value = '';
    document.getElementById('btn-save-member').textContent = 'Thêm';
    document.getElementById('btn-delete-member').style.display = 'none';
    openModal('modal-add-member');
}

function showEditMemberModal(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;
    editingMemberId = memberId;
    addMemberPosX = null;
    addMemberPosY = null;
    const datum = member.data;
    document.getElementById('member-modal-title').textContent = 'Sửa thành viên';
    document.getElementById('member-name-input').value = datum.name || '';
    document.getElementById('member-gender-input').value = datum.gender || 'M';
    document.getElementById('member-birth-input').value = datum.birth_date || '';
    document.getElementById('member-death-input').value = datum.death_date || '';
    document.getElementById('member-birthplace-input').value = datum.birth_place || '';
    document.getElementById('member-occupation-input').value = datum.occupation || '';
    document.getElementById('btn-save-member').textContent = 'Lưu';
    document.getElementById('btn-delete-member').style.display = currentFamily.owned ? '' : 'none';
    openModal('modal-add-member');
}

async function saveMember() {
    const name = document.getElementById('member-name-input').value.trim();
    if (!name) return toast('Nhập họ tên', 'error');

    const data = {
        full_name: name,
        gender: document.getElementById('member-gender-input').value,
        birth_date: document.getElementById('member-birth-input').value.trim(),
        death_date: document.getElementById('member-death-input').value.trim(),
        birth_place: document.getElementById('member-birthplace-input').value.trim(),
        occupation: document.getElementById('member-occupation-input').value.trim(),
    };

    try {
        if (editingMemberId) {
            await api(`/api/members/${editingMemberId}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            toast('Đã cập nhật thành viên', 'success');
        } else {
            if (addMemberPosX !== null) {
                data.pos_x = Math.round(addMemberPosX);
                data.pos_y = Math.round(addMemberPosY);
            }
            await api(`/api/families/${currentFamily.id}/members`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            toast('Đã thêm thành viên!', 'success');
        }
        closeModal('modal-add-member');
        openFamily(currentFamily.id);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteCurrentMember() {
    if (!editingMemberId) return;
    const member = allMembers.find(m => m.id === editingMemberId);
    const name = member ? member.data.name : 'thành viên này';
    if (!confirm(`Xóa "${name}"?`)) return;
    try {
        await api(`/api/members/${editingMemberId}`, { method: 'DELETE' });
        closeModal('modal-add-member');
        toast('Đã xóa thành viên', 'success');
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
    connectMode = false;
    connectFirst = null;
    document.getElementById('connect-status').style.display = 'none';
    graph = null;
    paper = null;
    loadFamilies();
}

// ==================== Photo Upload ====================
function showPhotoUpload(memberId) {
    photoUploadMemberId = memberId;
    document.getElementById('photo-file-input').value = '';
    document.getElementById('photo-preview').innerHTML = '';
    openModal('modal-photo-upload');

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
        openFamily(currentFamily.id);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== Member Detail ====================
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
    showEditMemberModal(currentDetailMemberId);
}

// ==================== Search ====================
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
        if (graph) {
            graph.getElements().forEach(el => {
                el.attr('body/strokeWidth', 2);
            });
        }
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

        // Highlight matching elements
        if (graph) {
            graph.getElements().forEach(el => {
                const memberId = elementMemberMap[el.id];
                const isMatch = results.some(m => m.id === memberId);
                el.attr('body/strokeWidth', isMatch ? 4 : 2);
                el.attr('body/stroke', isMatch ? '#faad14' : (el.attr('body/stroke')));
            });
        }
    } catch (e) {
        console.warn('search error:', e);
    }
}

function highlightMember(memberId) {
    document.getElementById('search-results').style.display = 'none';
    // Find and center on element
    if (graph) {
        const element = graph.getElements().find(el => elementMemberMap[el.id] === memberId);
        if (element) {
            const pos = element.position();
            const scale = paper.scale().sx;
            const elW = element.attributes.size.width;
            const elH = element.attributes.size.height;
            // Center the element in the viewport
            const containerRect = document.getElementById('jointjs-canvas').getBoundingClientRect();
            const tx = containerRect.width / 2 - (pos.x + elW / 2) * scale;
            const ty = containerRect.height / 2 - (pos.y + elH / 2) * scale;
            paper.translate(tx, ty);

            // Flash highlight
            element.attr('body/stroke', '#faad14');
            element.attr('body/strokeWidth', 4);
            setTimeout(() => {
                element.attr('body/strokeWidth', 2);
                const gender = allMembers.find(m => m.id === memberId)?.data?.gender;
                element.attr('body/stroke', gender === 'F' ? '#ff69b4' : '#4a9eff');
            }, 2000);
        }
    }
}

// ==================== Export ====================
function exportFamily() {
    if (!currentFamily) return;
    window.open(`/api/families/${currentFamily.id}/export`, '_blank');
    toast('Đang xuất file...', 'info');
}

// ==================== Connect Mode ====================
function toggleConnectMode() {
    connectMode = !connectMode;
    connectFirst = null;
    const btn = document.getElementById('btn-connect-mode');
    const status = document.getElementById('connect-status');

    if (connectMode) {
        btn.classList.add('btn-active');
        status.style.display = 'flex';
        status.querySelector('span').textContent = '🔗 Chế độ kết nối: Click người thứ nhất...';
        toast('Bật chế độ kết nối. Click vào 2 người để kết nối.', 'info');
    } else {
        btn.classList.remove('btn-active');
        status.style.display = 'none';
        // Reset highlight
        if (graph) {
            graph.getElements().forEach(el => {
                el.attr('body/strokeWidth', 2);
            });
        }
    }
}

function handleConnectClick(memberId, memberName) {
    if (!connectMode) return;

    if (!connectFirst) {
        connectFirst = { id: memberId, name: memberName };
        // Highlight first selection
        if (graph) {
            const el = graph.getElements().find(e => elementMemberMap[e.id] === memberId);
            if (el) {
                el.attr('body/stroke', '#00d68f');
                el.attr('body/strokeWidth', 4);
            }
        }
        document.getElementById('connect-status').querySelector('span').textContent =
            `🔗 Đã chọn: ${memberName} → Click người thứ hai...`;
    } else if (connectFirst.id === memberId) {
        connectFirst = null;
        if (graph) {
            graph.getElements().forEach(el => {
                el.attr('body/strokeWidth', 2);
                const mid = elementMemberMap[el.id];
                const gender = allMembers.find(m => m.id === mid)?.data?.gender;
                el.attr('body/stroke', gender === 'F' ? '#ff69b4' : '#4a9eff');
            });
        }
        document.getElementById('connect-status').querySelector('span').textContent =
            '🔗 Chế độ kết nối: Click người thứ nhất...';
    } else {
        document.getElementById('connect-desc').textContent =
            `Kết nối "${connectFirst.name}" → "${memberName}" với quan hệ:`;
        openModal('modal-connect');

        window._connectFrom = connectFirst.id;
        window._connectTo = memberId;

        // Reset highlight
        if (graph) {
            graph.getElements().forEach(el => {
                el.attr('body/strokeWidth', 2);
                const mid = elementMemberMap[el.id];
                const gender = allMembers.find(m => m.id === mid)?.data?.gender;
                el.attr('body/stroke', gender === 'F' ? '#ff69b4' : '#4a9eff');
            });
        }
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
