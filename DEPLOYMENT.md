# 🚀 Guide de Déploiement Rent2Repay

## 📋 Vue d'ensemble

Le système Rent2Repay permet maintenant de gérer automatiquement les remboursements de dette sur le RMM (Risk Management Module) avec support pour WXDAI et USDC.

## 🔧 Configuration

### 1. Variables d'environnement

Copiez `.env.example` vers `.env` et configurez vos variables :

```bash
cp .env.example .env
```

#### Variables principales :
- `PRIVATE_KEY` : Clé privée pour le déploiement (sans 0x)
- `GNOSIS_RMM_PROXY` : 0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3
- `GNOSIS_WXDAI_ADDRESS` : 0xe91d153e0b41518a2ce8dd3d7944fa863463a97d
- `GNOSIS_USDC_ADDRESS` : 0xddafbb505ad214d7b80b1f830fccc89b60fb7a83

### 2. Assets supportés

Le système supporte deux tokens de remboursement :

#### Gnosis Mainnet :
- **WXDAI** : `0xe91d153e0b41518a2ce8dd3d7944fa863463a97d`
- **USDC** : `0xddafbb505ad214d7b80b1f830fccc89b60fb7a83`

#### Debt Tokens (pour référence) :
- **Debt WXDAI** : `0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34`
- **Debt USDC** : `0x69c731aE5f5356a779f44C355aBB685d84e5E9e6`

## 🏗️ Déploiement

### Tests locaux

```bash
# Démarrer un nœud Hardhat local
npx hardhat node

# Dans un autre terminal, déployer en local
npx hardhat run scripts/deploy-modular.js --network localhost

# Ou exécuter les tests complets
npx hardhat run scripts/test-local-deployment.js --network localhost
```

### Chiado Testnet

```bash
npx hardhat run scripts/deploy-modular.js --network chiado
```

### Gnosis Mainnet

```bash
npx hardhat run scripts/deploy-modular.js --network gnosis
```

## 🧪 Tests en local

Le script `test-local-deployment.js` effectue une suite de tests complète :

1. **Déploiement des mocks** (MockRMM, MockERC20 pour WXDAI et USDC)
2. **Déploiement de Rent2Repay**
3. **Configuration utilisateur** (limite hebdomadaire)
4. **Simulation de dette** sur le MockRMM
5. **Test de remboursement** complet
6. **Test de changement d'asset**

```bash
npx hardhat run scripts/test-local-deployment.js --network localhost
```

## 📊 Fonctionnement du RMM

### Architecture
- **RMM** : Plateforme de dépôt/emprunt
- **Assets de remboursement** : WXDAI ou USDC (tokens natifs)
- **Debt Tokens** : Représentent la dette (utilisés en lecture seulement)

### Processus de remboursement
1. L'utilisateur configure sa limite hebdomadaire
2. Un opérateur appelle `rent2repay(user, amount)`
3. Le contrat vérifie les limites
4. Transfert des tokens de l'opérateur vers le contrat
5. Approbation pour le RMM
6. Appel `rmm.repay()` avec les bons paramètres
7. Mise à jour des compteurs

## 🔄 Gestion des Assets

### Changement d'asset par défaut

Seuls les admins peuvent changer l'asset de remboursement :

```solidity
// Changer vers USDC
rent2repay.setRepaymentAsset("0xddafbb505ad214d7b80b1f830fccc89b60fb7a83");

// Changer vers WXDAI  
rent2repay.setRepaymentAsset("0xe91d153e0b41518a2ce8dd3d7944fa863463a97d");
```

### Configuration par réseau

Le script de déploiement choisit automatiquement l'asset par défaut selon `GNOSIS_DEFAULT_ASSET` ou `CHIADO_DEFAULT_ASSET`.

## 🛠️ Utilisation

### Configuration utilisateur

```solidity
// L'utilisateur configure sa limite hebdomadaire (100 WXDAI)
uint256 weeklyLimit = 100 * 10**18;
rent2repay.configureRent2Repay(weeklyLimit);
```

### Exécution du remboursement

```solidity
// Un opérateur rembourse 50 WXDAI pour l'utilisateur
uint256 amount = 50 * 10**18;
rent2repay.rent2repay(userAddress, amount);
```

### Vérifications

```solidity
// Vérifier la configuration de l'utilisateur
(uint256 weeklyMax, uint256 lastRepay, uint256 currentSpent) = 
    rent2repay.getUserConfig(userAddress);

// Montant disponible cette semaine
uint256 available = rent2repay.getAvailableAmountThisWeek(userAddress);
```

## 🔒 Sécurité

### Rôles et permissions
- **ADMIN_ROLE** : Configuration des assets
- **EMERGENCY_ROLE** : Pause/unpause, récupération d'urgence
- **OPERATOR_ROLE** : Suppression forcée d'utilisateurs

### Protections
- Limites hebdomadaires par utilisateur
- Vérifications de débordement
- Validation des adresses
- Système de pause d'urgence

## 📝 Notes importantes

1. **Tokens de remboursement vs Debt Tokens** : On rembourse toujours avec les tokens natifs (WXDAI/USDC), jamais avec les debt tokens
2. **Mode de taux d'intérêt** : Par défaut utilise le mode 2 (Variable rate)
3. **Modularité** : Le système est conçu pour facilement ajouter de nouveaux assets ou réseaux
4. **Tests** : Toujours tester en local avant de déployer sur testnet/mainnet

## 🐛 Dépannage

### Erreurs communes

1. **"Token transfer failed"** : Vérifier les allowances et balances
2. **"WeeklyLimitExceeded"** : L'utilisateur a atteint sa limite hebdomadaire
3. **"UserNotAuthorized"** : L'utilisateur n'a pas configuré Rent2Repay

### Logs utiles

```bash
# Voir les logs détaillés du déploiement
npx hardhat run scripts/deploy-modular.js --network localhost

# Vérifier la compilation
npx hardhat compile

# Tests avec plus de détails
npx hardhat run scripts/test-local-deployment.js --network localhost
``` 