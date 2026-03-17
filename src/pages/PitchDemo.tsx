import React from 'react';
import PitchView from '@/components/dashboard/PitchView';

const demoPlayers = [
  { id: '1', name: 'Dupont Lucas' },
  { id: '2', name: 'Martin Hugo' },
  { id: '3', name: 'Bernard Théo' },
  { id: '4', name: 'Petit Antoine' },
  { id: '5', name: 'Durand Maxime' },
  { id: '6', name: 'Moreau Nathan' },
  { id: '7', name: 'Simon Enzo' },
  { id: '8', name: 'Laurent Paul' },
  { id: '9', name: 'Michel Rayan' },
  { id: '10', name: 'Garcia Kylian' },
  { id: '11', name: 'Roux Adrien' },
];

const demoConvocations: Record<string, any> = {
  '1':  { status: 'convoque', position: 'Gardien', number: 1 },
  '2':  { status: 'convoque', position: 'Latéral droit', number: 2 },
  '3':  { status: 'convoque', position: 'Défenseur droit', number: 3 },
  '4':  { status: 'convoque', position: 'Défenseur gauche', number: 4 },
  '5':  { status: 'convoque', position: 'Latéral gauche', number: 5 },
  '6':  { status: 'convoque', position: 'Milieu défensif', number: 6 },
  '7':  { status: 'convoque', position: 'Milieu droit', number: 7 },
  '8':  { status: 'convoque', position: 'Milieu gauche', number: 8 },
  '9':  { status: 'convoque', position: 'Ailier gauche', number: 9 },
  '10': { status: 'convoque', position: 'Attaquant', number: 10 },
  '11': { status: 'convoque', position: 'Ailier droit', number: 11 },
};

const PitchDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h1 className="text-foreground text-lg font-bold mb-4">Démo Composition 4-3-3</h1>
      <PitchView convocations={demoConvocations} players={demoPlayers} />
    </div>
  );
};

export default PitchDemo;
