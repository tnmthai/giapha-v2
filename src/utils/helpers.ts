import type { Person, ParentChildRelationship, MarriageRelationship } from '../types';

// ==================== ID Generation ====================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== Age Calculation ====================

export function calculateAge(birthDate: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    return age - 1;
  }
  return age;
}

// ==================== Name Helpers ====================

export function getFullName(person: Person): string {
  const parts = [person.firstName, person.middleName, person.lastName].filter(Boolean);
  return parts.join(' ');
}

export function getDisplayName(person: Person): string {
  if (person.nickname) return person.nickname;
  return getFullName(person);
}

// ==================== Relationship Inference ====================

export function inferRelationship(
  person1Id: string,
  person2Id: string,
  parentChildRels: ParentChildRelationship[],
  marriageRels: MarriageRelationship[]
): string | null {
  // Direct parent-child
  const directParent = parentChildRels.find(
    r => r.parentId === person1Id && r.childId === person2Id
  );
  if (directParent) {
    switch (directParent.type) {
      case 'biological': return 'Parent (biological)';
      case 'adopted': return 'Adoptive parent';
      case 'foster': return 'Foster parent';
      case 'step': return 'Step-parent';
      case 'guardian': return 'Legal guardian';
    }
  }
  
  const directChild = parentChildRels.find(
    r => r.parentId === person2Id && r.childId === person1Id
  );
  if (directChild) {
    switch (directChild.type) {
      case 'biological': return 'Child (biological)';
      case 'adopted': return 'Adopted child';
      case 'foster': return 'Foster child';
      case 'step': return 'Stepchild';
    }
  }
  
  // Spouse
  const marriage = marriageRels.find(
    r => (r.person1Id === person1Id && r.person2Id === person2Id) ||
         (r.person1Id === person2Id && r.person2Id === person1Id)
  );
  if (marriage) {
    switch (marriage.status) {
      case 'married': return 'Spouse';
      case 'divorced': return 'Ex-spouse';
      case 'separated': return 'Separated spouse';
      case 'widowed': return 'Deceased spouse';
      default: return 'Partner';
    }
  }
  
  // Grandparent-grandchild
  for (const rel1 of parentChildRels) {
    if (rel1.parentId === person1Id) {
      for (const rel2 of parentChildRels) {
        if (rel2.parentId === rel1.childId && rel2.childId === person2Id) {
          return 'Grandparent';
        }
      }
    }
    if (rel1.childId === person1Id) {
      for (const rel2 of parentChildRels) {
        if (rel2.childId === rel1.parentId && rel2.parentId === person2Id) {
          return 'Grandchild';
        }
      }
    }
  }
  
  // Siblings (share parent)
  const person1Parents = parentChildRels.filter(r => r.childId === person1Id).map(r => r.parentId);
  const person2Parents = parentChildRels.filter(r => r.childId === person2Id).map(r => r.parentId);
  const sharedParents = person1Parents.filter(p => person2Parents.includes(p));
  
  if (sharedParents.length > 0) {
    return sharedParents.length === 2 ? 'Sibling' : 'Half-sibling';
  }
  
  // Uncle/Aunt (parent's sibling)
  // TODO: Check if person2 is a child of parent's sibling
  
  return null;
}

// ==================== Graph Traversal ====================

export function findRelationshipPath(
  startId: string,
  endId: string,
  parentChildRels: ParentChildRelationship[],
  marriageRels: MarriageRelationship[],
  maxDepth: number = 6
): string[] | null {
  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
  
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    
    if (id === endId) return path;
    if (path.length > maxDepth) continue;
    if (visited.has(id)) continue;
    visited.add(id);
    
    // Follow parent-child relationships
    for (const rel of parentChildRels) {
      if (rel.parentId === id && !visited.has(rel.childId)) {
        queue.push({ id: rel.childId, path: [...path, rel.childId] });
      }
      if (rel.childId === id && !visited.has(rel.parentId)) {
        queue.push({ id: rel.parentId, path: [...path, rel.parentId] });
      }
    }
    
    // Follow marriage relationships
    for (const rel of marriageRels) {
      if (rel.person1Id === id && !visited.has(rel.person2Id)) {
        queue.push({ id: rel.person2Id, path: [...path, rel.person2Id] });
      }
      if (rel.person2Id === id && !visited.has(rel.person1Id)) {
        queue.push({ id: rel.person1Id, path: [...path, rel.person1Id] });
      }
    }
  }
  
  return null;
}

// ==================== Kinship Calculator ====================

export function calculateKinship(
  person1Id: string,
  person2Id: string,
  parentChildRels: ParentChildRelationship[],
  marriageRels: MarriageRelationship[]
): { relationship: string; generationDiff: number; path: string[] } | null {
  const path = findRelationshipPath(person1Id, person2Id, parentChildRels, marriageRels);
  if (!path) return null;
  
  // Count generations (parent-child steps)
  let generationDiff = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const isParentChild = parentChildRels.some(
      r => (r.parentId === path[i] && r.childId === path[i + 1]) ||
           (r.parentId === path[i + 1] && r.childId === path[i])
    );
    if (isParentChild) {
      const isGoingDown = parentChildRels.some(
        r => r.parentId === path[i] && r.childId === path[i + 1]
      );
      generationDiff += isGoingDown ? 1 : -1;
    }
  }
  
  // Determine relationship name
  let relationship = 'Unknown';
  
  if (Math.abs(generationDiff) === 0) {
    // Same generation
    const isMarried = marriageRels.some(
      r => (r.person1Id === person1Id && r.person2Id === person2Id) ||
           (r.person1Id === person2Id && r.person2Id === person1Id)
    );
    if (isMarried) {
      relationship = 'Spouse';
    } else {
      relationship = 'Sibling/Cousin';
    }
  } else if (generationDiff === 1) {
    relationship = 'Child';
  } else if (generationDiff === -1) {
    relationship = 'Parent';
  } else if (generationDiff === 2) {
    relationship = 'Grandchild';
  } else if (generationDiff === -2) {
    relationship = 'Grandparent';
  } else if (generationDiff > 0) {
    relationship = `${'Great '.repeat(generationDiff - 2)}Grandchild`;
  } else {
    relationship = `${'Great '.repeat(Math.abs(generationDiff) - 2)}Grandparent`;
  }
  
  return {
    relationship,
    generationDiff,
    path
  };
}

// ==================== Layout Helpers ====================

export function getGenerations(
  persons: Map<string, Person>,
  parentChildRels: ParentChildRelationship[]
): Map<number, string[]> {
  const generations = new Map<number, string[]>();
  const assigned = new Map<string, number>();
  
  // Find root persons (no parents)
  const childIds = new Set(parentChildRels.map(r => r.childId));
  const roots = Array.from(persons.keys()).filter(id => !childIds.has(id));
  
  // BFS to assign generations
  const queue: { id: string; gen: number }[] = roots.map(id => ({ id, gen: 0 }));
  
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (assigned.has(id)) continue;
    
    assigned.set(id, gen);
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(id);
    
    // Find children
    const children = parentChildRels.filter(r => r.parentId === id);
    for (const child of children) {
      if (!assigned.has(child.childId)) {
        queue.push({ id: child.childId, gen: gen + 1 });
      }
    }
  }
  
  // Assign unassigned persons to generation 0
  for (const id of persons.keys()) {
    if (!assigned.has(id)) {
      assigned.set(id, 0);
      if (!generations.has(0)) generations.set(0, []);
      generations.get(0)!.push(id);
    }
  }
  
  return generations;
}
