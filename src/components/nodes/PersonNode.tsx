import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface PersonNodeProps {
  data: {
    person: {
      id: string;
      firstName: string;
      lastName: string;
      gender: string;
      birthDate?: string;
      deathDate?: string;
      isAlive: boolean;
      occupation?: string;
      photo?: string;
    };
  };
  selected?: boolean;
}

const PersonNode: React.FC<PersonNodeProps> = ({ data, selected }) => {
  const { person } = data;
  
  const fullName = `${person.lastName} ${person.firstName}`.trim();
  const genderColor = person.gender === 'female' ? '#ff69b4' : '#4a9eff';
  const bgColor = '#1a1a2e';
  const borderColor = selected ? '#4a9eff' : genderColor;
  
  let age: number | null = null;
  if (person.birthDate) {
    const birth = new Date(person.birthDate);
    const end = person.deathDate ? new Date(person.deathDate) : new Date();
    age = end.getFullYear() - birth.getFullYear();
  }
  
  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '12px',
        minWidth: '180px',
        maxWidth: '220px',
        cursor: 'pointer',
        boxShadow: selected 
          ? `0 0 0 2px ${genderColor}40, 0 4px 12px rgba(0,0,0,0.3)` 
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="parent"
        style={{ background: genderColor, width: '10px', height: '10px', border: `2px solid ${bgColor}` }}
      />
      
      {/* Avatar */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: `${genderColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto',
            border: `2px solid ${genderColor}`,
          }}
        >
          {person.gender === 'female' ? '👩' : '👨'}
        </div>
      </div>
      
      {/* Name */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: '#ffffff', marginBottom: '4px' }}>
        {fullName}
      </div>
      
      {/* Years */}
      {person.birthDate && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
          {person.birthDate}{person.deathDate ? ` - ${person.deathDate}` : ''}
          {!person.isAlive && ' ✝'}
        </div>
      )}
      
      {/* Occupation */}
      {person.occupation && (
        <div style={{ textAlign: 'center', fontSize: '10px', color: genderColor, marginTop: '4px', fontStyle: 'italic' }}>
          {person.occupation}
        </div>
      )}
      
      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="child"
        style={{ background: genderColor, width: '10px', height: '10px', border: `2px solid ${bgColor}` }}
      />
      
      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-in"
        style={{ background: '#ff69b4', width: '8px', height: '8px', border: `2px solid ${bgColor}`, top: '50%' }}
      />
      
      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-out"
        style={{ background: '#ff69b4', width: '8px', height: '8px', border: `2px solid ${bgColor}`, top: '50%' }}
      />
    </div>
  );
};

export default memo(PersonNode);
