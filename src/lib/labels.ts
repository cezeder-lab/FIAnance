import type { AssetKind, GoalPriority, ItemCategory } from '../types';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  revenu: 'Revenus',
  depense_fixe: 'Dépenses fixes',
  depense_variable: 'Dépenses variables',
  epargne: 'Épargne & investissement',
};

export const CATEGORY_SINGULAR: Record<ItemCategory, string> = {
  revenu: 'Revenu',
  depense_fixe: 'Dépense fixe',
  depense_variable: 'Dépense variable',
  epargne: 'Épargne / investissement',
};

/** Wording of the per-month checkbox of each category. */
export const CLEARED_LABELS: Record<ItemCategory, { done: string; todo: string; remaining: string; allDone: string }> = {
  revenu: { done: 'Reçu', todo: 'Pas encore reçu', remaining: 'Reste à recevoir', allDone: 'Tout est reçu' },
  depense_fixe: { done: 'Payé', todo: 'Pas encore payé', remaining: 'Reste à payer', allDone: 'Tout est payé' },
  depense_variable: { done: 'Payé', todo: 'Pas encore payé', remaining: 'Reste à payer', allDone: 'Tout est payé' },
  epargne: { done: 'Versé', todo: 'Pas encore versé', remaining: 'Reste à verser', allDone: 'Tout est versé' },
};

export const PRIORITY_LABELS: Record<GoalPriority, string> = {
  haute: 'Prioritaire',
  basse: 'Pas prioritaire',
  abandonne: 'Abandonné',
};

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  liquide: 'Liquide',
  investi: 'Investi',
  crypto: 'Crypto',
};
