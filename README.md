# Rent2Repay

Un système de remboursement automatique de dettes pour le protocole RMM (fork d'Aave) sur Gnosis Chain.

## 📋 Description

Rent2Repay permet aux utilisateurs d'autoriser des remboursements automatiques de leurs dettes sur le protocole RMM avec des limites hebdomadaires configurables. Le système utilise la fonction `repay` du protocole RMM pour effectuer les remboursements de manière sécurisée.

## 🏗️ Architecture

### Smart Contracts

#### `Rent2RepayAuthorizer.sol`
Contrat principal qui gère les autorisations et les limites de remboursement :

- **Structure `UserConfig`** :
  - `weeklyMaxAmount` : Montant maximum autorisé par semaine
  - `lastRepayTimestamp` : Timestamp du dernier remboursement
  - `currentWeekSpent` : Montant déjà remboursé cette semaine

- **Fonctions principales** :
  - `configureRent2Repay(uint256 weeklyMaxAmount)` : Configure l'autorisation avec un montant hebdomadaire
  - `revokeRent2Repay()` : Révoque l'autorisation
  - `validateAndUpdateRepayment(address user, uint256 amount)` : Valide et met à jour les limites
  - `getAvailableAmountThisWeek(address user)` : Retourne le montant disponible
  - `isAuthorized(address user)` : Vérifie si un utilisateur est autorisé

## 🌐 Protocole RMM

### Assets supportés sur Gnosis Chain
- **WXDAI** : `0xe91d153e0b41518a2ce8dd3d7944fa863463a97d`
- **USDC** : `0xddafbb505ad214d7b80b1f830fccc89b60fb7a83`

### Paramètres de remboursement
- **interestRateMode** : 2 (mode variable uniquement)
- **onBehalfOf** : Adresse de l'emprunteur à rembourser

## 🚀 Installation

```bash
# Cloner le repository
git clone <repository-url>
cd rent2repay

# Installer les dépendances
npm install
```

## 🛠️ Développement

### Compilation
```bash
npx hardhat compile
```

### Tests
```bash
npx hardhat test
```

### Déploiement local

1. **Démarrer un nœud Hardhat local** :
```bash
npx hardhat node
```

2. **Déployer les contrats** :
```bash
npx hardhat run scripts/deploy-rent2repay.js --network localhost
```

### Scripts disponibles

- `scripts/deploy-rent2repay.js` : Déploie et teste le contrat Rent2RepayAuthorizer

## 📊 Tests

Le projet inclut une suite de tests complète couvrant :

### Configuration
- ✅ Configuration avec montant valide
- ✅ Rejet de configuration avec montant zéro
- ✅ Reconfiguration avec montant différent
- ✅ Révocation d'autorisation
- ✅ Rejet de révocation non autorisée

### Limites hebdomadaires
- ✅ Montant complet disponible pour nouvel utilisateur
- ✅ Validation et mise à jour dans les limites
- ✅ Rejet de remboursement dépassant la limite
- ✅ Rejet pour utilisateur non autorisé

## 🔧 Configuration

### Hardhat
Le projet utilise Hardhat avec la configuration suivante :
- Solidity version : `^0.8.20`
- Network par défaut : Hardhat local
- Tests : Mocha + Chai

### Structure du projet
```
rent2repay/
├── contracts/
│   ├── Rent2RepayAuthorizer.sol
│   └── mocks/
├── test/
│   └── Rent2RepayAuthorizer.test.js
├── scripts/
│   └── deploy-rent2repay.js
├── src_RMM/
│   ├── RMM_code.sol
│   └── RMM_ABI.json
└── README.md
```

## 🔐 Sécurité

### Fonctionnalités de sécurité
- **Limites hebdomadaires** : Protection contre les remboursements excessifs
- **Autorisation explicite** : Les utilisateurs doivent explicitement autoriser le système
- **Validation des montants** : Vérification que les montants sont > 0
- **Reset automatique** : Les limites se remettent à zéro chaque semaine

### Bonnes pratiques
- Utilisation de `require()` pour les validations
- Émission d'événements pour la traçabilité
- Structure de données optimisée (une seule map)

## 📈 Fonctionnement

1. **Configuration** : L'utilisateur configure son autorisation avec `configureRent2Repay(montant)`
2. **Validation** : Avant chaque remboursement, `validateAndUpdateRepayment()` vérifie les limites
3. **Remboursement** : Si validé, le remboursement est effectué via la fonction `repay` du RMM
4. **Suivi** : Le système met à jour automatiquement les montants dépensés

## 🔮 Roadmap

### Phase 1 (Actuelle)
- ✅ Contrat d'autorisation avec limites hebdomadaires
- ✅ Tests unitaires complets
- ✅ Scripts de déploiement

### Phase 2 (À venir)
- 🔄 Contrat de remboursement automatique
- 🔄 Intégration avec le protocole RMM
- 🔄 Interface utilisateur (frontend)

### Phase 3 (Futur)
- 🔄 Système de proxy pour les upgrades
- 🔄 Support de tokens supplémentaires
- 🔄 Intégration avec Rabby Wallet

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :
1. Fork le projet
2. Créer une branche pour votre feature
3. Ajouter des tests pour vos modifications
4. Soumettre une Pull Request

## 📄 License

Ce projet est sous licence MIT.

## 📞 Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue sur GitHub.
