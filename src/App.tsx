import React, { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import FamilyTreeCanvas from './components/FamilyTreeCanvas';
import Toolbar from './components/panels/Toolbar';
import DetailPanel from './components/panels/DetailPanel';
import PersonModal from './components/modals/PersonModal';
import { useFamilyTreeStore } from './stores/familyTreeStore';
import { generateId } from './utils/helpers';
import type { Person } from './types';

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
    firstName: string,
    lastName: string,
    gender: 'male' | 'female',
    birthDate: string,
    deathDate?: string,
    occupation?: string
  ): Person => {
    const person: Person = {
      id: generateId(),
      firstName,
      lastName,
      gender,
      birthDate,
      deathDate,
      isAlive: !deathDate,
      occupation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      customFields: {},
    };
    store.addPerson(person);
    return person;
  };

  // Generation 1
  const g1h = createPerson('Đức', 'Trần', 'male', '1920', '1995', 'Farmer');
  const g1w = createPerson('Thị Lan', 'Nguyễn', 'female', '1925', '2000', 'Homemaker');

  // Generation 2
  const g2h = createPerson('Văn Long', 'Trần', 'male', '1945', '2010', 'Teacher');
  const g2w = createPerson('Thị Hoa', 'Lê', 'female', '1948', undefined, 'Nurse');
  const g2u = createPerson('Văn Hùng', 'Trần', 'male', '1950', undefined, 'Engineer');
  const g2a = createPerson('Thị Mai', 'Phạm', 'female', '1952', undefined, 'Teacher');

  // Generation 3
  const g3f = createPerson('Minh Thái', 'Trần', 'male', '1975', undefined, 'Developer');
  const g3m = createPerson('Thị Bích', 'Nguyễn', 'female', '1978', undefined, 'Designer');
  const g3u = createPerson('Minh Đức', 'Trần', 'male', '1980', undefined, 'Doctor');
  const g3a = createPerson('Thị Thanh', 'Đỗ', 'female', '1982', undefined, 'Lawyer');

  // Generation 4
  const g4s = createPerson('Quốc Bảo', 'Trần', 'male', '2000', undefined, 'Student');
  const g4d = createPerson('Quốc An', 'Trần', 'female', '2003', undefined, 'Student');

  // Marriages
  const addMarriage = (p1: Person, p2: Person, status: any = 'married') => {
    store.addMarriage({
      id: generateId(),
      person1Id: p1.id,
      person2Id: p2.id,
      type: 'marriage',
      status,
      startDate: '1945',
    });
  };

  addMarriage(g1h, g1w, 'widowed');
  addMarriage(g2h, g2w);
  addMarriage(g2u, g2a);
  addMarriage(g3f, g3m);
  addMarriage(g3u, g3a);

  // Parent-child
  const addParent = (parent: Person, child: Person) => {
    store.addParentChild({
      id: generateId(),
      parentId: parent.id,
      childId: child.id,
      type: 'biological',
    });
  };

  addParent(g1h, g2h);
  addParent(g1w, g2h);
  addParent(g1h, g2u);
  addParent(g1w, g2u);
  addParent(g2h, g3f);
  addParent(g2w, g3f);
  addParent(g2h, g3u);
  addParent(g2w, g3u);
  addParent(g3f, g4s);
  addParent(g3m, g4s);
  addParent(g3f, g4d);
  addParent(g3m, g4d);

  console.log('Demo data created!');
}

// ==================== App Component ====================

const App: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { selectedPersonIds, persons } = useFamilyTreeStore();

  React.useEffect(() => {
    const store = useFamilyTreeStore.getState();
    if (store.persons.size === 0) {
      createDemoData();
    }
  }, []);

  // Listen for double-click edit from canvas
  React.useEffect(() => {
    const editHandler = () => {
      const { selectedPersonIds } = useFamilyTreeStore.getState();
      if (selectedPersonIds.length > 0) {
        setShowEditModal(true);
      }
    };
    const addHandler = () => setShowAddModal(true);
    window.addEventListener('edit-person', editHandler);
    window.addEventListener('add-person', addHandler);
    return () => {
      window.removeEventListener('edit-person', editHandler);
      window.removeEventListener('add-person', addHandler);
    };
  }, []);

  const selectedPerson = selectedPersonIds[0] ? persons.get(selectedPersonIds[0]) : undefined;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ReactFlowProvider>
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
          <FamilyTreeCanvas />
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

export default App;
