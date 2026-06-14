import React, { useState, useEffect } from 'react';
import { useFamilyTreeStore } from '../../stores/familyTreeStore';
import { generateId } from '../../utils/helpers';

interface Props {
  open: boolean;
  onClose: () => void;
  editPerson?: {
    id: string;
    firstName: string;
    lastName: string;
    gender: string;
    birthDate?: string;
    deathDate?: string;
    isAlive: boolean;
    occupation?: string;
  };
}

const PersonModal: React.FC<Props> = ({ open, onClose, editPerson }) => {
  const { addPerson, updatePerson } = useFamilyTreeStore();
  const [form, setForm] = useState({
    fullName: '',
    gender: 'male' as 'male' | 'female' | 'other',
    birthDate: '',
    deathDate: '',
    isAlive: true,
    occupation: '',
  });

  useEffect(() => {
    if (editPerson) {
      setForm({
        fullName: `${editPerson.lastName} ${editPerson.firstName}`.trim(),
        gender: (editPerson.gender as any) || 'male',
        birthDate: editPerson.birthDate || '',
        deathDate: editPerson.deathDate || '',
        isAlive: editPerson.isAlive ?? true,
        occupation: editPerson.occupation || '',
      });
    } else {
      setForm({ fullName: '', gender: 'male', birthDate: '', deathDate: '', isAlive: true, occupation: '' });
    }
  }, [editPerson, open]);

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
    // Vietnamese: last word is firstName, rest is lastName
    const firstName = parts[parts.length - 1];
    const lastName = parts.slice(0, -1).join(' ');
    return { firstName, lastName };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName } = splitName(form.fullName);
    
    if (editPerson) {
      updatePerson(editPerson.id, {
        firstName,
        lastName,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        deathDate: form.deathDate || undefined,
        isAlive: form.isAlive,
        occupation: form.occupation || undefined,
      });
    } else {
      addPerson({
        id: generateId(),
        firstName,
        lastName,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        deathDate: form.deathDate || undefined,
        isAlive: form.isAlive,
        occupation: form.occupation || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        customFields: {},
      });
    }
    
    onClose();
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', borderRadius: '16px', padding: '24px',
        width: '400px', maxHeight: '90vh', overflow: 'auto', border: '1px solid #2a2a2a',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', color: '#fff', fontSize: '20px' }}>
          {editPerson ? '✏️ Sửa thành viên' : '👤 Thêm thành viên'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Họ và tên *</label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              required
              style={inputStyle}
              placeholder="VD: Trần Văn Đức"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Giới tính</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'male', label: '👨 Nam', color: '#4a9eff' },
                { value: 'female', label: '👩 Nữ', color: '#ff69b4' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: opt.value as any })}
                  style={{
                    flex: 1, padding: '10px',
                    background: form.gender === opt.value ? `${opt.color}20` : '#0a0a0a',
                    border: `2px solid ${form.gender === opt.value ? opt.color : '#2a2a2a'}`,
                    borderRadius: '8px',
                    color: form.gender === opt.value ? opt.color : '#888',
                    cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Năm sinh</label>
              <input type="text" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} style={inputStyle} placeholder="1960" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Năm mất</label>
              <input type="text" value={form.deathDate} onChange={e => setForm({ ...form, deathDate: e.target.value })} style={inputStyle} placeholder="2020" disabled={form.isAlive} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAlive} onChange={e => setForm({ ...form, isAlive: e.target.checked, deathDate: e.target.checked ? '' : form.deathDate })} />
              Còn sống
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Nghề nghiệp</label>
            <input type="text" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} style={inputStyle} placeholder="Giáo viên..." />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: '#2a2a2a', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer', fontSize: '14px' }}>
              Hủy
            </button>
            <button type="submit" style={{ flex: 1, padding: '12px', background: '#4a9eff', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              {editPerson ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonModal;
