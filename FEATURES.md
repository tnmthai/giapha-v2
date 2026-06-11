# Gia Phả v2 - Feature Implementation & Security Audit

## ✅ All 10 Features Implemented

### 1. 📷 Upload ảnh thành viên
- **Endpoint:** `POST /api/members/{id}/photo` (multipart/form-data)
- **Validation:** jpg/png/webp only, max 5MB, UUID filenames
- **UI:** 📷 button on each card, photo preview modal
- **Storage:** `static/uploads/` directory
- **Old photos:** Auto-deleted when new one uploaded

### 2. 🔍 Tìm kiếm thành viên
- **Endpoint:** `GET /api/families/{id}/members/search?q=keyword`
- **Search fields:** name, birth_place, occupation (case-insensitive)
- **UI:** Search bar in tree header with debounced input (300ms)
- **Results:** Dropdown with clickable results
- **Highlight:** Matching cards get yellow outline on tree

### 3. 📄 Xuất PDF/tree image
- **Endpoint:** `GET /api/families/{id}/export`
- **Format:** Downloadable text file with family structure
- **Content:** Member list with dates/places/occupations + relationship map
- **UI:** 📄 Xuất button in tree header

### 4. 🏷️ Badge quan hệ
- **Colors:** Biological (none), Step (yellow #faad14), Adopted (blue #4a9eff), Ex (red #ff4d4f)
- **Display:** Small colored badges on tree cards
- **Backend:** `rel_types` field in member data tracks relationship types
- **Detail view:** Badges shown next to each relationship

### 5. 👥 Chia sẻ gia phả
- **Endpoint:** `POST /api/families/{id}/share` (username + permission)
- **Unshare:** `DELETE /api/families/{id}/share/{user_id}`
- **Permissions:** "view" (read-only) or "edit"
- **Model:** `shared_with` JSON column on Family (list of {user_id, permission})
- **UI:** 🔗 Chia sẻ modal, "Được chia sẻ" badge on family list
- **Access:** Shared users appear in family list; edit buttons hidden for view-only

### 6. 🗑️ Xóa gia phả
- **Endpoint:** `DELETE /api/families/{id}`
- **Cascade:** Deletes all members and relationships (ORM cascade)
- **UI:** 🗑️ button in tree header with confirmation dialog
- **Auth:** Only owner can delete

### 7. ✏️ Sửa tên gia phả
- **Endpoint:** `PUT /api/families/{id}` (name, description)
- **UI:** ✏️ button opens edit modal
- **Auth:** Owner or edit-permission shared users

### 8. 📋 Xem chi tiết thành viên
- **Endpoint:** `GET /api/members/{id}` (full detail with relationships)
- **UI:** ℹ️ button on cards opens detail modal
- **Content:** Photo, name, gender, dates, places, occupation, bio
- **Relationships:** Parents, spouses, children with type badges
- **Navigation:** Click on related members to view their details
- **Edit:** Edit button from detail view

### 9. 🔗 Chế độ kết nối
- **UI:** 🔗 Kết nối toggle button
- **Flow:** Toggle on → click first person (green highlight) → click second → relationship picker modal
- **Relationships:** spouse, parent, child, step_parent, stepchild, adoptive_parent, adopted_child
- **Status bar:** Shows current selection state
- **Visual:** Cards get crosshair cursor and outline in connect mode

### 10. 📱 Cải thiện mobile
- **Responsive breakpoints:** 768px and 480px
- **Cards:** Smaller on mobile (140px min-width, 32px photos)
- **Touch targets:** Min 36px buttons, 32px card action buttons
- **Font size:** 16px inputs (prevents iOS zoom)
- **Modals:** Bottom-sheet style on mobile (border-radius top only)
- **Actions:** Always visible on mobile (no hover needed)
- **Viewport:** `user-scalable=no` for app-like feel

---

## 🔒 Security Audit Results

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | SQL Injection | ✅ SAFE | All queries use SQLAlchemy ORM (parameterized) |
| 2 | XSS | ✅ SAFE | Frontend uses `esc()` (textContent-based escaping) |
| 3 | CSRF | ✅ MITIGATED | SameSite=strict cookies; JSON-only API (no form endpoints) |
| 4 | Auth | ✅ SAFE | All data endpoints require `require_user` or `check_family_access` |
| 5 | Authorization | ✅ SAFE | `check_family_access()` validates ownership or share permission |
| 6 | File Upload | ✅ SAFE | Validates content-type, 5MB limit, UUID filenames, path traversal prevention |
| 7 | Rate Limiting | ✅ FIXED | slowapi: 10/min login, 5/min register |
| 8 | Password Security | ✅ FIXED | Migrated from SHA-256+salt to bcrypt; auto-migrates on login |
| 9 | Cookie Security | ✅ FIXED | httponly=true, samesite=strict, path=/ |
| 10 | Dependencies | ✅ UPDATED | Added bcrypt, slowapi, python-multipart |
| 11 | Env Variables | ✅ SAFE | DATABASE_URL from env, no hardcoded secrets |
| 12 | CORS | ✅ FIXED | Explicitly restricted (no cross-origin allowed) |
| 13 | Error Handling | ✅ SAFE | Generic messages, no sensitive info leaked |

### Security Fixes Applied:
1. **bcrypt** for password hashing (was SHA-256+salt)
2. **Rate limiting** on auth endpoints (slowapi)
3. **SameSite=strict** cookies (was lax)
4. **CORS** explicitly restricted
5. **Legacy password migration** - existing users auto-upgraded on next login
6. **Upload directory** added to .gitignore

---

## Files Modified:
- `app.py` — All new endpoints + security fixes
- `models.py` — Added `shared_with` JSON column to Family
- `static/index.html` — All new UI elements (modals, search, etc.)
- `static/js/app.js` — All frontend features
- `static/css/style.css` — All new styles + mobile responsive
- `requirements.txt` — Added bcrypt, slowapi, python-multipart
- `.gitignore` — Added static/uploads/ and .venv/

## Deployment:
- GitHub: Pushed to `main` branch
- Railway: Deployed to giapha-web service
- URL: https://giapha.up.railway.app
