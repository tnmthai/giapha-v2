import React, { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ThemeProvider, createTheme, CssBaseline, Box, IconButton, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import FamilyTreeCanvas from './components/FamilyTreeCanvas';
import Toolbar from './components/panels/Toolbar';
import DetailPanel from './components/panels/DetailPanel';
import PersonModal from './components/modals/PersonModal';
import AuthScreen from './components/AuthScreen';
import { useFamilyTreeStore } from './stores/familyTreeStore';
import { generateId } from './utils/helpers';
import type { Person } from './types';

// ==================== API Helper ====================

let authToken = localStorage.getItem('token') || '';

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  return res.json();
}

// ==================== Theme ====================

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4a9eff' },
    secondary: { main: '#ff69b4' },
    background: { default: '#0a0a0a', paper: '#1a1a2e' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// ==================== App Component ====================

const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { selectedPersonIds, persons } = useFamilyTreeStore();

  // Load data from backend when user logs in
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      try {
        const [members, relationships] = await Promise.all([
          apiFetch('/api/members'),
          apiFetch('/api/relationships'),
        ]);
        
        const store = useFamilyTreeStore.getState();
        
        // Clear existing data
        store.persons.clear();
        store.parentChildRelations.clear();
        store.marriageRelations.clear();
        
        // Set tree
        store.setTree({
          id: `tree-${user.id}`,
          name: `${user.full_name || user.username}'s Family`,
          description: 'Family tree',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          personCount: members.length,
        });
        
        // Add members
        const idMap = new Map<number, string>();
        for (const m of members) {
          const newId = generateId();
          idMap.set(m.id, newId);
          store.addPerson({
            id: newId,
            firstName: m.name.split(' ').pop() || m.name,
            lastName: m.name.split(' ').slice(0, -1).join(' ') || '',
            gender: (m.gender as 'male' | 'female') || 'male',
            birthDate: m.birth_year ? String(m.birth_year) : '',
            deathDate: m.death_year ? String(m.death_year) : undefined,
            isAlive: !m.death_year,
            occupation: m.occupation || undefined,
            createdAt: m.created_at || new Date().toISOString(),
            updatedAt: m.created_at || new Date().toISOString(),
            tags: [],
            customFields: { dbId: m.id },
          });
        }
        
        // Add relationships
        for (const r of relationships) {
          const fromId = idMap.get(r.from_id);
          const toId = idMap.get(r.to_id);
          if (!fromId || !toId) continue;
          
          if (r.type === 'marriage') {
            store.addMarriage({
              id: generateId(),
              person1Id: fromId,
              person2Id: toId,
              type: 'marriage',
              status: 'married',
            });
          } else {
            store.addParentChild({
              id: generateId(),
              parentId: fromId,
              childId: toId,
              type: r.type || 'biological',
            });
          }
        }
        
        if (members.length === 0) {
          // No data yet, create demo
          createDemoData();
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        createDemoData();
      }
    };
    
    loadData();
  }, [user]);

  // Listen for events from canvas
  useEffect(() => {
    const editHandler = () => {
      const { selectedPersonIds } = useFamilyTreeStore.getState();
      if (selectedPersonIds.length > 0) setShowEditModal(true);
    };
    const addHandler = () => setShowAddModal(true);
    window.addEventListener('edit-person', editHandler);
    window.addEventListener('add-person', addHandler);
    return () => {
      window.removeEventListener('edit-person', editHandler);
      window.removeEventListener('add-person', addHandler);
    };
  }, []);

  const handleAuth = (userData: any, token: string) => {
    authToken = token;
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = '';
    setUser(null);
  };

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  const selectedPerson = selectedPersonIds[0] ? persons.get(selectedPersonIds[0]) : undefined;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ReactFlowProvider>
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
          <FamilyTreeCanvas />
          
          {/* User info + logout */}
          <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 1, zIndex: 10 }}>
            <Typography variant="caption" sx={{ color: '#666' }}>
              {user.full_name || user.username}
            </Typography>
            <IconButton size="small" onClick={handleLogout} sx={{ color: '#666' }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Toolbar
            onAddPerson={() => setShowAddModal(true)}
            onEditPerson={() => setShowEditModal(true)}
          />
          <DetailPanel onEdit={() => setShowEditModal(true)} />
        </div>
        
        <PersonModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
        />
        
        <PersonModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          editPerson={selectedPerson}
        />
      </ReactFlowProvider>
    </ThemeProvider>
  );
};

// ==================== Demo Data ====================

function createDemoData() {
  const store = useFamilyTreeStore.getState();
  
  store.setTree({
    id: 'demo-tree',
    name: 'Trần Family',
    description: 'Demo family tree',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    personCount: 0,
  });

  const createPerson = (
    firstName: string, lastName: string, gender: 'male' | 'female',
    birthDate: string, deathDate?: string, occupation?: string
  ): Person => {
    const person: Person = {
      id: generateId(), firstName, lastName, gender, birthDate, deathDate,
      isAlive: !deathDate, occupation,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      tags: [], customFields: {},
    };
    store.addPerson(person);
    return person;
  };

  const g1h = createPerson('Đức', 'Trần', 'male', '1920', '1995', 'Farmer');
  const g1w = createPerson('Thị Lan', 'Nguyễn', 'female', '1925', '2000', 'Homemaker');
  const g2h = createPerson('Văn Long', 'Trần', 'male', '1945', '2010', 'Teacher');
  const g2w = createPerson('Thị Hoa', 'Lê', 'female', '1948', undefined, 'Nurse');
  const g2u = createPerson('Văn Hùng', 'Trần', 'male', '1950', undefined, 'Engineer');
  const g2a = createPerson('Thị Mai', 'Phạm', 'female', '1952', undefined, 'Teacher');
  const g3f = createPerson('Minh Thái', 'Trần', 'male', '1975', undefined, 'Developer');
  const g3m = createPerson('Thị Bích', 'Nguyễn', 'female', '1978', undefined, 'Designer');
  const g3u = createPerson('Minh Đức', 'Trần', 'male', '1980', undefined, 'Doctor');
  const g3a = createPerson('Thị Thanh', 'Đỗ', 'female', '1982', undefined, 'Lawyer');
  const g4s = createPerson('Quốc Bảo', 'Trần', 'male', '2000', undefined, 'Student');
  const g4d = createPerson('Quốc An', 'Trần', 'female', '2003', undefined, 'Student');

  const addMarriage = (p1: Person, p2: Person) => {
    store.addMarriage({ id: generateId(), person1Id: p1.id, person2Id: p2.id, type: 'marriage', status: 'married' });
  };
  addMarriage(g1h, g1w);
  addMarriage(g2h, g2w);
  addMarriage(g2u, g2a);
  addMarriage(g3f, g3m);
  addMarriage(g3u, g3a);

  const addParent = (parent: Person, child: Person) => {
    store.addParentChild({ id: generateId(), parentId: parent.id, childId: child.id, type: 'biological' });
  };
  addParent(g1h, g2h); addParent(g1w, g2h);
  addParent(g1h, g2u); addParent(g1w, g2u);
  addParent(g2h, g3f); addParent(g2w, g3f);
  addParent(g2h, g3u); addParent(g2w, g3u);
  addParent(g3f, g4s); addParent(g3m, g4s);
  addParent(g3f, g4d); addParent(g3m, g4d);
}

export default App;
