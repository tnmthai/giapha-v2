import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PersonNode from './nodes/PersonNode';
import RelationshipEdge from './edges/RelationshipEdge';
import { useFamilyTreeStore } from '../stores/familyTreeStore';
import { generateId, getGenerations } from '../utils/helpers';

const nodeTypes = { person: PersonNode };
const edgeTypes = { relationship: RelationshipEdge };

const FamilyTreeCanvas: React.FC = () => {
  const {
    persons,
    parentChildRelations,
    marriageRelations,
    showGrid,
    theme,
    addParentChild,
    addMarriage,
    selectPerson,
  } = useFamilyTreeStore();

  const initialNodes = useMemo(() => {
    const nodes: Node[] = [];
    const generations = getGenerations(persons, Array.from(parentChildRelations.values()));
    
    const CARD_W = 200;
    const CARD_H = 150;
    const H_GAP = 60;
    const V_GAP = 100;

    generations.forEach((personIds: string[], genIndex: number) => {
      const y = genIndex * (CARD_H + V_GAP) + 50;
      const totalWidth = personIds.length * (CARD_W + H_GAP) - H_GAP;
      const startX = Math.max(50, (1200 - totalWidth) / 2);

      personIds.forEach((personId: string, index: number) => {
        const person = persons.get(personId);
        if (!person) return;

        nodes.push({
          id: personId,
          type: 'person',
          position: { x: startX + index * (CARD_W + H_GAP), y },
          data: { person },
        });
      });
    });

    return nodes;
  }, [persons, parentChildRelations]);

  const initialEdges = useMemo(() => {
    const edges: any[] = [];

    parentChildRelations.forEach((rel) => {
      edges.push({
        id: rel.id,
        source: rel.parentId,
        target: rel.childId,
        sourceHandle: 'child',
        targetHandle: 'parent',
        type: 'relationship',
        data: {
          type: 'parent_child',
          label: rel.type !== 'biological' ? rel.type : undefined,
        },
      });
    });

    marriageRelations.forEach((rel) => {
      edges.push({
        id: rel.id,
        source: rel.person1Id,
        target: rel.person2Id,
        sourceHandle: 'spouse-out',
        targetHandle: 'spouse-in',
        type: 'relationship',
        data: {
          type: 'marriage',
          label: rel.status !== 'married' ? rel.status : undefined,
        },
      });
    });

    return edges;
  }, [parentChildRelations, marriageRelations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when store data changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      // Ask user for relationship type
      const relType = prompt(
        'Chọn loại quan hệ:\n1 = Vợ/Chồng\n2 = Con (mặc định)\n\nNhập số:',
        '2'
      );
      
      if (relType === '1') {
        // Marriage relationship
        const newEdge = {
          ...params,
          id: generateId(),
          type: 'relationship',
          data: { type: 'marriage', label: 'Vợ/Chồng' },
        };
        setEdges((eds) => addEdge(newEdge, eds));
        addMarriage({
          id: generateId(),
          person1Id: params.source,
          person2Id: params.target,
          type: 'marriage',
          status: 'married',
        });
      } else {
        // Parent-child relationship
        const newEdge = {
          ...params,
          id: generateId(),
          type: 'relationship',
          data: { type: 'parent_child', label: 'Con' },
        };
        setEdges((eds) => addEdge(newEdge, eds));
        addParentChild({
          id: generateId(),
          parentId: params.source,
          childId: params.target,
          type: 'biological',
        });
      }
    },
    [setEdges, addParentChild, addMarriage]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
    const label = prompt('Nhập loại quan hệ (vợ/chồng/con/cha/mẹ/...):', edge.data?.label || '');
    if (label !== null) {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id ? { ...e, data: { ...e.data, label } } : e
        )
      );
    }
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    selectPerson(node.id);
  }, [selectPerson]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: any) => {
    const person = persons.get(node.id);
    if (person) {
      // This will be handled by the App component through state
      window.dispatchEvent(new CustomEvent('edit-person', { detail: person }));
    }
  }, [persons]);

  const bgColor = theme === 'dark' ? '#0a0a0a' : '#f8f8f8';

  return (
    <div style={{ width: '100%', height: '100vh', background: bgColor }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={5}
        defaultEdgeOptions={{ type: 'relationship', animated: false }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={theme === 'dark' ? '#1a1a2e' : '#e0e0e0'}
          />
        )}
        <Controls />
        <MiniMap
          nodeColor={(node: any) => {
            const person = node.data?.person;
            if (!person) return '#666';
            return person.gender === 'female' ? '#ff69b4' : '#4a9eff';
          }}
          maskColor="rgba(0,0,0,0.5)"
          style={{ background: theme === 'dark' ? '#1a1a2e' : '#ffffff' }}
        />
      </ReactFlow>

      {/* Floating add button */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('add-person'))}
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#4a9eff',
          border: 'none',
          color: '#fff',
          fontSize: '28px',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(74, 158, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        title="Thêm thành viên"
      >
        +
      </button>
    </div>
  );
};

export default FamilyTreeCanvas;
