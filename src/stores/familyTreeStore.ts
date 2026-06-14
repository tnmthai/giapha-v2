import { create } from 'zustand';
import type { 
  Person, 
  ParentChildRelationship, 
  MarriageRelationship, 
  SiblingRelationship,
  FamilyTree,
  HistoryEntry,
  SearchFilters,
  LayoutType,
  ThemeType
} from '../types';

// API helper
const getAuthToken = () => localStorage.getItem('token') || '';

async function apiCall(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ==================== State Interface ====================

interface FamilyTreeState {
  // Current tree
  currentTree: FamilyTree | null;
  
  // Data
  persons: Map<string, Person>;
  parentChildRelations: Map<string, ParentChildRelationship>;
  marriageRelations: Map<string, MarriageRelationship>;
  siblingRelations: Map<string, SiblingRelationship>;
  
  // UI State
  selectedPersonIds: string[];
  highlightedPersonIds: string[];
  searchFilters: SearchFilters;
  currentLayout: LayoutType;
  theme: ThemeType;
  showGrid: boolean;
  snapToGrid: boolean;
  
  // History
  history: HistoryEntry[];
  historyIndex: number;
  
  // Actions
  setTree: (tree: FamilyTree) => void;
  
  // Person CRUD
  addPerson: (person: Person) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  getPerson: (id: string) => Person | undefined;
  
  // Relationships
  addParentChild: (rel: ParentChildRelationship) => void;
  addMarriage: (rel: MarriageRelationship) => void;
  addSibling: (rel: SiblingRelationship) => void;
  removeRelationship: (id: string, type: string) => void;
  
  // Selection
  selectPerson: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  
  // Search
  setSearchFilters: (filters: SearchFilters) => void;
  searchPersons: (filters: SearchFilters) => Person[];
  
  // Layout
  setLayout: (layout: LayoutType) => void;
  setTheme: (theme: ThemeType) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  
  // History
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  undo: () => void;
  redo: () => void;
  
  // Import/Export
  exportToJSON: () => string;
  importFromJSON: (json: string) => void;
}

// ==================== Store ====================

export const useFamilyTreeStore = create<FamilyTreeState>((set, get) => ({
  // Initial state
  currentTree: null,
  persons: new Map(),
  parentChildRelations: new Map(),
  marriageRelations: new Map(),
  siblingRelations: new Map(),
  selectedPersonIds: [],
  highlightedPersonIds: [],
  searchFilters: {},
  currentLayout: 'tree',
  theme: 'dark',
  showGrid: true,
  snapToGrid: false,
  history: [],
  historyIndex: -1,
  
  // Set current tree
  setTree: (tree) => set({ currentTree: tree }),
  
  // Person CRUD
  addPerson: (person) => {
    set((state) => {
      const newPersons = new Map(state.persons);
      newPersons.set(person.id, person);
      return { persons: newPersons };
    });
    // Save to backend
    const fullName = `${person.lastName} ${person.firstName}`.trim();
    apiCall('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: fullName,
        birth_year: person.birthDate ? parseInt(person.birthDate) : null,
        death_year: person.deathDate ? parseInt(person.deathDate) : null,
        gender: person.gender,
        occupation: person.occupation,
      }),
    }).then(result => {
      if (result) {
        // Store the DB id in customFields
        set((state) => {
          const newPersons = new Map(state.persons);
          const existing = newPersons.get(person.id);
          if (existing) {
            newPersons.set(person.id, { ...existing, customFields: { ...existing.customFields, dbId: result.id } });
          }
          return { persons: newPersons };
        });
      }
    });
    get().addHistoryEntry({
      action: 'add_person',
      description: `Added ${person.firstName} ${person.lastName}`,
      data: { personId: person.id }
    });
  },
  
  updatePerson: (id, updates) => {
    set((state) => {
      const newPersons = new Map(state.persons);
      const existing = newPersons.get(id);
      if (existing) {
        newPersons.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
        // Save to backend
        const updated = { ...existing, ...updates };
        const fullName = `${updated.lastName} ${updated.firstName}`.trim();
        const dbId = existing.customFields?.dbId;
        if (dbId) {
          apiCall(`/api/members/${dbId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: fullName,
              birth_year: updated.birthDate ? parseInt(updated.birthDate) : null,
              death_year: updated.deathDate ? parseInt(updated.deathDate) : null,
              gender: updated.gender,
              occupation: updated.occupation,
            }),
          });
        }
      }
      return { persons: newPersons };
    });
    get().addHistoryEntry({
      action: 'update_person',
      description: `Updated person ${id}`,
      data: { personId: id, updates }
    });
  },
  
  deletePerson: (id) => {
    const person = get().persons.get(id);
    const dbId = person?.customFields?.dbId;
    if (dbId) {
      apiCall(`/api/members/${dbId}`, { method: 'DELETE' });
    }
    set((state) => {
      const newPersons = new Map(state.persons);
      newPersons.delete(id);
      
      const newParentChild = new Map(state.parentChildRelations);
      newParentChild.forEach((rel, key) => {
        if (rel.parentId === id || rel.childId === id) {
          newParentChild.delete(key);
        }
      });
      
      const newMarriage = new Map(state.marriageRelations);
      newMarriage.forEach((rel, key) => {
        if (rel.person1Id === id || rel.person2Id === id) {
          newMarriage.delete(key);
        }
      });
      
      const newSibling = new Map(state.siblingRelations);
      newSibling.forEach((rel, key) => {
        if (rel.person1Id === id || rel.person2Id === id) {
          newSibling.delete(key);
        }
      });
      
      return { 
        persons: newPersons,
        parentChildRelations: newParentChild,
        marriageRelations: newMarriage,
        siblingRelations: newSibling
      };
    });
    get().addHistoryEntry({
      action: 'delete_person',
      description: `Deleted person ${id}`,
      data: { personId: id }
    });
  },
  
  getPerson: (id) => get().persons.get(id),
  
  // Relationships
  addParentChild: (rel) => {
    set((state) => {
      const newRels = new Map(state.parentChildRelations);
      newRels.set(rel.id, rel);
      return { parentChildRelations: newRels };
    });
    // Save to backend
    const parentPerson = get().persons.get(rel.parentId);
    const childPerson = get().persons.get(rel.childId);
    const fromDbId = parentPerson?.customFields?.dbId;
    const toDbId = childPerson?.customFields?.dbId;
    if (fromDbId && toDbId) {
      apiCall('/api/relationships', {
        method: 'POST',
        body: JSON.stringify({ from_id: fromDbId, to_id: toDbId, type: 'parent_child', label: 'Con' }),
      });
    }
    get().addHistoryEntry({
      action: 'add_relationship',
      description: `Added parent-child relationship`,
      data: { relationshipId: rel.id }
    });
  },
  
  addMarriage: (rel) => {
    set((state) => {
      const newRels = new Map(state.marriageRelations);
      newRels.set(rel.id, rel);
      return { marriageRelations: newRels };
    });
    // Save to backend
    const p1 = get().persons.get(rel.person1Id);
    const p2 = get().persons.get(rel.person2Id);
    const dbId1 = p1?.customFields?.dbId;
    const dbId2 = p2?.customFields?.dbId;
    if (dbId1 && dbId2) {
      apiCall('/api/relationships', {
        method: 'POST',
        body: JSON.stringify({ from_id: dbId1, to_id: dbId2, type: 'marriage', label: 'Vợ/Chồng' }),
      });
    }
    get().addHistoryEntry({
      action: 'add_marriage',
      description: `Added marriage relationship`,
      data: { relationshipId: rel.id }
    });
  },
  
  addSibling: (rel) => {
    set((state) => {
      const newRels = new Map(state.siblingRelations);
      newRels.set(rel.id, rel);
      return { siblingRelations: newRels };
    });
  },
  
  removeRelationship: (id, type) => {
    set((state) => {
      if (type === 'parent_child') {
        const newRels = new Map(state.parentChildRelations);
        newRels.delete(id);
        return { parentChildRelations: newRels };
      } else if (type === 'marriage') {
        const newRels = new Map(state.marriageRelations);
        newRels.delete(id);
        return { marriageRelations: newRels };
      } else if (type === 'sibling') {
        const newRels = new Map(state.siblingRelations);
        newRels.delete(id);
        return { siblingRelations: newRels };
      }
      return {};
    });
  },
  
  // Selection
  selectPerson: (id) => set({ selectedPersonIds: [id] }),
  selectMultiple: (ids) => set({ selectedPersonIds: ids }),
  clearSelection: () => set({ selectedPersonIds: [], highlightedPersonIds: [] }),
  
  // Search
  setSearchFilters: (filters) => set({ searchFilters: filters }),
  
  searchPersons: (filters) => {
    const { persons } = get();
    let results = Array.from(persons.values());
    
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(p => 
        p.firstName.toLowerCase().includes(query) ||
        p.lastName.toLowerCase().includes(query) ||
        p.nickname?.toLowerCase().includes(query) ||
        p.occupation?.toLowerCase().includes(query) ||
        p.notes?.toLowerCase().includes(query)
      );
    }
    
    if (filters.gender) {
      results = results.filter(p => p.gender === filters.gender);
    }
    
    if (filters.isAlive !== undefined) {
      results = results.filter(p => p.isAlive === filters.isAlive);
    }
    
    if (filters.minAge || filters.maxAge) {
      results = results.filter(p => {
        if (!p.birthDate) return false;
        const age = new Date().getFullYear() - new Date(p.birthDate).getFullYear();
        if (filters.minAge && age < filters.minAge) return false;
        if (filters.maxAge && age > filters.maxAge) return false;
        return true;
      });
    }
    
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }
    
    return results;
  },
  
  // Layout
  setLayout: (layout) => set({ currentLayout: layout }),
  setTheme: (theme) => set({ theme }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  
  // History
  addHistoryEntry: (entry) => {
    set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: `history-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newEntry];
      return { 
        history: newHistory, 
        historyIndex: newHistory.length - 1 
      };
    });
  },
  
  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        return { historyIndex: state.historyIndex - 1 };
      }
      return {};
    });
  },
  
  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        return { historyIndex: state.historyIndex + 1 };
      }
      return {};
    });
  },
  
  // Import/Export
  exportToJSON: () => {
    const state = get();
    const data = {
      tree: state.currentTree,
      persons: Array.from(state.persons.values()),
      parentChildRelations: Array.from(state.parentChildRelations.values()),
      marriageRelations: Array.from(state.marriageRelations.values()),
      siblingRelations: Array.from(state.siblingRelations.values())
    };
    return JSON.stringify(data, null, 2);
  },
  
  importFromJSON: (json) => {
    try {
      const data = JSON.parse(json);
      
      const persons = new Map<string, Person>();
      data.persons?.forEach((p: Person) => persons.set(p.id, p));
      
      const parentChildRelations = new Map<string, ParentChildRelationship>();
      data.parentChildRelations?.forEach((r: ParentChildRelationship) => parentChildRelations.set(r.id, r));
      
      const marriageRelations = new Map<string, MarriageRelationship>();
      data.marriageRelations?.forEach((r: MarriageRelationship) => marriageRelations.set(r.id, r));
      
      const siblingRelations = new Map<string, SiblingRelationship>();
      data.siblingRelations?.forEach((r: SiblingRelationship) => siblingRelations.set(r.id, r));
      
      set({
        currentTree: data.tree || null,
        persons,
        parentChildRelations,
        marriageRelations,
        siblingRelations
      });
    } catch (error) {
      console.error('Failed to import JSON:', error);
    }
  }
}));
