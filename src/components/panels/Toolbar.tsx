import React from 'react';
import { useFamilyTreeStore } from '../../stores/familyTreeStore';

interface Props {
  onAddPerson: () => void;
  onEditPerson: () => void;
}

const Toolbar: React.FC<Props> = ({ onAddPerson, onEditPerson }) => {
  const { selectedPersonIds, deletePerson, persons, exportToJSON } = useFamilyTreeStore();

  const selectedId = selectedPersonIds[0];
  const selectedPerson = selectedId ? persons.get(selectedId) : null;

  const handleDelete = () => {
    if (!selectedId) return;
    const person = persons.get(selectedId);
    if (!person) return;
    if (confirm(`Xóa ${person.firstName} ${person.lastName}?`)) {
      deletePerson(selectedId);
    }
  };

  const handleExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-tree.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const btnStyle = (active = false, color = '#4a9eff') => ({
    padding: '8px 12px',
    background: active ? `${color}20` : '#1a1a2e',
    border: `1px solid ${active ? color : '#2a2a2a'}`,
    borderRadius: '8px',
    color: active ? color : '#888',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  });

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '12px',
      zIndex: 10,
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
    }}>
      <button style={btnStyle()} onClick={onAddPerson}>
        👤 Thêm mới
      </button>
      
      <button 
        style={btnStyle(!!selectedPerson, '#4a9eff')} 
        onClick={onEditPerson}
        disabled={!selectedPerson}
      >
        ✏️ Sửa
      </button>
      
      <button 
        style={btnStyle(!!selectedPerson, '#ff4d4f')} 
        onClick={handleDelete}
        disabled={!selectedPerson}
      >
        🗑️ Xóa
      </button>

      <div style={{ width: '1px', background: '#2a2a2a', margin: '0 4px' }} />

      <button style={btnStyle()} onClick={handleExport}>
        📥 Export JSON
      </button>

      {selectedPerson && (
        <div style={{
          padding: '8px 12px',
          background: '#1a1a2e',
          border: '1px solid #4a9eff',
          borderRadius: '8px',
          color: '#4a9eff',
          fontSize: '13px',
        }}>
          Đã chọn: {selectedPerson.firstName} {selectedPerson.lastName}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
