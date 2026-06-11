import os
import hashlib
import secrets
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from models import Base, engine, get_db, User, Family, Member, MemberRelationship, RelationshipType, create_tables

app = FastAPI(title="Gia Phả - Vietnamese Family Tree")

# Create tables on startup
create_tables()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

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
        return db.query(User).filter(User.id == int(uid)).first()
    return None

def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

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


@app.get("/api/families")
def list_families(user: User = Depends(require_user), db: Session = Depends(get_db)):
    families = db.query(Family).filter(Family.created_by == user.id).all()
    return [{"id": f.id, "name": f.name, "description": f.description, "member_count": len(f.members)} for f in families]


@app.post("/api/families")
def create_family(req: FamilyCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = Family(name=req.name, description=req.description, created_by=user.id)
    db.add(family)
    db.commit()
    db.refresh(family)
    return {"id": family.id, "name": family.name, "description": family.description}


@app.get("/api/families/{family_id}/members")
def get_family_members(family_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")

    members = db.query(Member).filter(Member.family_id == family_id).all()

    # Build family-chart format
    result = []
    for m in members:
        # Get relationships
        rels_from = db.query(MemberRelationship).filter(MemberRelationship.from_member_id == m.id).all()
        rels_to = db.query(MemberRelationship).filter(MemberRelationship.to_member_id == m.id).all()

        parents = []
        spouses = []
        children = []

        for rel in rels_from:
            if rel.relationship_type in ("child", "stepchild", "adopted_child"):
                children.append(str(rel.to_member_id))
            elif rel.relationship_type in ("spouse", "ex_spouse"):
                spouses.append(str(rel.to_member_id))
            elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
                parents.append(str(rel.to_member_id))

        for rel in rels_to:
            if rel.relationship_type in ("child", "stepchild", "adopted_child"):
                # m is child of to_member -> to_member is parent of m
                if str(rel.from_member_id) not in parents:
                    parents.append(str(rel.from_member_id))
            elif rel.relationship_type in ("spouse", "ex_spouse"):
                if str(rel.from_member_id) not in spouses:
                    spouses.append(str(rel.from_member_id))
            elif rel.relationship_type in ("parent", "step_parent", "adoptive_parent", "guardian", "foster_parent"):
                # to_member is parent of from_member -> from_member is child of to_member
                if str(rel.from_member_id) not in children:
                    children.append(str(rel.from_member_id))

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
            }
        })

    return {"family": {"id": family.id, "name": family.name}, "members": result}


@app.post("/api/families/{family_id}/members")
def add_member(family_id: int, req: MemberCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id, Family.created_by == user.id).first()
    if not family:
        raise HTTPException(404, "Family not found")
    member = Member(family_id=family_id, **req.dict())
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "full_name": member.full_name}


@app.put("/api/members/{member_id}")
def update_member(member_id: int, req: MemberUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id, Family.created_by == user.id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "full_name": member.full_name}


@app.delete("/api/members/{member_id}")
def delete_member(member_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id, Family.created_by == user.id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    db.delete(member)
    db.commit()
    return {"ok": True}


@app.post("/api/members/{member_id}/relationships")
def add_relationship(member_id: int, req: RelationshipCreate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.query(Member).join(Family).filter(Member.id == member_id, Family.created_by == user.id).first()
    if not member:
        raise HTTPException(404, "Member not found")
    target = db.query(Member).filter(Member.id == req.to_member_id).first()
    if not target:
        raise HTTPException(404, "Target member not found")

    # Check if relationship already exists
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
    # Verify ownership through family
    member = db.query(Member).join(Family).filter(Member.id == rel.from_member_id, Family.created_by == user.id).first()
    if not member:
        raise HTTPException(403, "Not authorized")
    db.delete(rel)
    db.commit()
    return {"ok": True}


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
        # Gen 1 - Great-great-grandparents
        {"full_name": "Trần Đức Phát", "gender": "M", "birth_date": "1920", "death_date": "1995", "birth_place": "Nghệ An", "occupation": "Nông dân", "is_alive": False},
        {"full_name": "Nguyễn Thị Lan", "gender": "F", "birth_date": "1925", "death_date": "2000", "birth_place": "Hà Tĩnh", "occupation": "Nội trợ", "is_alive": False},
        # Gen 2 - Great-grandparents
        {"full_name": "Trần Văn Long", "gender": "M", "birth_date": "1945", "death_date": "2010", "birth_place": "Nghệ An", "occupation": "Giáo viên", "is_alive": False},
        {"full_name": "Lê Thị Hoa", "gender": "F", "birth_date": "1948", "birth_place": "Thanh Hóa", "occupation": "Y tá", "is_alive": True},
        {"full_name": "Trần Văn Hùng", "gender": "M", "birth_date": "1950", "birth_place": "Nghệ An", "occupation": "Kỹ sư", "is_alive": True},
        {"full_name": "Phạm Thị Mai", "gender": "F", "birth_date": "1952", "birth_place": "Hải Phòng", "occupation": "Giáo viên", "is_alive": True},
        # Gen 3 - Grandparents
        {"full_name": "Trần Minh Tuấn", "gender": "M", "birth_date": "1970", "birth_place": "Hà Nội", "occupation": "Bác sĩ", "is_alive": True},
        {"full_name": "Vũ Thị Hương", "gender": "F", "birth_date": "1972", "birth_place": "Hà Nội", "occupation": "Dược sĩ", "is_alive": True},
        {"full_name": "Trần Minh Đức", "gender": "M", "birth_date": "1975", "birth_place": "TP.HCM", "occupation": "Doanh nhân", "is_alive": True},
        {"full_name": "Đỗ Thị Thanh", "gender": "F", "birth_date": "1978", "birth_place": "Đà Nẵng", "occupation": "Luật sư", "is_alive": True},
        {"full_name": "Trần Thị Mai", "gender": "F", "birth_date": "1973", "birth_place": "Hải Phòng", "occupation": "Kế toán", "is_alive": True},
        {"full_name": "Nguyễn Văn Nam", "gender": "M", "birth_date": "1970", "birth_place": "Hải Phòng", "occupation": "Bộ đội", "is_alive": True},
        # Gen 4 - Parents (with step/adopted scenarios)
        {"full_name": "Trần Quốc Bảo", "gender": "M", "birth_date": "1995", "birth_place": "Hà Nội", "occupation": "Lập trình viên", "is_alive": True},
        {"full_name": "Lý Thị Ngọc", "gender": "F", "birth_date": "1997", "birth_place": "Hà Nội", "occupation": "Thiết kế", "is_alive": True},
        {"full_name": "Trần Quốc An", "gender": "M", "birth_date": "1998", "birth_place": "Hà Nội", "occupation": "Sinh viên", "is_alive": True},
        {"full_name": "Trần Thanh Tâm", "gender": "M", "birth_date": "2000", "birth_place": "TP.HCM", "occupation": "Sinh viên", "is_alive": True},
        {"full_name": "Hoàng Thị Yến", "gender": "F", "birth_date": "2001", "birth_place": "TP.HCM", "occupation": "Nhà thiết kế", "is_alive": True},
        # Stepchild
        {"full_name": "Lê Hoàng Phúc", "gender": "M", "birth_date": "1996", "birth_place": "Đà Nẵng", "occupation": "Kỹ thuật viên", "is_alive": True},
        # Ex-spouse
        {"full_name": "Bùi Thị Thu", "gender": "F", "birth_date": "1975", "birth_place": "TP.HCM", "occupation": "Giáo viên", "is_alive": True},
        # Adopted child
        {"full_name": "Trần Minh Khôi", "gender": "M", "birth_date": "2002", "birth_place": "TP.HCM", "occupation": "Học sinh", "is_alive": True},
        # Gen 5 - Children
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

    # Define relationships (from_member_id, to_member_id, type)
    # Indices: 0=Phát, 1=Lan, 2=Long, 3=Hoa, 4=Hùng, 5=Mai, 6=Tuấn, 7=Hương, 8=Đức, 9=Thanh, 10=Mai(thị), 11=Nam, 12=Bảo, 13=Ngọc, 14=An, 15=Tâm, 16=Yến, 17=Phúc(step), 18=Thu(ex), 19=Khôi(adopted), 20=GiaBảo, 21=GiaLinh, 22=KhánhVy
    rels = [
        # Gen 1 spouses
        (0, 1, "spouse"),
        (1, 0, "spouse"),
        # Gen 1 -> Gen 2 (children)
        (0, 2, "child"), (1, 2, "child"),
        (0, 4, "child"), (1, 4, "child"),
        # Gen 2 spouses
        (2, 3, "spouse"), (3, 2, "spouse"),
        (4, 5, "spouse"), (5, 4, "spouse"),
        # Gen 2 -> Gen 3 (children)
        (2, 6, "child"), (3, 6, "child"),
        (2, 10, "child"), (3, 10, "child"),
        (4, 8, "child"), (5, 8, "child"),
        # Gen 3 spouses
        (6, 7, "spouse"), (7, 6, "spouse"),
        (8, 9, "spouse"), (9, 8, "spouse"),
        (11, 10, "spouse"), (10, 11, "spouse"),
        # Ex-spouse scenario: Đức divorced Thu, married Thanh
        (8, 18, "ex_spouse"), (18, 8, "ex_spouse"),
        # Stepchild: Phúc is Thu's child from previous relationship, stepchild of Đức
        (18, 17, "child"), (17, 18, "parent"),
        (8, 17, "stepchild"), (17, 8, "step_parent"),
        # Gen 3 -> Gen 4 (children)
        (6, 12, "child"), (7, 12, "child"),
        (6, 14, "child"), (7, 14, "child"),
        (8, 15, "child"), (9, 15, "child"),
        # Adopted child: Khôi adopted by Đức and Thanh
        (8, 19, "adopted_child"), (19, 8, "adoptive_parent"),
        (9, 19, "adopted_child"), (19, 9, "adoptive_parent"),
        # Gen 4 spouses
        (12, 13, "spouse"), (13, 12, "spouse"),
        (15, 16, "spouse"), (16, 15, "spouse"),
        # Gen 4 -> Gen 5 (children)
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
# force rebuild Thu Jun 11 23:17:11 NZST 2026
