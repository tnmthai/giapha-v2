import os
import hashlib
import secrets
import uuid
import json
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func as sqlfunc
from pydantic import BaseModel
from typing import Optional, List
from models import Base, engine, get_db, User, Family, Member, MemberRelationship, RelationshipType, create_tables
import io

app = FastAPI(title="Gia Phả - Vietnamese Family Tree")

# Create tables on startup
create_tables()

# Ensure upload directory exists
UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== Config ====================
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}

# ==================== Auth helpers ====================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"

def verify_password(stored: str, password: str) -> bool:
    try:
        salt, h = stored.split(":")
        return hashlib.sha256((salt + password).encode()).hexdigest() == h
    except:
        return False

def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    uid = request.cookies.get("user_id")
    if uid:
        try:
            return db.query(User).filter(User.id == int(uid)).first()
        except (ValueError, TypeError):
            return None
    return None

def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def check_family_access(family_id: int, user: User, db: Session, need_edit: bool = False) -> Family:
    """Check if user has access to family. Returns family or raises 404/403."""
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(404, "Family not found")
    if family.created_by == user.id:
        return family
    # Check shared_with
    shared = family.shared_with or []
    for entry in shared:
        if isinstance(entry, dict) and entry.get("user_id") == user.id:
            if need_edit and entry.get("permission") != "edit":
                raise HTTPException(403, "View-only access")
            return family
    raise HTTPException(404, "Family not found")

# ==================== Pydantic models ====================

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class FamilyCreate(BaseModel):
    name: str
    description: Optional[str] = None

class FamilyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class FamilyShare(BaseModel):
    username: str
    permission: str = "view"  # "view" or "edit"

class MemberCreate(BaseModel):
    full_name: str
    gender: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_place: Optional[str] = None
    occupation: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    is_alive: bool = True

class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    birth_place: Optional[str] = None
    occupation: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    is_alive: Optional[bool] = None

class RelationshipCreate(BaseModel):
    to_member_id: int
    relationship_type: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = True
    notes: Optional[str] = None

# ==================== Routes ====================

@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse("static/index.html")


@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if len(req.username) < 3 or len(req.username) > 50:
        raise HTTPException(400, "Username must be 3-50 characters")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(400, "Username already exists")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        display_name=req.display_name or req.username
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    resp = Response(content='{"ok": true}', media_type="application/json")
    resp.set_cookie("user_id", str(user.id), httponly=True, samesite="lax", max_age=86400*30)
    return resp


@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(user.password_hash, req.password):
        raise HTTPException(401, "Invalid credentials")
    resp = Response(content='{"ok": true}', media_type="application/json")
    resp.set_cookie("user_id", str(user.id), httponly=True, samesite="lax", max_age=86400*30)
    return resp


@app.post("/api/logout")
def logout():
    resp = Response(content='{"ok": true}', media_type="application/json")
    resp.delete_cookie("user_id")
    return resp


@app.get("/api/me")
def me(user: User = Depends(require_user)):
    return {"id": user.id, "username": user.username, "display_name": user.display_name}


# ==================== Family CRUD ====================

@app.get("/api/families")
def list_families(user: User = Depends(require_user), db: Session = Depends(get_db)):
    # Owned families
    owned = db.query(Family).filter(Family.created_by == user.id).all()
    # Shared families - query all and filter in Python (JSON column)
    all_families = db.query(Family).filter(Family.created_by != user.id).all()
    shared = []
    for f in all_families:
        sw = f.shared_with or []
        for entry in sw:
            if isinstance(entry, dict) and entry.get("user_id") == user.id:
                shared.append(f)
                break

    result = []
    for f in owned:
        result.append({"id": f.id, "name": f.name, "description": f.description, "member_count": len(f.members), "owned": True})
    for f in shared:
        result.append({"id": f.id, "name": f.name, "description": f.description, "member_count": len(f.members), "owned": False})
    return result


@app.post("/api/families")
def create_family(req: FamilyCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = Family(name=req.name, description=req.description, created_by=user.id)
    db.add(family)
    db.commit()
    db.refresh(family)
    return {"id": family.id, "name": family.name, "description": family.description}


@app.put("/api/families/{family_id}")  # Feature 7: Edit family
def update_family(family_id: int, req: FamilyUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = check_family_access(family_id, user, db, need_edit=True)
    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(400, "Name cannot be empty")
        family.name = req.name.strip()
    if req.description is not None:
        family.description = req.description
    db.commit()
    db.refresh(family)
    return {"id": family.id, "name": family.name, "description": family.description}


@app.delete("/api/families/{family_id}")  # Feature 6: Delete family
def delete_family(family_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")
    # Cascade handled by ORM relationships
    db.delete(family)
    db.commit()
    return {"ok": True}


@app.post("/api/families/{family_id}/share")  # Feature 5: Share family
def share_family(family_id: int, req: FamilyShare, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")
    target_user = db.query(User).filter(User.username == req.username).first()
    if not target_user:
        raise HTTPException(404, "User not found")
    if target_user.id == user.id:
        raise HTTPException(400, "Cannot share with yourself")
    if req.permission not in ("view", "edit"):
        raise HTTPException(400, "Permission must be 'view' or 'edit'")

    shared = family.shared_with or []
    # Update or add
    found = False
    for entry in shared:
        if isinstance(entry, dict) and entry.get("user_id") == target_user.id:
            entry["permission"] = req.permission
            found = True
            break
    if not found:
        shared.append({"user_id": target_user.id, "permission": req.permission})
    family.shared_with = shared
    db.commit()
    return {"ok": True, "shared_with": shared}


@app.delete("/api/families/{family_id}/share/{user_id}")  # Feature 5: Unshare
def unshare_family(family_id: int, user_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")
    shared = family.shared_with or []
    family.shared_with = [e for e in shared if not (isinstance(e, dict) and e.get("user_id") == user_id)]
    db.commit()
    return {"ok": True}


# ==================== Members ====================

@app.get("/api/families/{family_id}/members")
def get_family_members(family_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = check_family_access(family_id, user, db)
    members = db.query(Member).filter(Member.family_id == family_id).all()

    result = []
    for m in members:
        rels_from = db.query(MemberRelationship).filter(MemberRelationship.from_member_id == m.id).all()
        rels_to = db.query(MemberRelationship).filter(MemberRelationship.to_member_id == m.id).all()

        parents = []
        spouses = []
        children = []
        rel_types = {}  # Track relationship types for badges

        for rel in rels_from:
            if rel.relationship_type in ("child", "stepchild", "adopted_child"):
                children.append(str(rel.to_member_id))
                rel_types[str(rel.to_member_id)] = rel.relationship_type
            elif rel.relationship_type in ("spouse", "ex_spouse"):
                spouses.append(str(rel.to_member_id))
                rel_types[str(rel.to_member_id)] = rel.relationship_type
            elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
                parents.append(str(rel.to_member_id))
                rel_types[str(rel.to_member_id)] = rel.relationship_type

        for rel in rels_to:
            if rel.relationship_type in ("child", "stepchild", "adopted_child"):
                if str(rel.from_member_id) not in parents:
                    parents.append(str(rel.from_member_id))
                    rel_types[str(rel.from_member_id)] = rel.relationship_type
            elif rel.relationship_type in ("spouse", "ex_spouse"):
                if str(rel.from_member_id) not in spouses:
                    spouses.append(str(rel.from_member_id))
                    rel_types[str(rel.from_member_id)] = rel.relationship_type
            elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
                if str(rel.from_member_id) not in children:
                    children.append(str(rel.from_member_id))
                    rel_types[str(rel.from_member_id)] = rel.relationship_type

        result.append({
            "id": str(m.id),
            "data": {
                "name": m.full_name,
                "gender": m.gender,
                "birth_date": m.birth_date or "",
                "death_date": m.death_date or "",
                "birth_place": m.birth_place or "",
                "occupation": m.occupation or "",
                "bio": m.bio or "",
                "photo": m.photo or "",
                "is_alive": m.is_alive,
            },
            "rels": {
                "parents": parents,
                "spouses": spouses,
                "children": children,
            },
            "rel_types": rel_types,  # Feature 4: relationship type badges
        })

    return {"family": {"id": family.id, "name": family.name, "owned": family.created_by == user.id}, "members": result}


@app.post("/api/families/{family_id}/members")
def add_member(family_id: int, req: MemberCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = check_family_access(family_id, user, db, need_edit=True)
    member = Member(family_id=family_id, **req.dict())
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "full_name": member.full_name}


@app.get("/api/families/{family_id}/members/search")  # Feature 2: Search
def search_members(family_id: int, q: str = Query("", min_length=0), user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = check_family_access(family_id, user, db)
    query = db.query(Member).filter(Member.family_id == family_id)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(
                Member.full_name.ilike(pattern),
                Member.birth_place.ilike(pattern),
                Member.occupation.ilike(pattern),
            )
        )
    members = query.all()
    return [{"id": m.id, "full_name": m.full_name, "gender": m.gender, "birth_date": m.birth_date, "birth_place": m.birth_place, "occupation": m.occupation} for m in members]


@app.get("/api/members/{member_id}")  # Feature 8: Member detail
def get_member_detail(member_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    # Check access
    check_family_access(member.family_id, user, db)

    # Get relationships with types
    rels_from = db.query(MemberRelationship).filter(MemberRelationship.from_member_id == member_id).all()
    rels_to = db.query(MemberRelationship).filter(MemberRelationship.to_member_id == member_id).all()

    parents = []
    spouses = []
    children = []

    for rel in rels_from:
        other = db.query(Member).filter(Member.id == rel.to_member_id).first()
        if not other:
            continue
        info = {"id": other.id, "name": other.full_name, "type": rel.relationship_type}
        if rel.relationship_type in ("child", "stepchild", "adopted_child"):
            children.append(info)
        elif rel.relationship_type in ("spouse", "ex_spouse"):
            spouses.append(info)
        elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
            parents.append(info)

    for rel in rels_to:
        other = db.query(Member).filter(Member.id == rel.from_member_id).first()
        if not other:
            continue
        info = {"id": other.id, "name": other.full_name, "type": rel.relationship_type}
        if rel.relationship_type in ("child", "stepchild", "adopted_child"):
            if not any(p["id"] == other.id for p in parents):
                parents.append(info)
        elif rel.relationship_type in ("spouse", "ex_spouse"):
            if not any(s["id"] == other.id for s in spouses):
                spouses.append(info)
        elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
            if not any(c["id"] == other.id for c in children):
                children.append(info)

    return {
        "id": member.id,
        "full_name": member.full_name,
        "gender": member.gender,
        "birth_date": member.birth_date,
        "death_date": member.death_date,
        "birth_place": member.birth_place,
        "occupation": member.occupation,
        "bio": member.bio,
        "photo": member.photo,
        "is_alive": member.is_alive,
        "family_id": member.family_id,
        "parents": parents,
        "spouses": spouses,
        "children": children,
    }


@app.put("/api/members/{member_id}")
def update_member(member_id: int, req: MemberUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    check_family_access(member.family_id, user, db, need_edit=True)
    for k, v in req.dict(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "full_name": member.full_name}


@app.delete("/api/members/{member_id}")
def delete_member(member_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    check_family_access(member.family_id, user, db, need_edit=True)
    db.delete(member)
    db.commit()
    return {"ok": True}


# ==================== Photo Upload (Feature 1) ====================

@app.post("/api/members/{member_id}/photo")
async def upload_photo(member_id: int, request: Request, photo: UploadFile = File(...), user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    check_family_access(member.family_id, user, db, need_edit=True)

    # Validate content type
    if photo.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(400, "Only jpg, png, webp allowed")

    # Read and validate size
    contents = await photo.read()
    if len(contents) > MAX_PHOTO_SIZE:
        raise HTTPException(400, "File too large (max 5MB)")

    # Generate safe filename
    ext = photo.filename.rsplit(".", 1)[-1].lower() if "." in photo.filename else "jpg"
    safe_ext = ext if ext in ("jpg", "jpeg", "png", "webp") else "jpg"
    filename = f"{member_id}_{uuid.uuid4().hex[:8]}.{safe_ext}"
    filepath = UPLOAD_DIR / filename

    # Delete old photo if exists
    if member.photo:
        old_path = Path("static") / member.photo.lstrip("/")
        if old_path.exists() and old_path != filepath:
            try:
                old_path.unlink()
            except:
                pass

    filepath.write_bytes(contents)
    member.photo = f"/static/uploads/{filename}"
    db.commit()
    return {"ok": True, "photo": member.photo}


# ==================== Relationships ====================

@app.post("/api/members/{member_id}/relationships")
def add_relationship(member_id: int, req: RelationshipCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    check_family_access(member.family_id, user, db, need_edit=True)
    target = db.query(Member).filter(Member.id == req.to_member_id).first()
    if not target:
        raise HTTPException(404, "Target member not found")

    existing = db.query(MemberRelationship).filter(
        MemberRelationship.from_member_id == member_id,
        MemberRelationship.to_member_id == req.to_member_id,
        MemberRelationship.relationship_type == req.relationship_type
    ).first()
    if existing:
        raise HTTPException(400, "Relationship already exists")

    rel = MemberRelationship(
        from_member_id=member_id,
        to_member_id=req.to_member_id,
        relationship_type=req.relationship_type,
        start_date=req.start_date,
        end_date=req.end_date,
        is_current=req.is_current,
        notes=req.notes
    )
    db.add(rel)
    db.commit()
    return {"ok": True, "id": rel.id}


@app.delete("/api/relationships/{rel_id}")
def delete_relationship(rel_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    rel = db.query(MemberRelationship).filter(MemberRelationship.id == rel_id).first()
    if not rel:
        raise HTTPException(404, "Relationship not found")
    member = db.query(Member).join(Family).filter(Member.id == rel.from_member_id, Family.created_by == user.id).first()
    if not member:
        raise HTTPException(403, "Not authorized")
    db.delete(rel)
    db.commit()
    return {"ok": True}


# ==================== Export (Feature 3) ====================

@app.get("/api/families/{family_id}/export")
def export_family(family_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = check_family_access(family_id, user, db)
    members = db.query(Member).filter(Member.family_id == family_id).all()
    relationships = db.query(MemberRelationship).filter(
        MemberRelationship.from_member_id.in_([m.id for m in members])
    ).all()

    # Build text export
    lines = [f"GIA PHẢ: {family.name}", "=" * 50, ""]
    if family.description:
        lines.append(f"Mô tả: {family.description}")
        lines.append("")

    # Organize by generation (simple: list all members)
    lines.append("THÀNH VIÊN:")
    lines.append("-" * 30)
    for m in members:
        status = "✝" if not m.is_alive else ""
        dates = ""
        if m.birth_date:
            dates = f"({m.birth_date}"
            if m.death_date:
                dates += f" - {m.death_date}"
            dates += ")"
        place = f" - {m.birth_place}" if m.birth_place else ""
        occ = f" - {m.occupation}" if m.occupation else ""
        lines.append(f"  • {m.full_name} {status} {dates}{place}{occ}")
    lines.append("")

    lines.append("MỐI QUAN HỆ:")
    lines.append("-" * 30)
    member_map = {m.id: m.full_name for m in members}
    rel_labels = {
        "spouse": "vợ/chồng",
        "ex_spouse": "vợ/chồng cũ",
        "parent": "cha/mẹ",
        "step_parent": "cha/mẹ kế",
        "adoptive_parent": "cha/mẹ nuôi",
        "child": "con",
        "stepchild": "con riêng",
        "adopted_child": "con nuôi",
    }
    for rel in relationships:
        from_name = member_map.get(rel.from_member_id, "?")
        to_name = member_map.get(rel.to_member_id, "?")
        label = rel_labels.get(rel.relationship_type, rel.relationship_type)
        lines.append(f"  {from_name} → {label} → {to_name}")

    content = "\n".join(lines)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="giapha_{family_id}.txt"'}
    )


# ==================== Seed ====================

@app.post("/api/families/{family_id}/seed")
def seed_family(family_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")

    # Clear existing members
    db.query(MemberRelationship).filter(
        MemberRelationship.from_member_id.in_([m.id for m in db.query(Member).filter(Member.family_id == family_id).all()])
    ).delete(synchronize_session=False)
    db.query(MemberRelationship).filter(
        MemberRelationship.to_member_id.in_([m.id for m in db.query(Member).filter(Member.family_id == family_id).all()])
    ).delete(synchronize_session=False)
    db.query(Member).filter(Member.family_id == family_id).delete()
    db.commit()

    # Seed data - 5 generations of Trần family
    members_data = [
        {"full_name": "Trần Đức Phát", "gender": "M", "birth_date": "1920", "death_date": "1995", "birth_place": "Nghệ An", "occupation": "Nông dân", "is_alive": False},
        {"full_name": "Nguyễn Thị Lan", "gender": "F", "birth_date": "1925", "death_date": "2000", "birth_place": "Hà Tĩnh", "occupation": "Nội trợ", "is_alive": False},
        {"full_name": "Trần Văn Long", "gender": "M", "birth_date": "1945", "death_date": "2010", "birth_place": "Nghệ An", "occupation": "Giáo viên", "is_alive": False},
        {"full_name": "Lê Thị Hoa", "gender": "F", "birth_date": "1948", "birth_place": "Thanh Hóa", "occupation": "Y tá", "is_alive": True},
        {"full_name": "Trần Văn Hùng", "gender": "M", "birth_date": "1950", "birth_place": "Nghệ An", "occupation": "Kỹ sư", "is_alive": True},
        {"full_name": "Phạm Thị Mai", "gender": "F", "birth_date": "1952", "birth_place": "Hải Phòng", "occupation": "Giáo viên", "is_alive": True},
        {"full_name": "Trần Minh Tuấn", "gender": "M", "birth_date": "1970", "birth_place": "Hà Nội", "occupation": "Bác sĩ", "is_alive": True},
        {"full_name": "Vũ Thị Hương", "gender": "F", "birth_date": "1972", "birth_place": "Hà Nội", "occupation": "Dược sĩ", "is_alive": True},
        {"full_name": "Trần Minh Đức", "gender": "M", "birth_date": "1975", "birth_place": "TP.HCM", "occupation": "Doanh nhân", "is_alive": True},
        {"full_name": "Đỗ Thị Thanh", "gender": "F", "birth_date": "1978", "birth_place": "Đà Nẵng", "occupation": "Luật sư", "is_alive": True},
        {"full_name": "Trần Thị Mai", "gender": "F", "birth_date": "1973", "birth_place": "Hải Phòng", "occupation": "Kế toán", "is_alive": True},
        {"full_name": "Nguyễn Văn Nam", "gender": "M", "birth_date": "1970", "birth_place": "Hải Phòng", "occupation": "Bộ đội", "is_alive": True},
        {"full_name": "Trần Quốc Bảo", "gender": "M", "birth_date": "1995", "birth_place": "Hà Nội", "occupation": "Lập trình viên", "is_alive": True},
        {"full_name": "Lý Thị Ngọc", "gender": "F", "birth_date": "1997", "birth_place": "Hà Nội", "occupation": "Thiết kế", "is_alive": True},
        {"full_name": "Trần Quốc An", "gender": "M", "birth_date": "1998", "birth_place": "Hà Nội", "occupation": "Sinh viên", "is_alive": True},
        {"full_name": "Trần Thanh Tâm", "gender": "M", "birth_date": "2000", "birth_place": "TP.HCM", "occupation": "Sinh viên", "is_alive": True},
        {"full_name": "Hoàng Thị Yến", "gender": "F", "birth_date": "2001", "birth_place": "TP.HCM", "occupation": "Nhà thiết kế", "is_alive": True},
        {"full_name": "Lê Hoàng Phúc", "gender": "M", "birth_date": "1996", "birth_place": "Đà Nẵng", "occupation": "Kỹ thuật viên", "is_alive": True},
        {"full_name": "Bùi Thị Thu", "gender": "F", "birth_date": "1975", "birth_place": "TP.HCM", "occupation": "Giáo viên", "is_alive": True},
        {"full_name": "Trần Minh Khôi", "gender": "M", "birth_date": "2002", "birth_place": "TP.HCM", "occupation": "Học sinh", "is_alive": True},
        {"full_name": "Trần Gia Bảo", "gender": "M", "birth_date": "2020", "birth_place": "Hà Nội", "occupation": "", "is_alive": True},
        {"full_name": "Trần Gia Linh", "gender": "F", "birth_date": "2022", "birth_place": "Hà Nội", "occupation": "", "is_alive": True},
        {"full_name": "Trần Khánh Vy", "gender": "F", "birth_date": "2021", "birth_place": "TP.HCM", "occupation": "", "is_alive": True},
    ]

    member_objs = []
    for md in members_data:
        m = Member(family_id=family_id, **md)
        db.add(m)
        member_objs.append(m)
    db.flush()

    rels = [
        (0, 1, "spouse"), (1, 0, "spouse"),
        (0, 2, "child"), (1, 2, "child"),
        (0, 4, "child"), (1, 4, "child"),
        (2, 3, "spouse"), (3, 2, "spouse"),
        (4, 5, "spouse"), (5, 4, "spouse"),
        (2, 6, "child"), (3, 6, "child"),
        (2, 10, "child"), (3, 10, "child"),
        (4, 8, "child"), (5, 8, "child"),
        (6, 7, "spouse"), (7, 6, "spouse"),
        (8, 9, "spouse"), (9, 8, "spouse"),
        (11, 10, "spouse"), (10, 11, "spouse"),
        (8, 18, "ex_spouse"), (18, 8, "ex_spouse"),
        (18, 17, "child"), (17, 18, "parent"),
        (8, 17, "stepchild"), (17, 8, "step_parent"),
        (6, 12, "child"), (7, 12, "child"),
        (6, 14, "child"), (7, 14, "child"),
        (8, 15, "child"), (9, 15, "child"),
        (8, 19, "adopted_child"), (19, 8, "adoptive_parent"),
        (9, 19, "adopted_child"), (19, 9, "adoptive_parent"),
        (12, 13, "spouse"), (13, 12, "spouse"),
        (15, 16, "spouse"), (16, 15, "spouse"),
        (12, 20, "child"), (13, 20, "child"),
        (12, 21, "child"), (13, 21, "child"),
        (15, 22, "child"), (16, 22, "child"),
    ]

    for from_idx, to_idx, rel_type in rels:
        r = MemberRelationship(
            from_member_id=member_objs[from_idx].id,
            to_member_id=member_objs[to_idx].id,
            relationship_type=rel_type
        )
        db.add(r)

    db.commit()
    return {"ok": True, "members_created": len(members_data), "relationships_created": len(rels)}
