import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Player, Event, Card, AttendanceRecord, Member } from '@/pages/Dashboard';
import type { Championship, Match } from '@/components/dashboard/ChampionnatTab';
import logoUrl from '@/assets/logo.png';

// Save PDF: on native use Filesystem + Share, on web use doc.save()
async function savePdf(doc: jsPDF, filename: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        url: savedFile.uri,
      });
    } catch (e) {
      console.error('PDF save/share error:', e);
      // Fallback: try blob URL
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  } else {
    doc.save(filename);
  }
}

const CLUB_NAME = 'FC Oisemont';
const PRIMARY_COLOR: [number, number, number] = [14, 43, 160]; // #0e2ba0
const ACCENT_COLOR: [number, number, number] = [34, 197, 94]; // green-500

// Preload logo as base64 for PDF embedding
let logoBase64: string | null = null;
const logoPromise = fetch(logoUrl)
  .then(r => r.blob())
  .then(blob => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => { logoBase64 = reader.result as string; resolve(logoBase64); };
    reader.readAsDataURL(blob);
  }))
  .catch(() => { logoBase64 = null; });

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header bar
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  // Logo
  const textStartX = logoBase64 ? 28 : 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 6, 3, 20, 22);
    } catch { /* logo load failed, skip */ }
  }
  
  // Club name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(CLUB_NAME, textStartX, 12);
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, textStartX, 20);
  
  // Date
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 14, 20, { align: 'right' });
  
  if (subtitle) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text(subtitle, 14, 35);
  }
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${CLUB_NAME} — Généré par FCO-Manager`, 14, pageHeight - 8);
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

// Ensure logo is loaded before generating PDF
async function ensureLogo() { await logoPromise; }

// ─── 1. FICHE JOUEUR ───
export async function exportPlayerCard(
  player: Player,
  cards: Card[],
  events: Event[],
  attendanceRecords: AttendanceRecord[],
  members: Member[]
) {
  await ensureLogo();
  const doc = new jsPDF();
  addHeader(doc, `Fiche Joueur — ${player.name}`);
  
  const member = members.find(m => m.playerId === player.id);
  let y = 38;
  
  // Player info
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text(player.name, 14, y);
  y += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const infos = [
    `Poste : ${player.position || 'Non défini'}`,
    member?.email ? `Email : ${member.email}` : null,
    player.licenseExpiry ? `Licence : expire le ${new Date(player.licenseExpiry).toLocaleDateString('fr-FR')}` : null,
  ].filter(Boolean);
  infos.forEach(info => {
    doc.text(info!, 14, y);
    y += 5;
  });
  
  y += 4;
  
  // Stats table
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiques', 14, y);
  y += 2;
  
  autoTable(doc, {
    startY: y,
    head: [['Matchs', 'Buts', 'Passes D.', 'Moy. buts/match']],
    body: [[
      String(player.matches || 0),
      String(player.goals || 0),
      String(player.assists || 0),
      (player.matches || 0) > 0 ? ((player.goals || 0) / (player.matches || 1)).toFixed(2) : '—',
    ]],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 10, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // Attendance
  const trainingEvents = events.filter(e => e.type === 'training');
  const activeEventIds = new Set(trainingEvents.map(e => e.id));
  const archivedRecords = attendanceRecords.filter(
    r => r.playerId === player.id && r.eventType === 'training' && !activeEventIds.has(r.eventId)
  );
  const allArchivedEventIds = new Set(
    attendanceRecords
      .filter(r => r.eventType === 'training' && !activeEventIds.has(r.eventId))
      .map(r => r.eventId)
  );
  let present = 0;
  trainingEvents.forEach(t => {
    const p = t.presences || {};
    if (p[player.id] === 'present') present++;
  });
  archivedRecords.forEach(r => { if (r.status === 'present') present++; });
  const totalTrainings = activeEventIds.size + allArchivedEventIds.size;
  const attendanceRate = totalTrainings > 0 ? ((present / totalTrainings) * 100).toFixed(1) : '—';
  
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text('Présences entraînements', 14, y);
  y += 2;
  
  autoTable(doc, {
    startY: y,
    head: [['Présent', 'Total', 'Taux']],
    body: [[String(present), String(totalTrainings), `${attendanceRate}%`]],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 10, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // Cards
  const playerCards = cards.filter(c => c.playerId === player.id);
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cartons (${playerCards.length})`, 14, y);
  y += 2;
  
  if (playerCards.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Date', 'Motif', 'Suspension']],
      body: playerCards.map(c => [
        c.type === 'yellow' ? 'Jaune' : 'Rouge',
        new Date(c.date).toLocaleDateString('fr-FR'),
        c.reason,
        c.suspendedUntil ? `→ ${new Date(c.suspendedUntil).toLocaleDateString('fr-FR')}` : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });
  } else {
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Aucun carton', 14, y);
  }
  
  addFooter(doc);
  doc.save(`Fiche_${player.name.replace(/\s+/g, '_')}.pdf`);
}

// ─── 2. BILAN SAISON ───
export async function exportSeasonReport(
  players: Player[],
  events: Event[],
  cards: Card[],
  championships: Championship[],
  matches: Match[]
) {
  await ensureLogo();
  const doc = new jsPDF();
  const now = new Date();
  const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const seasonLabel = `${seasonYear}-${seasonYear + 1}`;
  
  addHeader(doc, `Bilan Saison ${seasonLabel}`);
  
  let y = 38;
  
  // Global stats
  const totalGoals = players.reduce((s, p) => s + (p.goals || 0), 0);
  const totalAssists = players.reduce((s, p) => s + (p.assists || 0), 0);
  const totalMatches = events.filter(e => e.type === 'match').length;
  const totalTrainings = events.filter(e => e.type === 'training').length;
  const totalYellows = cards.filter(c => c.type === 'yellow').length;
  const totalReds = cards.filter(c => c.type === 'red').length;
  
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text('Vue d\'ensemble', 14, y);
  y += 2;
  
  autoTable(doc, {
    startY: y,
    head: [['Matchs', 'Entraînements', 'Buts', 'Passes D.', 'Cartons J.', 'Cartons R.', 'Joueurs']],
    body: [[
      String(totalMatches), String(totalTrainings), String(totalGoals),
      String(totalAssists), String(totalYellows), String(totalReds), String(players.length),
    ]],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
    bodyStyles: { fontSize: 10, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  
  y = (doc as any).lastAutoTable.finalY + 8;
  
  // Top scorers
  const scorers = [...players].filter(p => (p.goals || 0) > 0).sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 10);
  if (scorers.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text('Meilleurs buteurs', 14, y);
    y += 2;
    
    autoTable(doc, {
      startY: y,
      head: [['#', 'Joueur', 'Poste', 'Buts', 'Matchs', 'Moy/Match']],
      body: scorers.map((p, i) => [
        String(i + 1), p.name, p.position || '—', String(p.goals || 0), String(p.matches || 0),
        (p.matches || 0) > 0 ? ((p.goals || 0) / (p.matches || 1)).toFixed(2) : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  
  // Top assisters
  const assisters = [...players].filter(p => (p.assists || 0) > 0).sort((a, b) => (b.assists || 0) - (a.assists || 0)).slice(0, 10);
  if (assisters.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text('Meilleurs passeurs', 14, y);
    y += 2;
    
    autoTable(doc, {
      startY: y,
      head: [['#', 'Joueur', 'Poste', 'Passes D.', 'Matchs']],
      body: assisters.map((p, i) => [
        String(i + 1), p.name, p.position || '—', String(p.assists || 0), String(p.matches || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  
  // Championships standings
  if (championships.length > 0) {
    championships.forEach(champ => {
      if (y > 240) { doc.addPage(); y = 20; }
      
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY_COLOR);
      doc.setFont('helvetica', 'bold');
      doc.text(`Classement — ${champ.name}`, 14, y);
      y += 2;
      
      const standings = champ.fffStandings;
      if (standings && standings.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['#', 'Équipe', 'Pts', 'J', 'V', 'N', 'D', 'BP', 'BC', 'Diff']],
          body: standings.map((s, i) => [
            String(i + 1), s.team, String(s.points), String(s.played),
            String(s.won), String(s.drawn), String(s.lost),
            String(s.goalsFor), String(s.goalsAgainst), String(s.goalDiff),
          ]),
          theme: 'striped',
          headStyles: { fillColor: PRIMARY_COLOR, fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    });
  }
  
  addFooter(doc);
  doc.save(`Bilan_Saison_${seasonLabel}.pdf`);
}

// ─── 3. FEUILLE DE MATCH ───
export async function exportMatchSheet(
  event: Event,
  players: Player[],
  members: Member[]
) {
  await ensureLogo();
  const doc = new jsPDF();
  addHeader(doc, `Feuille de Match`);
  
  let y = 38;
  
  // Match info
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text(event.title, 14, y);
  y += 7;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Date : ${new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${event.time ? ` à ${event.time}` : ''}`, 14, y);
  y += 5;
  if (event.location) {
    doc.text(`Lieu : ${event.location}`, 14, y);
    y += 5;
  }
  if (event.createdByName) {
    doc.text(`Créé par : ${event.createdByName}`, 14, y);
    y += 5;
  }
  
  y += 4;
  
  // Convocations
  const convocations = event.convocations || {};
  const convoquedIds = Object.entries(convocations).filter(([, c]) => c.status === 'convoque').map(([id]) => id);
  const nonConvoquedIds = Object.entries(convocations).filter(([, c]) => c.status === 'non_convoque').map(([id]) => id);
  
  if (convoquedIds.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text(`Convoqués (${convoquedIds.length})`, 14, y);
    y += 2;
    
    const rows = convoquedIds.map(id => {
      const player = players.find(p => p.id === id);
      const conv = convocations[id];
      return [
        conv.number ? String(conv.number) : '—',
        player?.name || 'Inconnu',
        conv.position || player?.position || '—',
      ];
    }).sort((a, b) => {
      const numA = a[0] === '—' ? 999 : parseInt(a[0]);
      const numB = b[0] === '—' ? 999 : parseInt(b[0]);
      return numA - numB;
    });
    
    autoTable(doc, {
      startY: y,
      head: [['N°', 'Joueur', 'Poste']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: ACCENT_COLOR, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  
  if (nonConvoquedIds.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'bold');
    doc.text(`Non convoqués (${nonConvoquedIds.length})`, 14, y);
    y += 2;
    
    autoTable(doc, {
      startY: y,
      head: [['Joueur', 'Poste']],
      body: nonConvoquedIds.map(id => {
        const player = players.find(p => p.id === id);
        return [player?.name || 'Inconnu', player?.position || '—'];
      }),
      theme: 'grid',
      headStyles: { fillColor: [180, 180, 180], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [130, 130, 130] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  
  // Presences
  const presences = event.presences || {};
  const presentPlayers = players.filter(p => presences[p.id] === 'present');
  const absentPlayers = players.filter(p => presences[p.id] === 'absent');
  const unknownPlayers = players.filter(p => !presences[p.id] || presences[p.id] === 'incertain');
  
  if (y > 220) { doc.addPage(); y = 20; }
  
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.text('Présences', 14, y);
  y += 2;
  
  autoTable(doc, {
    startY: y,
    head: [['Joueur', 'Poste', 'Statut']],
    body: [
      ...presentPlayers.map(p => [p.name, p.position || '—', '✅ Présent']),
      ...absentPlayers.map(p => [p.name, p.position || '—', '❌ Absent']),
      ...unknownPlayers.map(p => [p.name, p.position || '—', '⏳ En attente']),
    ],
    theme: 'striped',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  
  addFooter(doc);
  doc.save(`Feuille_Match_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${event.date}.pdf`);
}

// ─── 4. RAPPORT DE PRÉSENCES ───
export async function exportAttendanceReport(
  players: Player[],
  events: Event[],
  attendanceRecords: AttendanceRecord[]
) {
  await ensureLogo();
  const doc = new jsPDF('landscape');
  addHeader(doc, 'Rapport de Présences — Entraînements');
  
  let y = 38;
  
  const trainingEvents = events.filter(e => e.type === 'training').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const activeEventIds = new Set(trainingEvents.map(e => e.id));
  
  // Get all archived event IDs
  const allArchivedEventIds = new Set(
    attendanceRecords
      .filter(r => r.eventType === 'training' && !activeEventIds.has(r.eventId))
      .map(r => r.eventId)
  );
  
  // Calculate attendance for each player
  const stats = players.map(player => {
    let present = 0;
    let absent = 0;
    
    trainingEvents.forEach(t => {
      const p = t.presences || {};
      if (p[player.id] === 'present') present++;
      else if (p[player.id] === 'absent') absent++;
    });
    
    const archivedRecords = attendanceRecords.filter(
      r => r.playerId === player.id && r.eventType === 'training' && !activeEventIds.has(r.eventId)
    );
    archivedRecords.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
    });
    
    const total = activeEventIds.size + allArchivedEventIds.size;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '—';
    
    return {
      name: player.name,
      position: player.position || '—',
      present,
      absent,
      unknown: total - present - absent,
      total,
      rate,
    };
  }).sort((a, b) => {
    const rateA = a.rate === '—' ? -1 : parseFloat(a.rate);
    const rateB = b.rate === '—' ? -1 : parseFloat(b.rate);
    return rateB - rateA;
  });
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`${players.length} joueurs — ${activeEventIds.size + allArchivedEventIds.size} entraînements`, 14, y);
  y += 6;
  
  autoTable(doc, {
    startY: y,
    head: [['#', 'Joueur', 'Poste', 'Présent', 'Absent', 'En attente', 'Total', 'Taux']],
    body: stats.map((s, i) => [
      String(i + 1), s.name, s.position,
      String(s.present), String(s.absent), String(s.unknown),
      String(s.total), `${s.rate}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = parseFloat(data.cell.raw as string);
        if (!isNaN(val)) {
          if (val >= 80) data.cell.styles.textColor = [34, 197, 94];
          else if (val >= 60) data.cell.styles.textColor = [234, 179, 8];
          else data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
  });
  
  addFooter(doc);
  doc.save(`Rapport_Presences_${new Date().toISOString().split('T')[0]}.pdf`);
}
