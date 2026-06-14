import React, { useState } from 'react';
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
    firstName: editPerson?.firstName || '',
    lastName: editPerson?.lastName || '',
    gender: (editPerson?.gender || 'male') as 'male' | 'female' | 'other',
    birthDate: editPerson?.birthDate || '',
    deathDate: editPerson?.deathDate || '',
    isAlive: editPerson?.isAlive ?? true,
    occupation: editPerson?.occupation || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editPerson) {
      updatePerson(editPerson.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        deathDate: form.deathDate || undefined,
        isAlive: form.isAlive,
        occupation: form.occupation || undefined,
      });
    } else {
      addPerson({
        id: generateId(),
        firstName: form.firstName,
        lastName: form.lastName,
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
    setForm({ firstName: '', lastName: '', gender: 'male', birthDate: '', deathDate: '', isAlive: true, occupation: '' });
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e',
        borderRadius: '16px',
        padding: '24px',
        width: '400px',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #2a2a2a',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', color: '#fff', fontSize: '20px' }}>
          {editPerson ? '✏️ Sửa thành viên' : '👤 Thêm thành viên'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Tên *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="Nhập tên..."
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Họ *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="Nhập họ..."
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Giới tính</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: 'male', label: '👨 Nam', color: '#4a9eff' },
                { value: 'female', label: '👩 Nữ', color: '#ff69b4' },
                { value: 'other', label: '👤 Khác', color: '#a855f7' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: opt.value as any })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: form.gender === opt.value ? `${opt.color}20` : '#0a0a0a',
                    border: `2px solid ${form.gender === opt.value ? opt.color : '#2a2a2a'}`,
                    borderRadius: '8px',
                    color: form.gender === opt.value ? opt.color : '#888',
                    cursor: 'pointer',
                    fontSize: '14px',
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
              <input
                type="text"
                value={form.birthDate}
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder="YYYY"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Năm mất</label>
              <input
                type="text"
                value={form.deathDate}
                onChange={e => setForm({ ...form, deathDate: e.target.value })}
                disabled={form.isAlive}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: form.isAlive ? '#111' : '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: form.isAlive ? '#555' : '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
                placeholder="YYYY"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isAlive}
                onChange={e => setForm({ ...form, isAlive: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px' }}>Còn sống</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '14px' }}>Nghề nghiệp</label>
            <input
              type="text"
              value={form.occupation}
              onChange={e => setForm({ ...form, occupation: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              placeholder="Nhập nghề nghiệp..."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#2a2a2a',
                border: 'none',
                borderRadius: '8px',
                color: '#888',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#4a9eff',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {editPerson ? '💾 Lưu' : '➕ Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonModal;
