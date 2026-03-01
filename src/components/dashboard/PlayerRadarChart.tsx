import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface PlayerRadarProps {
  goals: number;
  assists: number;
  matches: number;
  attendanceRate: number | null;
  disciplineScore: number; // 100 = aucun carton, réduit par carton
  name: string;
}

const PlayerRadarChart: React.FC<PlayerRadarProps> = ({ goals, assists, matches, attendanceRate, disciplineScore, name }) => {
  // Normalize values to 0-100 scale for radar
  const maxGoals = 30;
  const maxAssists = 20;
  const maxMatches = 40;

  const data = [
    { stat: 'Buts', value: Math.min(100, (goals / maxGoals) * 100), raw: goals },
    { stat: 'Passes D.', value: Math.min(100, (assists / maxAssists) * 100), raw: assists },
    { stat: 'Matchs', value: Math.min(100, (matches / maxMatches) * 100), raw: matches },
    { stat: 'Présence', value: attendanceRate ?? 0, raw: `${(attendanceRate ?? 0).toFixed(0)}%` },
    { stat: 'Discipline', value: disciplineScore, raw: `${disciplineScore.toFixed(0)}%` },
  ];

  return (
    <div className="w-full h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="hsl(var(--border))" 
            strokeOpacity={0.5}
          />
          <PolarAngleAxis 
            dataKey="stat" 
            tick={{ 
              fill: 'hsl(var(--muted-foreground))', 
              fontSize: 10, 
              fontWeight: 600 
            }} 
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name={name}
            dataKey="value"
            stroke="hsl(var(--accent))"
            fill="hsl(var(--accent))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PlayerRadarChart;
