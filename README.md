# FIAnance

Application de bureau personnelle (Windows) pour suivre ses flux mensuels, ses objectifs d'achat et son patrimoine.
100 % locale : aucune connexion bancaire, aucun cloud. Toutes les données sont saisies à la main et stockées en JSON sur la machine.

## Modules

| Écran | Contenu |
|---|---|
| **Vue d'ensemble** | Cash-flow net du mois, patrimoine financier net disponible, taux d'épargne, progression des objectifs actifs, entrées prévues, évolution du patrimoine. |
| **Mois** | Revenus, dépenses fixes, dépenses variables, épargne/investissement. Chaque mois est indépendant ; un nouveau mois est pré-rempli avec les lignes **récurrentes** du mois précédent. Historique du cash-flow net. |
| **Objectifs** | Montant cible, date visée, priorité, montant déjà épargné, compte lié. Progression, reste à épargner, rythme nécessaire et badge vert/orange/rouge selon l'épargne liée à l'objectif dans le mois en cours. Entrées d'argent prévues (ex. vente de la Fabia). |
| **Patrimoine** | Financier (liquide, investi, crypto), immobilier/familial et héritage potentiel, affichés séparément. Seul le financier compte dans le « patrimoine financier net disponible ». Historique mois par mois. |
| **Simulateurs** | Intérêts composés (brut et net de fiscalité à la sortie, courbe + tableau) et rythme d'épargne nécessaire pour un objectif. |

Règles de calcul :

- **Cash-flow net** = revenus encaissés − dépenses fixes − dépenses variables − épargne allouée.
  Les revenus marqués « avantage en nature » (ex. véhicule de fonction) sont affichés mais exclus du cash-flow.
- **Rythme nécessaire** = reste à épargner ÷ mois restants avant la date visée, arrondi à l'euro supérieur.
  **Rythme actuel** = somme des lignes d'épargne du mois en cours liées à l'objectif (bouton « Options » d'une ligne d'épargne).
  Badge vert si actuel ≥ nécessaire, orange si actuel ≥ 50 % du nécessaire, rouge en dessous ou si l'échéance est dépassée.

## Développement

Prérequis : Node.js 22.

```bash
npm install
npm run dev        # Vite + Electron avec rechargement à chaud
npm run dev:web    # interface seule dans le navigateur (données en localStorage), pratique pour le design
npm run typecheck
```

## Installeur Windows

```bash
npm run dist       # à lancer sous Windows → release/FIAnance Setup <version>.exe
```

Sous Linux/macOS, electron-builder a besoin de Wine pour produire l'installeur NSIS ; le plus simple est de passer par la CI.

### Publication via GitHub Actions

Le workflow `.github/workflows/release.yml` tourne sur `windows-latest` à chaque tag `v*` : il construit l'installeur et le publie dans les Releases du dépôt.

```bash
npm version patch          # met à jour package.json et crée le tag vX.Y.Z
git push --follow-tags
```

Le workflow échoue si le tag ne correspond pas à la version de `package.json`.
L'installeur n'est pas signé : Windows SmartScreen affichera un avertissement au premier lancement (« Informations complémentaires » → « Exécuter quand même »).

## Données

- Emplacement : `%APPDATA%\FIAnance\data\` (`mois.json`, `objectifs.json`, `patrimoine.json`), en dehors du dossier d'installation : elles survivent aux mises à jour.
  Le bouton « Dossier des données » de l'application l'ouvre directement.
- Sauvegarde automatique à chaque modification (écriture atomique, fichier temporaire puis renommage).
- « Exporter une sauvegarde » copie les trois fichiers, horodatés, dans le dossier de votre choix. Pour restaurer, fermez l'application et replacez les fichiers dans le dossier des données en retirant le suffixe horodaté.
- Si un fichier devient illisible, il est mis de côté (`*.illisible_<date>.json`) au lieu d'être écrasé.
- `src/seed/seed.json` contient les données de démarrage, utilisées uniquement au tout premier lancement. Aucune donnée réelle n'est versionnée (voir `.gitignore`).

## Structure

```
electron/          processus principal : fenêtre, IPC, lecture/écriture des JSON
  main.js
  preload.js       API exposée à l'interface (contextIsolation, sandbox)
  storage.js
src/
  lib/             calculs (cash-flow, objectifs, intérêts composés), dates, formats
  state/           chargement, état et sauvegarde automatique
  views/           un fichier par écran
  components/      éléments d'interface partagés
  seed/seed.json   données de démarrage
```
