import React from 'react';
import { useFamilyTreeStore } from '../../stores/familyTreeStore';
import { getFullName, calculateAge } from '../../utils/helpers';

interface Props {
  onEdit: () => void;
}

const DetailPanel: React.FC<Props> = ({ onEdit }) => {
  const { selectedPersonIds, persons, parentChildRelations, marriageRelations } = useFamilyTreeStore();
  
  const selectedId = selectedPersonIds[0];
  const person = selectedId ? persons.get(selectedId) : null;
  
  if (!person) return null;
  
  const age = calculateAge(person.birthDate || '', person.deathDate);
  const fullName = getFullName(person);
  const genderColor = person.gender === 'female' ? '#ff69b4' : '#4a9eff';
  
  // Find parents
  const parentRels = Array.from(parentChildRelations.values()).filter(r => r.childId === selectedId);
  const parents = parentRels.map(r => persons.get(r.parentId)).filter(Boolean);
  
  // Find children
  const childRels = Array.from(parentChildRelations.values()).filter(r => r.parentId === selectedId);
  const children = childRels.map(r => persons.get(r.childId)).filter(Boolean);
  
  // Find spouses
  const spouseRels = Array.from(marriageRelations.values()).filter(
    r => r.person1Id === selectedId || r.person2Id === selectedId
  );
  const spouses = spouseRels.map(r => {
    const spouseId = r.person1Id === selectedId ? r.person2Id : r.person1Id;
    return persons.get(spouseId);
  }).filter(Boolean);

  const panelStyle = {
    background: '#1a1a2e',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  };

  const labelStyle = {
    color: '#888',
    fontSize: '12px',
    marginBottom: '4px',
  };

  const valueStyle = {
    color: '#fff',
    fontSize: '14px',
  };

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      right: '12px',
      zIndex: 10,
      width: '280px',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        ...panelStyle,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: `${genderColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          border: `2px solid ${genderColor}`,
          flexShrink: 0,
        }}>
          {person.gender === 'female' ? '👩' : '👨'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>{fullName}</div>
          <div style={{ color: '#888', fontSize: '12px' }}>
            {person.birthDate && `${person.birthDate}`}
            {age !== null && ` (${age} tuổi)`}
            {!person.isAlive && ' ✝'}
          </div>
        </div>
        <button
          onClick={onEdit}
          style={{
            padding: '6px 10px',
            background: '#4a9eff20',
            border: '1px solid #4a9eff',
            borderRadius: '6px',
            color: '#4a9eff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ✏️
        </button>
      </div>

      {/* Details */}
      <div style={panelStyle}>
        <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px' }}>Thông tin</h3>
        
        {person.occupation && (
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Nghề nghiệp</div>
            <div style={valueStyle}>{person.occupation}</div>
          </div>
        )}
        
        {person.birthDate && (
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Năm sinh</div>
            <div style={valueStyle}>{person.birthDate}</div>
          </div>
        )}
        
        {person.deathDate && (
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Năm mất</div>
            <div style={valueStyle}>{person.deathDate}</div>
          </div>
        )}
        
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>Trạng thái</div>
          <div style={{ ...valueStyle, color: person.isAlive ? '#4ade80' : '#ff4d4f' }}>
            {person.isAlive ? '✅ Còn sống' : '✝️ Đã mất'}
          </div>
        </div>
      </div>

      {/* Parents */}
      {parents.length > 0 && (
        <div style={panelStyle}>
          <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px' }}>👨‍👩‍👧 Cha mẹ</h3>
          {parents.map(p => p && (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 0',
              borderBottom: '1px solid #2a2a2a',
            }}>
              <span style={{ fontSize: '16px' }}>{p.gender === 'female' ? '👩' : '👨'}</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{getFullName(p)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spouses */}
      {spouses.length > 0 && (
        <div style={panelStyle}>
          <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px' }}>💑 Vợ/chồng</h3>
          {spouses.map(s => s && (
            <div key={s.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 0',
              borderBottom: '1px solid #2a2a2a',
            }}>
              <span style={{ fontSize: '16px' }}>{s.gender === 'female' ? '👩' : '👨'}</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{getFullName(s)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Children */}
      {children.length > 0 && (
        <div style={panelStyle}>
          <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px' }}>👶 Con cái</h3>
          {children.map(c => c && (
            <div key={c.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 0',
              borderBottom: '1px solid #2a2a2a',
            }}>
              <span style={{ fontSize: '16px' }}>{c.gender === 'female' ? '👩' : '👨'}</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{getFullName(c)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DetailPanel;
