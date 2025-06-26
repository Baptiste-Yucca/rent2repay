# Scripts CLI de Test - Rent2Repay

Ce dossier contient des scripts de ligne de commande pour tester rapidement les fonctionnalités de Rent2Repay avec différents utilisateurs prédéfinis.

## Configuration des Utilisateurs

6 utilisateurs sont automatiquement configurés avec des rôles spécifiques :

| Utilisateur | Rôle | Description | Emoji |
|-------------|------|-------------|-------|
| **DEPLOYER** | ADMIN_ROLE | Déploie et administre les contrats | 👑 |
| **CONFIGURATOR** | USER | Configure son rent2repay personnel | ⚙️ |
| **RUNNER_1** | EXECUTOR | Exécute les remboursements | 🏃‍♂️ |
| **OPERATOR** | OPERATOR_ROLE | Opérations système | 🔧 |
| **EMERGENCY** | EMERGENCY_ROLE | Arrêt d'urgence | 🚨 |
| **RUNNER_2** | EXECUTOR | Second runner pour tests concurrents | 🏃‍♀️ |

## Scripts Disponibles

### 1. Afficher les Utilisateurs
```bash
# Via NPM
npm run test:users

# Directement
node scripts/cli/show-users.js
```
Affiche tous les utilisateurs avec leurs adresses et rôles.

### 2. Configuration Rapide
```bash
# Avec périodicité par défaut (5 minutes)
npm run test:config

# Avec périodicité personnalisée (60 secondes)
node scripts/cli/quick-config.js 60
```
Configure le CONFIGURATOR avec :
- Tokens USDC et WXDAI autorisés
- Montants : 100 USDC et 50 WXDAI par période
- Périodicité configurable

### 3. Test de Remboursement
```bash
npm run test:repay
# ou
node scripts/cli/quick-repayment.js
```
Exécute un remboursement avec :
- Créer 200 USDC de dette pour le CONFIGURATOR
- RUNNER_1 exécute un remboursement de 100 USDC
- Affiche les résultats

### 4. Test de Concurrence
```bash
npm run test:concurrency
# ou
node scripts/cli/quick-concurrency.js
```
Teste la concurrence entre runners :
- Créer 1000 USDC de dette
- RUNNER_1 et RUNNER_2 tentent de rembourser simultanément
- Affiche les résultats de la concurrence

### 5. Statut d'un Utilisateur
```bash
# Statut du CONFIGURATOR (par défaut)
npm run test:status

# Statut d'une adresse spécifique
node scripts/cli/show-status.js 0x742d35Cc6635C0532925a3b8D238FADB1648e91e
```
Affiche :
- Balances des tokens (USDC, WXDAI)
- Balances des dettes
- Configuration Rent2Repay (si configuré)

## Workflow de Test Recommandé

1. **Déployer** les contrats :
   ```bash
   npm run deploy:local
   ```

2. **Voir les utilisateurs** disponibles :
   ```bash
   npm run test:users
   ```

3. **Configurer** un utilisateur avec périodicité courte :
   ```bash
   node scripts/cli/quick-config.js 60  # 1 minute pour test rapide
   ```

4. **Tester un remboursement** simple :
   ```bash
   npm run test:repay
   ```

5. **Tester la concurrence** :
   ```bash
   npm run test:concurrency
   ```

6. **Vérifier le statut** :
   ```bash
   npm run test:status
   ```

## Paramètres de Test Optimisés

Pour des **démonstrations rapides**, utilisez :
- **Périodicité** : 60-300 secondes (1-5 minutes)
- **Montants** : 100 USDC, 50 WXDAI (petits pour visualiser facilement)
- **Dette** : 200-1000 USDC selon le scénario

Pour des **tests de stress**, utilisez :
- **Périodicité** : 10-30 secondes
- **Montants** : 1000+ USDC/WXDAI
- **Dette** : 10000+ USDC

## Troubleshooting

### ❌ "Fichier de configuration non trouvé"
Vous devez d'abord déployer les contrats :
```bash
npm run deploy:local
```

### ❌ "Insufficient allowance"
Le script de configuration gère automatiquement les approbations, mais si vous testez manuellement, assurez-vous que les tokens sont approuvés.

### ❌ "Too early for next execution"
Attendez que la périodicité soit écoulée ou reconfigurez avec une périodicité plus courte.

## Intégration dans les Tests Hardhat

Vous pouvez aussi utiliser la bibliothèque dans vos tests Hardhat :

```javascript
const { loadTestEnvironment, QuickTest } = require('./scripts/test-lib.js');

describe("Mon test", function() {
    it("devrait configurer et rembourser", async function() {
        const { contracts, users } = await loadTestEnvironment();
        
        // Utiliser les fonctions QuickTest
        await QuickTest.quickConfig(60);
        await QuickTest.quickRepayment();
    });
});
``` 