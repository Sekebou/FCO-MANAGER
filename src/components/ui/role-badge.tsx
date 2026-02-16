import React from 'react';
import { Shield, Dumbbell, Camera, UserCircle, Briefcase } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  'admin+': { label: 'Super Admin', icon: Shield, className: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
  admin: { label: 'Admin', icon: Shield, className: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
  entraineur: { label: 'Entraîneur', icon: Dumbbell, className: 'bg-purple-500/15 text-purple-600 border-purple-500/20' },
  dirigeant: { label: 'Dirigeant', icon: Briefcase, className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' },
  photographe: { label: 'Photographe', icon: Camera, className: 'bg-pink-500/15 text-pink-600 border-pink-500/20' },
  joueur: { label: 'Joueur', icon: UserCircle, className: 'bg-muted text-muted-foreground border-border' },
};

interface RoleBadgeProps {
  role?: string;
  size?: 'sm' | 'md';
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'sm' }) => {
  if (!role) return null;
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${config.className} ${
      size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
    }`}>
      <Icon size={size === 'sm' ? 10 : 12} />
      {config.label}
    </span>
  );
};

export default RoleBadge;
