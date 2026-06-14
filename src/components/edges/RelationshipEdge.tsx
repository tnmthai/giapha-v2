import React from 'react';
import { BaseEdge, getBezierPath } from '@xyflow/react';

interface RelationshipEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: any;
  targetPosition?: any;
  data?: {
    type?: string;
    label?: string;
    style?: string;
  };
  style?: React.CSSProperties;
}

const RelationshipEdge: React.FC<RelationshipEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const getEdgeColor = () => {
    switch (data?.type) {
      case 'parent_child': return '#4a9eff';
      case 'marriage': return '#ff69b4';
      case 'adopted': return '#4ade80';
      case 'foster': return '#fbbf24';
      case 'step': return '#a78bfa';
      default: return '#6b7280';
    }
  };

  const getStrokeDasharray = () => {
    switch (data?.type) {
      case 'adopted': return '8 4';
      case 'foster': return '4 4';
      case 'step': return '6 4';
      default: return 'none';
    }
  };

  const color = getEdgeColor();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: getStrokeDasharray(),
          ...style,
        }}
      />
      {data?.label && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 8}
          textAnchor="middle"
          style={{
            fontSize: '10px',
            fill: color,
            fontWeight: 'bold',
          }}
        >
          {data.label}
        </text>
      )}
    </>
  );
};

export default RelationshipEdge;
