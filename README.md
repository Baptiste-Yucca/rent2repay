# Rent2Repay - Système de Remboursement Automatique

🏠 **Rent2Repay** permet aux utilisateurs de configurer des remboursements automatiques de leurs dettes avec leurs tokens ERC20, directement depuis leur loyer.

## 🚀 Démarrage Rapide

### 1. Installation
```bash
npm install
```

### 2. Lancement du Système Complet
```bash
# Terminal 1 - Lancer le node local
npx hardhat node

# Terminal 2 - Déployer les contrats et configurer
npx hardhat run test/front_local/deploy-complete-auto.js --network localhost

# Terminal 3 - Lancer l'interface web
cd test/front_local
python3 -m http.server 8000
# Ou avec Node.js : npx serve .
```

### 3. Accès à l'Interface
Ouvrir : http://localhost:8000

## 📋 Adresses Déployées

Les adresses sont automatiquement mises à jour dans `config.js` et `test/front_local/config.js` :

- **Rent2Repay** : Contrat principal
- **MockRMM** : Mock du Risk Management Module
- **WXDAI/USDC** : Tokens de test
- **debtWXDAI/debtUSDC** : Tokens de dette (pour l'interface)

## 🔧 Scripts Utiles

### Vérification d'un wallet
```bash
cd test/front_local
node check-script.js 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### Mint et approve des tokens
```bash
# Mint + approve pour un utilisateur
node token-script.js 3 100 WXDAI 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
node token-script.js 3 100 USDC 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### Configuration des dettes (pour les tests)
```javascript
// Créer set-debt.js dans test/front_local/
const ethers = require('ethers');
const config = require('./config.js');

async function setDebt() {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const deployerKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const deployer = new ethers.Wallet(deployerKey, provider);
    
    const mockRMM = new ethers.Contract(config.CONTRACTS.RMM, [
        'function setDebt(address borrower, address asset, uint256 amount)'
    ], deployer);
    
    const user1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const debtAmount = ethers.parseUnits('1000', 18);
    
    await mockRMM.setDebt(user1, config.CONTRACTS.WXDAI, debtAmount);
    await mockRMM.setDebt(user1, config.CONTRACTS.USDC, debtAmount);
    
    console.log('✅ Dettes configurées');
}

setDebt().catch(console.error);
```

### Test de remboursement
```bash
# Remboursement de 25 tokens par l'admin pour User1
node repay-script.js 25 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

## 👤 Comptes de Test

| Adresse | Clé Privée | Rôle |
|---------|------------|------|
| `0xf39F...2266` | `0xac09...f80` | Admin/Deployer |
| `0x7099...79C8` | `0x59c6...90d` | User1 (Pré-configuré) |
| `0x3C44...93BC` | `0x5de4...65a` | User2 |

## 🔄 Fonctionnement

1. **User1** configure ses limites hebdomadaires via l'interface ou :
   ```javascript
   rent2repay.configureRent2Repay([wxdai, usdc], [limite_wxdai, limite_usdc])
   ```

2. **User1** donne des allowances à Rent2Repay pour ses tokens

3. **N'importe qui** peut déclencher un remboursement :
   ```javascript
   rent2repay.rent2repay(user1, token, montant)
   ```

4. Le système vérifie les limites et rembourse automatiquement via le RMM

## 🎯 Interface Web

L'interface permet de :
- ✅ Visualiser les balances et allowances
- ✅ Configurer les limites de remboursement
- ✅ Tester les remboursements
- ✅ Gérer les tokens (mint/approve)
- ✅ Voir l'historique des transactions

## 🛠️ Développement

### Compilation
```bash
npx hardhat compile
```

### Tests
```bash
npx hardhat test
```

### Nettoyage
```bash
# Redémarrer tout
pkill -f "npx hardhat node"
rm -rf cache/ artifacts/
npx hardhat clean
```

## 📁 Structure du Projet

```
rent2repay/
├── contracts/           # Contrats Solidity
├── test/               # Tests
│   └── front_local/    # Interface web et scripts
├── scripts/            # Scripts de déploiement
├── config.js           # Adresses des contrats
└── README.md           # Ce fichier
```

## 🔍 Troubleshooting

### "Insufficient debt to repay"
Configurer des dettes dans MockRMM avec le script set-debt.js

### "Allowance insuffisante"
Utiliser le script token avec l'action 3 (mint+approve)

### Adresses changent à chaque restart
Normal avec Hardhat. Relancer le deploy-complete-auto.js

### Interface ne se connecte pas
Vérifier que le node local est bien lancé sur le port 8545
