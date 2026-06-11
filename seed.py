"""Standalone seed script - seeds demo data into the database."""
from models import create_tables, SessionLocal, User, Family, Member, MemberRelationship, hash_password


def seed():
    create_tables()
    db = SessionLocal()

    # Create demo user
    if not db.query(User).filter(User.username == "demo").first():
        user = User(username="demo", password_hash=hash_password("demo123"), display_name="Demo User")
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = db.query(User).filter(User.username == "demo").first()

    # Create family
    family = db.query(Family).filter(Family.name == "Gia tộc Trần", Family.created_by == user.id).first()
    if not family:
        family = Family(name="Gia tộc Trần", description="Gia phả mẫu 5 đời dòng họ Trần", created_by=user.id)
        db.add(family)
        db.commit()
        db.refresh(family)

    # Clear existing
    existing_members = db.query(Member).filter(Member.family_id == family.id).all()
    for m in existing_members:
        db.query(MemberRelationship).filter(
            (MemberRelationship.from_member_id == m.id) | (MemberRelationship.to_member_id == m.id)
        ).delete(synchronize_session=False)
    db.query(Member).filter(Member.family_id == family.id).delete()
    db.commit()

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

    objs = []
    for md in members_data:
        m = Member(family_id=family.id, **md)
        db.add(m)
        objs.append(m)
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

    for fi, ti, rt in rels:
        db.add(MemberRelationship(from_member_id=objs[fi].id, to_member_id=objs[ti].id, relationship_type=rt))

    db.commit()
    print(f"Seeded {len(members_data)} members, {len(rels)} relationships")
    db.close()


if __name__ == "__main__":
    seed()
