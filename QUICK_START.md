# 🚀 Quick Start Guide - Rent2Repay

## Après `git clone` - Commandes essentielles

### 1. Installation (obligatoire)
```bash
npm install
npm run compile
```

### 2. Déploiement et test (recommandé)
```bash
npm run setup:local
```

### 3. Ou déploiement manuel
```bash
# Terminal 1
npx hardhat node

# Terminal 2
npm run deploy:local
npm run test:users
```

## 🔧 Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run setup:local` | **Déploie et teste en une commande** |
| `npm run test:users` | Affiche tous les utilisateurs de test |
| `npm run test:config` | Configuration rapide d'un utilisateur |
| `npm run test:repay` | Test de remboursement rapide |
| `npm run test:concurrency` | Test de concurrence |
| `npm run test:status` | Statut d'un utilisateur |
| `npm test` | Tous les tests Hardhat |
| `npm run coverage` | Couverture de code |

## 👥 Utilisateurs de test

- **👑 DEPLOYER** : Admin (0xf39Fd6...)
- **⚙️ USER** : Utilisateur (0x7099...)
- **🏃‍♂️ RUNNER_1** : Exécuteur (0x3C44...)
- **🔧 OPERATOR** : Opérateur (0x90F7...)
- **🚨 EMERGENCY** : Urgence (0x15d3...)
- **🏃‍♀️ RUNNER_2** : Second exécuteur (0x9965...)

## 🚨 Problèmes courants

### "Fichier de configuration non trouvé"
```bash
npm run setup:local
```

### "Cannot find module"
```bash
npm install
```

### "Contract not deployed"
```bash
npm run deploy:local
```

## 📁 Fichiers importants

- `contracts/Rent2Repay.sol` - Contrat principal
- `scripts/tmp/deployed-contracts.json` - Configuration déployée
- `test/Rent2Repay.test.js` - Tests principaux
- `scripts/cli/` - Outils de ligne de commande

## 🎯 Workflow recommandé

1. **Installation** : `npm install && npm run compile`
2. **Déploiement** : `npm run setup:local`
3. **Test** : `npm run test:users`
4. **Développement** : `npm test` 