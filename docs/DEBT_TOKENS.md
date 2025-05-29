# Tokens de Dette - Guide d'utilisation

Ce guide explique comment utiliser les tokens de dette `armmv3WXDAI` et `armmv3USDC` dans le projet Rent2Repay.

## 📋 Vue d'ensemble

Les tokens de dette sont des tokens ERC20 qui représentent la dette d'un utilisateur dans le protocole Aave. Dans notre environnement de développement local, nous utilisons des contrats mock pour simuler ces tokens.

### Tokens supportés

- **armmv3WXDAI** : Token de dette variable pour WXDAI
  - Adresse mainnet : `0x9908801df7902675c3fedd6fea0294d18d5d5d34`
  - Asset sous-jacent : WXDAI

- **armmv3USDC** : Token de dette variable pour USDC  
  - Adresse mainnet : `0x69c731aE5f5356a779f44C355aBB685d84e5E9e6`
  - Asset sous-jacent : USDC

## 🚀 Déploiement sur le réseau local

### 1. Démarrer le nœud local Hardhat

```bash
npx hardhat node
```

### 2. Déployer les contrats

```bash
npx hardhat ignition deploy ignition/modules/DebtTokens.js --network localhost
```

Cette commande déploiera :
- Les tokens sous-jacents (WXDAI et USDC)
- Les tokens de dette (armmv3WXDAI et armmv3USDC)

### 3. Noter les adresses déployées

Après le déploiement, notez les adresses des contrats pour les utiliser dans vos scripts.

## 🔧 Utilisation des utilitaires

### Fonctions disponibles

Le fichier `scripts/debtTokenUtils.js` fournit plusieurs fonctions utilitaires :

#### `getDebtTokenBalance(tokenAddress, userAddress)`
Obtient le solde d'un token de dette pour un utilisateur.

```javascript
const balance = await getDebtTokenBalance(
  "0x...", // adresse du token de dette
  "0x..."  // adresse de l'utilisateur
);
```

#### `getDebtTokenInfo(tokenAddress)`
Obtient les informations détaillées d'un token de dette.

```javascript
const info = await getDebtTokenInfo("0x...");
// Retourne: { name, symbol, decimals, totalSupply, underlyingAsset }
```

#### `mintDebtTokens(tokenAddress, userAddress, amount)`
Simule un emprunt en mintant des tokens de dette.

```javascript
await mintDebtTokens(
  "0x...", // adresse du token de dette
  "0x...", // adresse de l'utilisateur
  "1000"   // montant en format lisible
);
```

#### `burnDebtTokens(tokenAddress, userAddress, amount)`
Simule un remboursement en brûlant des tokens de dette.

```javascript
await burnDebtTokens(
  "0x...", // adresse du token de dette
  "0x...", // adresse de l'utilisateur
  "500"    // montant en format lisible
);
```

## 🧪 Tests et démonstration

### Exécuter les tests

```bash
npx hardhat run scripts/testDebtTokens.js --network localhost
```

Ce script effectue une démonstration complète :
1. Affichage des informations des tokens
2. Vérification des soldes initiaux
3. Simulation d'emprunts
4. Vérification des nouveaux soldes
5. Simulation de remboursements
6. Affichage des soldes finaux

### Exemple d'utilisation dans vos contrats

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ExempleUtilisation {
    IERC20 public armmv3WXDAI;
    IERC20 public armmv3USDC;
    
    constructor(address _armmv3WXDAI, address _armmv3USDC) {
        armmv3WXDAI = IERC20(_armmv3WXDAI);
        armmv3USDC = IERC20(_armmv3USDC);
    }
    
    function getDebtBalance(address user) external view returns (uint256, uint256) {
        uint256 wxdaiDebt = armmv3WXDAI.balanceOf(user);
        uint256 usdcDebt = armmv3USDC.balanceOf(user);
        return (wxdaiDebt, usdcDebt);
    }
}
```

## 📝 Notes importantes

1. **Environnement local uniquement** : Ces contrats mock sont destinés au développement local uniquement.

2. **Interface ERC20 standard** : Les tokens de dette implémentent l'interface ERC20 standard, vous pouvez donc utiliser `balanceOf`, `transfer`, etc.

3. **Fonctionnalités supplémentaires** : Les mocks incluent des fonctions `mint` et `burn` pour simuler les emprunts et remboursements.

4. **Asset sous-jacent** : Chaque token de dette est lié à un asset sous-jacent accessible via `getUnderlyingAsset()`.

## 🔗 Intégration avec Rent2Repay

Pour intégrer ces tokens dans votre système Rent2Repay :

1. Utilisez les adresses des tokens déployés
2. Implémentez la logique de vérification des dettes via `balanceOf`
3. Utilisez les fonctions utilitaires pour les tests et le développement
4. Adaptez les contrats pour interagir avec les vrais tokens sur le mainnet

## 🛠️ Commandes utiles

```bash
# Compiler les contrats
npx hardhat compile

# Déployer sur localhost
npx hardhat ignition deploy ignition/modules/DebtTokens.js --network localhost

# Exécuter les tests
npx hardhat run scripts/testDebtTokens.js --network localhost

# Vérifier la compilation
npx hardhat test
``` 