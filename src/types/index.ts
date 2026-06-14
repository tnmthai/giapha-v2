// ==================== Person Types ====================

export interface Person {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickname?: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deathDate?: string;
  isAlive: boolean;
  
  // Extended info
  photo?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  biography?: string;
  notes?: string;
  
  // Medical
  bloodType?: string;
  medicalConditions?: string;
  geneticDiseases?: string;
  allergies?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  tags: string[];
  customFields: Record<string, string>;
}

// ==================== Relationship Types ====================

export type ParentChildType = 
  | 'biological' 
  | 'adopted' 
  | 'foster' 
  | 'step' 
  | 'guardian';

export type MarriageType = 
  | 'marriage' 
  | 'civil_union' 
  | 'partnership' 
  | 'engagement';

export type MarriageStatus = 
  | 'married' 
  | 'divorced' 
  | 'separated' 
  | 'widowed' 
  | 'annulled' 
  | 'active';

export type SiblingType = 
  | 'full' 
  | 'half_paternal' 
  | 'half_maternal' 
  | 'step' 
  | 'adopted';

export interface ParentChildRelationship {
  id: string;
  parentId: string;
  childId: string;
  type: ParentChildType;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface MarriageRelationship {
  id: string;
  person1Id: string;
  person2Id: string;
  type: MarriageType;
  status: MarriageStatus;
  startDate?: string;
  endDate?: string;
  location?: string;
  notes?: string;
}

export interface SiblingRelationship {
  id: string;
  person1Id: string;
  person2Id: string;
  type: SiblingType;
  notes?: string;
}

// ==================== Node Types (React Flow) ====================

export interface PersonNodeData {
  person: Person;
  isSelected?: boolean;
  isHighlighted?: boolean;
}

export interface MarriageNodeData {
  marriage: MarriageRelationship;
  person1?: Person;
  person2?: Person;
}

// ==================== Edge Types ====================

export type RelationshipEdgeType = 
  | 'parent_child' 
  | 'marriage' 
  | 'sibling' 
  | 'adopted' 
  | 'foster' 
  | 'step' 
  | 'guardian';

export interface RelationshipEdgeData {
  type: RelationshipEdgeType;
  relationshipId: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

// ==================== Family Tree ====================

export interface FamilyTree {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  personCount: number;
}

// ==================== Kinship ====================

export interface KinshipResult {
  relationship: string;
  path: string[];
  generationDifference: number;
  bloodPercentage?: number;
  explanation: string;
}

// ==================== Search ====================

export interface SearchFilters {
  query?: string;
  gender?: 'male' | 'female' | 'other';
  minAge?: number;
  maxAge?: number;
  birthYear?: number;
  isAlive?: boolean;
  tags?: string[];
}

// ==================== Layout ====================

export type LayoutType = 
  | 'tree'        // Traditional top-down
  | 'descendant'  // Ancestor → descendants
  | 'ancestor'    // Person → ancestors
  | 'radial'      // Circular layout
  | 'fan'         // Fan chart
  | 'timeline';   // Chronological

// ==================== Theme ====================

export type ThemeType = 'light' | 'dark' | 'classic' | 'modern' | 'heritage';

// ==================== Export ====================

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'jpeg' | 'json' | 'gedcom';

// ==================== History ====================

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  data: any;
}

// ==================== Type Extensions ====================

// Add index signature to PersonNodeData for React Flow compatibility
export interface PersonNodeDataIndex extends PersonNodeData {
  [key: string]: unknown;
}
