# Scripts de déploiement et de test Rent2Repay

Ce dossier contient les scripts pour déployer et tester les contrats Rent2Repay en local.

## 🚀 Déploiement

### Étape 1: Démarrer le réseau local Hardhat

```bash
# Terminal 1 - Démarrer le nœud Hardhat
npx hardhat node
```

### Étape 2: Déployer les contrats

```bash
# Terminal 2 - Déployer tous les contrats
npx hardhat run scripts/deploy-local.js --network localhost
```

Le script déploie dans cet ordre :
1. **MockERC20** - Tokens de test (USDC, WXDAI, DAO Token)
2. **MockDebtToken** - Tokens de dette (armmv3USDC, armmv3WXDAI)
3. **MockRMM** - Module de gestion des risques simulé
4. **Rent2Repay** - Contrat principal

### Fichier de configuration généré

Le script génère un fichier `deployed-contracts.json` à la racine du projet contenant :
- Les adresses de tous les contrats déployés
- Les paires de tokens configurées
- Les paramètres de configuration
- Les métadonnées de déploiement

## 🧪 Tests et utilisation

### Script de test rapide

```bash
# Exécuter un test rapide de tous les contrats
npx hardhat run scripts/test-utils.js --network localhost
```

### Test de gestion des fees et changements de rôles 💰

```bash
# Tester complètement la gestion des fees et des rôles admin
npx hardhat run scripts/test-fees-management.js --network localhost
```

Ce script effectue un test complet en 10 étapes :

1. **🔍 Vérification des rôles admin** - Affiche qui peut changer les fees
2. **💸 Affichage des fees actuelles** - Logs des fees DAO et tips runner en BPS
3. **⚡ Modification des fees** - Multiplie par 2 les fees DAO, par 3 les tips runner
4. **✔️ Vérification des changements** - Confirme que les modifications sont appliquées
5. **👑 Changement d'admin** - Transfert des rôles vers l'adresse #10
6. **🔍 Vérification whoami** - Confirme les nouveaux rôles avec `whoami()`
7. **🚫 Test restriction ancienne adresse** - Vérifie qu'elle ne peut plus modifier
8. **✅ Test nouvelle adresse** - Divise par 2 les fees DAO, par 3 les tips runner
9. **🔍 Vérification finale** - Confirme les derniers changements
10. **🔄 Restauration admin initial** - Remet l'adresse originale en admin

**Fonctionnalités testées :**
- Gestion des rôles `ADMIN_ROLE` et `DEFAULT_ADMIN_ROLE`
- Modification des fees DAO (`daoFeesBPS`)
- Modification des tips runner (`senderTipsBPS`)
- Sécurité des permissions
- Transfert et révocation de rôles
- Validation des limites (max 100% de fees totales)

### Utilisation des utilitaires en ligne de commande

```bash
# Démarrer la console Hardhat
npx hardhat console --network localhost
```

Dans la console :

```javascript
// Charger les utilitaires
const { loadContracts, testHelper } = require('./scripts/test-utils.js');

// Charger les contrats déployés
const { contracts, addresses, signers } = await loadContracts();
const { deployer, user1, user2 } = signers;

// Mint des tokens de test
await testHelper.mintTokens(user1.address, contracts);

// Afficher les balances
await testHelper.showBalances(user1.address, contracts);

// Configurer Rent2Repay pour un utilisateur
await testHelper.configureRent2Repay(user1, contracts, addresses);

// Afficher le statut d'un utilisateur
await testHelper.showUserStatus(user1.address, contracts, addresses);

// Exécuter un remboursement
await testHelper.executeRepayment(
  user2, // exécuteur
  user1.address, // utilisateur dont on rembourse la dette
  addresses.MockUSDC, // token à utiliser
  ethers.parseEther("100"), // montant
  contracts
);
```

## 📋 Adresses des contrats déployés

Après déploiement, vous trouverez les adresses dans le fichier `deployed-contracts.json` :

```json
{
  "network": "localhost",
  "chainId": 31337,
  "contracts": {
    "Rent2Repay": "0x...",
    "MockRMM": "0x...",
    "MockUSDC": "0x...",
    "MockWXDAI": "0x...",
    "MockDAOToken": "0x...",
    "MockDebtUSDC": "0x...",
    "MockDebtWXDAI": "0x..."
  },
  "tokenPairs": [
    {
      "token": "0x...",
      "debtToken": "0x...",
      "name": "USDC",
      "symbol": "USDC"
    }
  ]
}
```

## 🔧 Fonctions utilitaires disponibles

### `testHelper.showBalances(userAddress, contracts)`
Affiche les balances de tous les tokens pour un utilisateur.

### `testHelper.mintTokens(userAddress, contracts, amounts)`
Mint des tokens de test à un utilisateur.
```javascript
// Mint avec montants par défaut
await testHelper.mintTokens(user1.address, contracts);

// Mint avec montants personnalisés
await testHelper.mintTokens(user1.address, contracts, {
  usdc: "5000",
  wxdai: "3000",
  daoToken: "2000"
});
```

### `testHelper.configureRent2Repay(userSigner, contracts, addresses, config)`
Configure le système Rent2Repay pour un utilisateur.
```javascript
await testHelper.configureRent2Repay(user1, contracts, addresses, {
  tokensToAuthorize: [addresses.MockUSDC],
  weeklyAmounts: [ethers.parseEther("500")],
  periodicity: 7 * 24 * 60 * 60 // 7 jours
});
```

### `testHelper.executeRepayment(executorSigner, userAddress, tokenAddress, amount, contracts)`
Exécute un remboursement pour un utilisateur.

### `testHelper.showUserStatus(userAddress, contracts, addresses)`
Affiche le statut de configuration Rent2Repay d'un utilisateur.

## 📊 Paramètres de configuration par défaut

- **Frais DAO** : 0.5% (50 BPS)
- **Pourboire expéditeur** : 0.25% (25 BPS)
- **Réduction frais DAO** : 50% (5000 BPS)
- **Montant minimum pour réduction** : 1000 DAO tokens
- **Périodicité par défaut** : 7 jours

## 🛠️ Commandes utiles

```bash
# Recompiler les contrats
npx hardhat compile

# Nettoyer les artefacts
npx hardhat clean

# Vérifier les contrats déployés
npx hardhat verify --network localhost <ADDRESS>

# Afficher les comptes disponibles
npx hardhat accounts --network localhost

# Afficher les balances ETH
npx hardhat balance --network localhost --account 0x...
```

## 🎯 Scénarios de test suggérés

1. **Configuration basique** : Un utilisateur configure Rent2Repay
2. **Remboursement normal** : Exécution d'un remboursement dans les limites
3. **Test des limites** : Tentative de remboursement au-delà des limites
4. **Réduction de frais** : Utilisateur avec suffisamment de DAO tokens
5. **Révocation** : Utilisateur révoque ses autorisations
6. **Multi-tokens** : Configuration avec plusieurs tokens simultanément

## 🚨 Dépannage

### Erreur "nonce too high"
```bash
# Réinitialiser les comptes
npx hardhat node --reset
```

### Erreur "network not found"
Vérifiez que le nœud Hardhat est démarré et accessible sur `http://127.0.0.1:8545`.

### Fichier de configuration manquant
Exécutez d'abord le script de déploiement avant d'utiliser les utilitaires de test. 