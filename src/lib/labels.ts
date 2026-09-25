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
