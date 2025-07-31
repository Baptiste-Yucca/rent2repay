# CLI Scripts pour Rent2Repay

## 🚨 Problème connu : "Fichier de configuration non trouvé"

Si vous obtenez l'erreur :
```
❌ Fichier de configuration non trouvé.
📁 Chemin recherché: scripts/tmp/deployed-contracts.json
```

C'est normal ! Le fichier `deployed-contracts.json` est généré lors du déploiement local et n'existe pas par défaut.

## 🔧 Solutions

### Option 1 : Commande automatique (recommandée)
```bash
yarn setup:local
```

### Option 2 : Déploiement manuel
```bash
# Terminal 1 : Démarrer le nœud Hardhat
npx hardhat node

# Terminal 2 : Déployer les contrats
yarn deploy:local

# Terminal 2 : Tester les utilisateurs
yarn test:users
```

### Option 3 : Script complet
```bash
# Déployer puis tester en une commande
yarn deploy:local && yarn test:users
```

## 📋 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `yarn test:users` | Affiche tous les utilisateurs de test |
| `yarn test:config` | Configuration rapide d'un utilisateur |
| `yarn test:repay` | Test de remboursement rapide |
| `yarn test:concurrency` | Test de concurrence entre runners |
| `yarn test:status` | Affiche le statut d'un utilisateur |
| `yarn setup:local` | Déploie et teste en une commande |

## 👥 Utilisateurs de test

- **👑 DEPLOYER** : Admin qui déploie et administre
- **⚙️ USER** : Utilisateur qui configure son rent2repay
- **🏃‍♂️ RUNNER_1** : Exécute les remboursements
- **🔧 OPERATOR** : Opérations système
- **🚨 EMERGENCY** : Arrêt d'urgence
- **🏃‍♀️ RUNNER_2** : Second runner pour tests concurrents

## 📁 Fichiers générés

- `scripts/tmp/deployed-contracts.json` : Configuration des contrats déployés
- Généré automatiquement par `yarn deploy:local`
- **Ne pas supprimer** - nécessaire pour les tests CLI 