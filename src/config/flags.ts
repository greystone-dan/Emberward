/**
 * Every number SPEC.md marks as [flag] lives here, so simulations can compare alternatives.
 * Nothing in src/core may hard-code one of these values.
 */
export const FLAGS = {
  // §3 board
  diagonalAdjacency: false,
  // §4 battle flow
  wavesPerBattle: 6,
  actionsPerWave: 2,
  actionsInWaveOne: 3,
  /** true: the player acts first in odd waves, the enemy in even waves. */
  alternateInitiative: true,
  musterLimit: 10,
  passFirstEmbers: 1,
  extraStepCost: 1,
  // §5 the Drift
  driftSize: 6,
  driftFree: 2,
  driftStepCost: 1,
  driftTakes: 1,
  driftTakesAfterElite: 2,
  driftSkipReward: 3,
  driftAdvancePerNode: 2,
  openingDriftSize: 8,
  openingDriftTakes: 3,
  echoChance: 1 / 3,
  echoWeightOwnedTwice: 3,
  omenWeight: 1.5,
  rarityOdds: { common: 65, uncommon: 31, rare: 4 },
  rarePityPerDrift: 1,
  // §6-§7 statuses
  burnSpreadDivisor: 2,
  poisonDecays: true,
  triggerQueueCap: 200,
  // §9 winning
  playerHp: 50,
  enemyHp: { fight: 12, elite: 22, boss: 40 },
  simultaneousZeroPlayerWins: true,
  // §10 levels
  rekindleCopies: 3,
  fireExists: true,
  fireStatMultiplier: 1.5,
  // §11 economy
  startEmbers: 8,
  battlePay: { fight: 5, elite: 8, boss: 12 },
  interestPer: 5,
  interestCap: 4,
  marketPrices: { common: 3, uncommon: 5, rare: 8 },
  sigilPrice: 6,
  rerollBase: 1,
  hearthHealFraction: 0.3,
  // §2 scope
  sextonUnlocksAfterWin: true,
  // map
  mapWidth: 7,
  mapHeight: 15,
  mapPaths: 6,
  eliteFromRow: 5,
} as const;

export type Flags = typeof FLAGS;
