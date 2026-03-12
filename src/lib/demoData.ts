/**
 * Données fictives pour le mode démo (Apple Review).
 * Ce compte voit des données réalistes mais ne touche jamais à la vraie base.
 */

import type { Player, Event, NewsItem, Member, Card, AttendanceRecord, NewsComment } from '@/pages/Dashboard';
import type { Championship, Match } from '@/components/dashboard/ChampionnatTab';
import type { Album } from '@/components/dashboard/GalleryTab';
import type { MatchSheet } from '@/components/dashboard/MatchSheetsTab';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

export const DEMO_PLAYERS: Player[] = [
  { id: 'demo-p1', name: 'Lucas Martin', position: 'Gardien', matches: 18, goals: 0, assists: 1 },
  { id: 'demo-p2', name: 'Antoine Dupont', position: 'Défenseur central', matches: 20, goals: 2, assists: 3 },
  { id: 'demo-p3', name: 'Karim Benzali', position: 'Défenseur central', matches: 17, goals: 1, assists: 2 },
  { id: 'demo-p4', name: 'Thomas Leroy', position: 'Latéral droit', matches: 19, goals: 0, assists: 5 },
  { id: 'demo-p5', name: 'Maxime Bernard', position: 'Latéral gauche', matches: 16, goals: 1, assists: 4 },
  { id: 'demo-p6', name: 'Hugo Petit', position: 'Milieu défensif', matches: 20, goals: 3, assists: 6 },
  { id: 'demo-p7', name: 'Nathan Moreau', position: 'Milieu central', matches: 18, goals: 5, assists: 8 },
  { id: 'demo-p8', name: 'Enzo Richard', position: 'Milieu offensif', matches: 15, goals: 7, assists: 10 },
  { id: 'demo-p9', name: 'Yassine El Amrani', position: 'Ailier droit', matches: 19, goals: 9, assists: 4 },
  { id: 'demo-p10', name: 'Rayan Diouf', position: 'Ailier gauche', matches: 17, goals: 6, assists: 3 },
  { id: 'demo-p11', name: 'Mathis Girard', position: 'Attaquant', matches: 20, goals: 14, assists: 5 },
  { id: 'demo-p12', name: 'Léo Fontaine', position: 'Attaquant', matches: 14, goals: 8, assists: 2 },
  { id: 'demo-p13', name: 'Julien Roche', position: 'Milieu central', matches: 12, goals: 2, assists: 3 },
  { id: 'demo-p14', name: 'Sofiane Belhaj', position: 'Défenseur central', matches: 10, goals: 0, assists: 1 },
];

export const DEMO_EVENTS: Event[] = [
  {
    id: 'demo-e1', title: 'Entraînement', date: nextWeek, type: 'training',
    time: '19:00', location: 'Stade Municipal', duration: 90,
    presences: { 'demo-p1': 'present', 'demo-p2': 'present', 'demo-p3': 'absent', 'demo-p7': 'present' },
    convocations: {}, convocationsPublished: false, recurrence: 'recurring',
  },
  {
    id: 'demo-e2', title: 'FCO vs AS Villepinte', date: nextWeek, type: 'match',
    time: '15:00', location: 'Stade Jean Moulin', team: 'A',
    presences: { 'demo-p1': 'present', 'demo-p2': 'present', 'demo-p11': 'present' },
    convocations: {
      'demo-p1': { status: 'convoque', position: 'Gardien', number: 1 },
      'demo-p2': { status: 'convoque', position: 'Défenseur central', number: 4 },
      'demo-p11': { status: 'convoque', position: 'Attaquant', number: 9 },
    },
    convocationsPublished: true,
    homeLogo: '', awayLogo: '',
  },
  {
    id: 'demo-e3', title: 'FCO vs US Tremblay', date: lastWeek, type: 'match',
    time: '15:00', location: 'Stade Municipal', team: 'A',
    presences: {}, convocations: {}, convocationsPublished: false,
  },
];

export const DEMO_NEWS: NewsItem[] = [
  {
    id: 'demo-n1', title: 'Victoire 3-1 contre Tremblay !',
    content: 'Belle performance de l\'équipe ce week-end avec des buts de Girard (x2) et El Amrani. La défense a été solide et Martin a réalisé plusieurs arrêts décisifs.',
    author: 'Coach Dupuis', authorId: 'demo-coach', date: yesterday, likes: ['demo-u1', 'demo-u2', 'demo-u3'],
  },
  {
    id: 'demo-n2', title: 'Entraînement supplémentaire mercredi',
    content: 'Un entraînement supplémentaire est prévu mercredi à 19h pour préparer le match de ce week-end. Présence recommandée pour tous.',
    author: 'Coach Dupuis', authorId: 'demo-coach', date: lastWeek, likes: ['demo-u1'],
  },
  {
    id: 'demo-n3', title: 'Bienvenue aux nouveaux joueurs !',
    content: 'Le club est heureux d\'accueillir Sofiane Belhaj et Léo Fontaine qui rejoignent l\'effectif pour la deuxième partie de saison.',
    author: 'Président Moreau', authorId: 'demo-pres', date: lastWeek, likes: ['demo-u1', 'demo-u2'],
  },
];

export const DEMO_MEMBERS: Member[] = [
  { id: 'demo-coach', name: 'Coach Dupuis', email: 'coach@fco.fr', role: 'entraineur', displayRole: 'Entraîneur', createdAt: '2024-09-01' },
  { id: 'demo-pres', name: 'Marc Moreau', email: 'president@fco.fr', role: 'dirigeant', displayRole: 'Président', createdAt: '2024-09-01' },
  ...DEMO_PLAYERS.map(p => ({
    id: `demo-m-${p.id}`, name: p.name, email: `${p.name.toLowerCase().replace(/ /g, '.')}@mail.com`,
    role: 'joueur' as string, playerId: p.id, createdAt: '2024-09-01', photoURL: null,
  })),
];

export const DEMO_CARDS: Card[] = [
  { id: 'demo-c1', playerId: 'demo-p9', type: 'yellow', reason: 'Jeu dangereux', date: lastWeek },
  { id: 'demo-c2', playerId: 'demo-p11', type: 'yellow', reason: 'Contestation', date: yesterday },
];

export const DEMO_ATTENDANCE: AttendanceRecord[] = [
  { id: 'demo-a1', playerId: 'demo-p1', eventId: 'demo-e3', eventType: 'match', eventDate: lastWeek, status: 'present', savedAt: lastWeek },
  { id: 'demo-a2', playerId: 'demo-p2', eventId: 'demo-e3', eventType: 'match', eventDate: lastWeek, status: 'present', savedAt: lastWeek },
  { id: 'demo-a3', playerId: 'demo-p11', eventId: 'demo-e3', eventType: 'match', eventDate: lastWeek, status: 'present', savedAt: lastWeek },
  { id: 'demo-a4', playerId: 'demo-p3', eventId: 'demo-e3', eventType: 'match', eventDate: lastWeek, status: 'absent', savedAt: lastWeek },
];

export const DEMO_COMMENTS: NewsComment[] = [
  { id: 'demo-nc1', newsId: 'demo-n1', authorName: 'Nathan Moreau', authorUid: 'demo-m-demo-p7', content: 'Bravo à tous ! 💪', createdAt: yesterday },
  { id: 'demo-nc2', newsId: 'demo-n1', authorName: 'Mathis Girard', authorUid: 'demo-m-demo-p11', content: 'Merci coach, on continue comme ça !', createdAt: yesterday },
];

export const DEMO_CHAMPIONSHIPS: Championship[] = [
  {
    id: 'demo-ch1', name: 'District Senior D3', season: '2025-2026',
    teams: ['FCO', 'AS Villepinte', 'US Tremblay', 'FC Aulnay', 'ES Bondy', 'RC Noisy'],
    team: 'A', createdAt: '2024-09-01',
    fffUrl: null, fffStandings: [
      { rank: 1, team: 'FCO', pts: 42, j: 20, g: 13, n: 3, p: 4, bp: 38, bc: 18, diff: 20 },
      { rank: 2, team: 'AS Villepinte', pts: 39, j: 20, g: 12, n: 3, p: 5, bp: 35, bc: 22, diff: 13 },
      { rank: 3, team: 'FC Aulnay', pts: 35, j: 20, g: 10, n: 5, p: 5, bp: 30, bc: 20, diff: 10 },
      { rank: 4, team: 'ES Bondy', pts: 30, j: 20, g: 9, n: 3, p: 8, bp: 28, bc: 25, diff: 3 },
      { rank: 5, team: 'US Tremblay', pts: 25, j: 20, g: 7, n: 4, p: 9, bp: 22, bc: 28, diff: -6 },
      { rank: 6, team: 'RC Noisy', pts: 18, j: 20, g: 5, n: 3, p: 12, bp: 18, bc: 35, diff: -17 },
    ],
    teamLogos: {}, fffLiveCache: null, fffRefreshedAt: null,
  },
];

export const DEMO_MATCHES: Match[] = [
  { id: 'demo-cm1', championshipId: 'demo-ch1', homeTeam: 'FCO', awayTeam: 'US Tremblay', homeScore: 3, awayScore: 1, date: lastWeek, journee: 20, played: true },
  { id: 'demo-cm2', championshipId: 'demo-ch1', homeTeam: 'FCO', awayTeam: 'AS Villepinte', homeScore: null, awayScore: null, date: nextWeek, journee: 21, played: false },
];

export const DEMO_ALBUMS: Album[] = [
  { id: 'demo-al1', name: 'Saison 2025-2026', description: 'Photos de la saison en cours', createdAt: '2024-09-01', createdBy: 'demo-coach', coverUrl: null },
];

export const DEMO_MATCH_SHEETS: MatchSheet[] = [
  {
    id: 'demo-ms1', eventId: 'demo-e3', title: 'FCO vs US Tremblay', date: lastWeek,
    time: '15:00', location: 'Stade Municipal', team: 'A',
    homeTeam: 'FCO', awayTeam: 'US Tremblay', homeScore: 3, awayScore: 1,
    homeLogo: null, awayLogo: null,
    convocations: {}, createdAt: lastWeek, createdBy: 'demo-coach',
  },
];
