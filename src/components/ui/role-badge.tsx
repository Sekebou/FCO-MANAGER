import React from 'react';
import { Shield, Dumbbell, Camera, UserCircle, Briefcase, Crown } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; border: string; glow: string }> = {
  'admin+': {
    label: 'Super Admin',
    icon: Crown,
    bg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
    text: 'text-amber-500',
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.25)]',
  },
  admin: {
    label: 'Administrateur',
    icon: Shield,
    bg: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_8px_rgba(59,130,246,0.2)]',
  },
  entraineur: {
    label: 'Entraîneur',
    icon: Dumbbell,
    bg: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_8px_rgba(59,130,246,0.2)]',
  },
  dirigeant: {
    label: 'Dirigeant',
    icon: Briefcase,
    bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
    text: 'text-emerald-500',
    border: 'border-emerald-500/40',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.2)]',
  },
  photographe: {
    label: 'Photographe',
    icon: Camera,
    bg: 'bg-gradient-to-r from-pink-500/20 to-rose-500/20',
    text: 'text-pink-500',
    border: 'border-pink-500/40',
    glow: 'shadow-[0_0_8px_rgba(236,72,153,0.2)]',
  },
  joueur: {
    label: 'Joueur',
    icon: UserCircle,
    bg: 'bg-gradient-to-r from-slate-500/15 to-gray-500/15',
    text: 'text-muted-foreground',
    border: 'border-border',
    glow: '',
  },
};

interface RoleBadgeProps {
  role?: string;
  displayRole?: string;
  /** true when the actual role is admin but displayRole overrides the visual */
  isAdminWithDisplayRole?: boolean;
  size?: 'sm' | 'md';
  compact?: boolean;
  /** Use lowercase label with medium weight instead of bold uppercase */
  subtle?: boolean;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, displayRole, isAdminWithDisplayRole, size = 'sm', compact = false, subtle = false }) => {
  if (!role) return null;

  // Use displayRole for visuals if provided, but keep admin indicator
  const visualRole = displayRole && ROLE_CONFIG[displayRole] ? displayRole : role;
  const showAdminIndicator = isAdminWithDisplayRole || (displayRole && displayRole !== role && (role === 'admin' || role === 'admin+'));

  const config = ROLE_CONFIG[visualRole];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${subtle ? 'font-medium' : 'font-bold tracking-wide uppercase'} ${config.bg} ${config.text} ${config.border} ${config.glow} ${
      compact ? 'px-1.5 py-0.5 text-[8px]' : size === 'sm' ? 'px-2.5 py-1 text-[9px]' : 'px-3 py-1 text-[10px]'
    }`} title={showAdminIndicator ? `${config.label} (droits admin)` : config.label}>
      <Icon size={compact ? 10 : size === 'sm' ? 11 : 13} strokeWidth={2.5} />
      {!compact && config.label}
      {showAdminIndicator && (
        <Shield size={compact ? 8 : size === 'sm' ? 9 : 10} strokeWidth={2.5} className={`${config.text} ml-0.5 opacity-70`} />
      )}
    </span>
  );
};

export default RoleBadge;
