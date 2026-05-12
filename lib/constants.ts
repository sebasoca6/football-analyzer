import type { LeagueConfig } from '@/types/football';

export const LEAGUES: LeagueConfig[] = [
  {
    id: 2021,
    code: 'PL',
    name: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    logo: 'https://crests.football-data.org/PL.png',
  },
  {
    id: 2014,
    code: 'PD',
    name: 'LaLiga',
    country: 'España',
    flag: '🇪🇸',
    logo: 'https://crests.football-data.org/PD.png',
  },
  {
    id: 2002,
    code: 'BL1',
    name: 'Bundesliga',
    country: 'Alemania',
    flag: '🇩🇪',
    logo: 'https://crests.football-data.org/BL1.png',
  },
  {
    id: 2019,
    code: 'SA',
    name: 'Serie A',
    country: 'Italia',
    flag: '🇮🇹',
    logo: 'https://crests.football-data.org/SA.png',
  },
  {
    id: 2015,
    code: 'FL1',
    name: 'Ligue 1',
    country: 'Francia',
    flag: '🇫🇷',
    logo: 'https://crests.football-data.org/FL1.png',
  },
];

export const CURRENT_SEASON = 2025;

export const API_BASE = '/api';
