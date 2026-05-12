import type { AnalysisStats, Probabilities } from '@/types/football';
import type { FormTrend, HalfTimeStats } from './analysis';

interface NarrativeInput {
  homeName: string;
  awayName: string;
  homeStats10: AnalysisStats;
  awayStats10: AnalysisStats;
  homeStats5: AnalysisStats;
  awayStats5: AnalysisStats;
  h2hStats: AnalysisStats;
  h2hCount: number;
  probs: Probabilities;
  homeTrend: FormTrend;
  awayTrend: FormTrend;
  homeScoringStreak: number;
  awayScoringStreak: number;
  homeCSStreak: number;
  awayCSStreak: number;
  homeNoWinStreak: number;
  awayNoWinStreak: number;
  homeHT: HalfTimeStats;
  awayHT: HalfTimeStats;
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function teamFormPhrase(name: string, stats: AnalysisStats, stats5: AnalysisStats, trend: FormTrend): string {
  const winRate = pct(stats.wins, stats.matches);
  const winRate5 = pct(stats5.wins, stats5.matches);
  const goalsPerGame = stats.matches > 0 ? stats.goalsScored / stats.matches : 0;
  const concededPerGame = stats.matches > 0 ? stats.goalsConceded / stats.matches : 0;

  let formPhrase = '';
  if (winRate >= 65) formPhrase = `${name} llega en un estado de forma excelente, con victorias en el ${winRate}% de sus últimos partidos`;
  else if (winRate >= 45) formPhrase = `${name} presenta una forma sólida, ganando el ${winRate}% de sus últimos encuentros`;
  else if (winRate >= 30) formPhrase = `${name} atraviesa una racha irregular, ganando solo el ${winRate}% de sus últimos partidos`;
  else formPhrase = `${name} está pasando por un momento de forma muy bajo, con apenas un ${winRate}% de victorias`;

  if (trend === 'improving' && winRate5 > winRate - 20) formPhrase += ', aunque su tendencia reciente es claramente positiva';
  else if (trend === 'declining') formPhrase += ', y su rendimiento está empeorando en las últimas jornadas';

  let attackPhrase = '';
  if (goalsPerGame >= 2.0) attackPhrase = `Es un equipo muy goleador (${goalsPerGame.toFixed(1)} goles por partido)`;
  else if (goalsPerGame >= 1.4) attackPhrase = `Ataca con eficacia (${goalsPerGame.toFixed(1)} goles por partido de media)`;
  else if (goalsPerGame < 0.9) attackPhrase = `Le cuesta mucho marcar (${goalsPerGame.toFixed(1)} goles por partido)`;
  else attackPhrase = `Su producción ofensiva es moderada (${goalsPerGame.toFixed(1)} goles por partido)`;

  let defensePhrase = '';
  if (concededPerGame <= 0.8) defensePhrase = `con una defensa muy sólida`;
  else if (concededPerGame <= 1.2) defensePhrase = `aunque su defensa es razonablemente buena`;
  else if (concededPerGame >= 2.0) defensePhrase = `pero su defensa deja mucho que desear (encaja ${concededPerGame.toFixed(1)} por partido)`;
  else defensePhrase = `y encaja una media de ${concededPerGame.toFixed(1)} goles por partido`;

  return `${formPhrase}. ${attackPhrase} ${defensePhrase}.`;
}

function goalsNarrative(probs: Probabilities, homeStats: AnalysisStats, awayStats: AnalysisStats): string {
  const parts: string[] = [];

  if (probs.over25 >= 62) {
    parts.push('El modelo apunta a un encuentro abierto y con goles, con una probabilidad superior al 60% de que caigan más de 2.5 tantos.');
  } else if (probs.over25 >= 50) {
    parts.push('Se espera un partido con tendencia a los goles, aunque no está descartado que sea más cerrado.');
  } else if (probs.over25 <= 35) {
    parts.push('Todo indica que será un partido muy cerrado y de pocos goles, con el Under 2.5 como opción estadísticamente sólida.');
  } else {
    parts.push('El mercado de goles está muy abierto según los datos; ninguna de las dos tendencias domina claramente.');
  }

  if (probs.btts >= 60) {
    parts.push('Las estadísticas también sugieren que ambos equipos tienen muchas probabilidades de marcar.');
  } else if (probs.btts <= 35) {
    parts.push('Por otro lado, es bastante probable que alguno de los dos equipos se quede sin marcar.');
  }

  const homeBtts = pct(homeStats.btts, homeStats.matches);
  const awayBtts = pct(awayStats.btts, awayStats.matches);
  if (homeBtts >= 65 && awayBtts >= 65) {
    parts.push('Ambos equipos tienen un historial muy elevado de partidos donde los dos equipos marcan.');
  }

  return parts.join(' ');
}

function h2hNarrative(homeName: string, awayName: string, h2hStats: AnalysisStats, h2hCount: number): string {
  if (h2hCount < 3) return 'No hay suficiente historial de enfrentamientos directos para sacar conclusiones.';

  const homeWinRate = pct(h2hStats.wins, h2hStats.matches);
  const drawRate = pct(h2hStats.draws, h2hStats.matches);
  const over25Rate = pct(h2hStats.over25, h2hStats.matches);

  let base = '';
  if (homeWinRate >= 55) base = `El historial entre estos equipos favorece claramente a ${homeName}, que ha ganado el ${homeWinRate}% de sus ${h2hCount} enfrentamientos directos recientes.`;
  else if (homeWinRate <= 30) base = `Históricamente, ${awayName} ha dominado este enfrentamiento, con ${homeName} ganando solo el ${homeWinRate}% de los cruces recientes.`;
  else base = `El historial directo entre ambos equipos está muy igualado, con un ${drawRate}% de empates.`;

  if (over25Rate >= 60) base += ` Además, sus duelos directos suelen ser partidos con goles (${over25Rate}% terminaron con más de 2.5).`;
  else if (over25Rate <= 35) base += ` Sus enfrentamientos directos han tendido a ser partidos muy cerrados (solo ${over25Rate}% superaron los 2.5 goles).`;

  return base;
}

function streakNarrative(homeName: string, awayName: string,
  homeScoringStreak: number, awayScoringStreak: number,
  homeCSStreak: number, awayCSStreak: number,
  homeNoWinStreak: number, awayNoWinStreak: number
): string {
  const alerts: string[] = [];

  if (homeScoringStreak >= 7) alerts.push(`${homeName} lleva ${homeScoringStreak} partidos consecutivos marcando, lo que habla de una gran continuidad ofensiva.`);
  else if (homeScoringStreak >= 4) alerts.push(`${homeName} ha marcado en sus últimos ${homeScoringStreak} partidos seguidos.`);

  if (awayScoringStreak >= 7) alerts.push(`${awayName} lleva ${awayScoringStreak} partidos seguidos marcando.`);
  else if (awayScoringStreak >= 4) alerts.push(`${awayName} ha anotado en sus ${awayScoringStreak} últimos encuentros.`);

  if (homeCSStreak >= 3) alerts.push(`${homeName} ha dejado su portería a cero en los últimos ${homeCSStreak} partidos, mostrando una solidez defensiva notable.`);
  if (awayCSStreak >= 3) alerts.push(`${awayName} lleva ${awayCSStreak} partidos sin encajar.`);

  if (homeNoWinStreak >= 5) alerts.push(`Preocupa la racha de ${homeName}, que lleva ${homeNoWinStreak} partidos sin ganar.`);
  if (awayNoWinStreak >= 5) alerts.push(`${awayName} no ha conseguido ganar en sus últimos ${awayNoWinStreak} encuentros.`);

  return alerts.length > 0 ? alerts.join(' ') : '';
}

function resultNarrative(homeName: string, awayName: string, probs: Probabilities): string {
  const maxProb = Math.max(probs.homeWin, probs.draw, probs.awayWin);
  let outcome = '';

  if (maxProb === probs.homeWin) {
    if (probs.homeWin >= 55) outcome = `El modelo favorece con claridad a ${homeName} como equipo más probable ganador (${probs.homeWin.toFixed(0)}%).`;
    else outcome = `${homeName} parte con una ligera ventaja en las probabilidades de victoria (${probs.homeWin.toFixed(0)}%), aunque el partido está muy abierto.`;
  } else if (maxProb === probs.awayWin) {
    if (probs.awayWin >= 50) outcome = `Sorprendentemente, las estadísticas favorecen al visitante ${awayName} como opción más probable (${probs.awayWin.toFixed(0)}%).`;
    else outcome = `El visitante ${awayName} tiene una probabilidad ligeramente superior de llevarse los tres puntos (${probs.awayWin.toFixed(0)}%).`;
  } else {
    if (probs.draw >= 35) outcome = `El empate emerge como el resultado más probable según el modelo (${probs.draw.toFixed(0)}%), lo que refleja el equilibrio entre ambos conjuntos.`;
    else outcome = `El partido está muy equilibrado; el empate, aunque no el resultado más probable, no debe descartarse (${probs.draw.toFixed(0)}%).`;
  }

  return outcome;
}

function halfTimeNarrative(homeName: string, awayName: string, homeHT: HalfTimeStats, awayHT: HalfTimeStats): string {
  if (homeHT.matches < 5 || awayHT.matches < 5) return '';

  const parts: string[] = [];
  const homeHTWinPct = pct(homeHT.htWins, homeHT.matches);
  const awayHT2ndGoals = awayHT.stGoalsFor;

  if (homeHTWinPct >= 50) parts.push(`${homeName} suele dominar el primer tiempo, ganando en el descanso en el ${homeHTWinPct}% de sus partidos.`);

  const homeSecondHalfGoals = homeHT.stGoalsFor;
  if (homeSecondHalfGoals > homeHT.htGoalsFor * 1.4) {
    parts.push(`${homeName} tiende a ser más peligroso en la segunda mitad.`);
  }
  if (awayHT2ndGoals > awayHT.htGoalsFor * 1.4) {
    parts.push(`${awayName} también suele crecer en la segunda parte.`);
  }

  return parts.join(' ');
}

export function generateNarrative(input: NarrativeInput): string {
  const {
    homeName, awayName, homeStats10, awayStats10, homeStats5, awayStats5,
    h2hStats, h2hCount, probs, homeTrend, awayTrend,
    homeScoringStreak, awayScoringStreak, homeCSStreak, awayCSStreak,
    homeNoWinStreak, awayNoWinStreak, homeHT, awayHT,
  } = input;

  const paragraphs: string[] = [];

  paragraphs.push(teamFormPhrase(homeName, homeStats10, homeStats5, homeTrend));
  paragraphs.push(teamFormPhrase(awayName, awayStats10, awayStats5, awayTrend));

  const streaks = streakNarrative(homeName, awayName, homeScoringStreak, awayScoringStreak, homeCSStreak, awayCSStreak, homeNoWinStreak, awayNoWinStreak);
  if (streaks) paragraphs.push(streaks);

  paragraphs.push(h2hNarrative(homeName, awayName, h2hStats, h2hCount));
  paragraphs.push(goalsNarrative(probs, homeStats10, awayStats10));

  const htText = halfTimeNarrative(homeName, awayName, homeHT, awayHT);
  if (htText) paragraphs.push(htText);

  paragraphs.push(resultNarrative(homeName, awayName, probs));

  return paragraphs.filter(Boolean).join('\n\n');
}
