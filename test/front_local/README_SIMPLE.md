# 🚀 Interface de Test Rent2Repay - Guide Simple

## ⚡ Démarrage Rapide (3 étapes)

### 1. Lancer la blockchain locale
```bash
npx hardhat node
```

### 2. Déployer les contrats
```bash
npx hardhat run test/front_local/deploy-simple.js --network localhost
```

### 3. Ouvrir l'interface
```bash
cd test/front_local
python3 -m http.server 8000
```
Puis ouvrir dans le navigateur : `http://localhost:8000`

> ⚠️ **Important** : Les wallets Web3 (Rabby, MetaMask) ne fonctionnent pas avec `file://` protocol. Il faut obligatoirement un serveur local HTTP.

## ✅ Ce qui est configuré automatiquement

- **Tous les contrats** : Rent2Repay, MockRMM, WXDAI, USDC, debtWXDAI, debtUSDC
- **User1 pré-configuré** : 100 WXDAI et 50 USDC par semaine + dettes
- **Tokens mintés** : 10 000 de chaque pour deployer et user1
- **config.js automatiquement mis à jour** avec les nouvelles adresses

## 🎮 Tests disponibles

### Avec le compte Deployer (admin)
- ✅ Configuration Rent2Repay
- ✅ Remboursements pour User1
- ✅ Gestion des tokens (mint/burn/approve)
- ✅ Administration (pause/unpause)

### Avec User1 (0x7099...)
- ✅ Modification de sa configuration
- ✅ Vérification de ses limites
- ✅ Tests des tokens de dette

## 🔧 Adresses qui changent

⚠️ **Important** : Les adresses changent à chaque redémarrage de Hardhat !

**Solution** : Le script `deploy-simple.js` met automatiquement à jour `config.js`

## 🎯 Workflow de test typique

1. Connecter MetaMask/Rabby avec le compte deployer
2. Vérifier les balances (tout devrait être > 0)
3. Tester une configuration Rent2Repay
4. Tester un remboursement pour User1
5. Mint/burn des tokens de test
6. Changer de compte vers User1 pour tester côté utilisateur

## 🆘 Dépannage

**"Aucun token dans les dropdowns"**
→ Relancez le déploiement, config.js sera mis à jour

**"Balance à 0"** 
→ Vérifiez que vous êtes sur le bon compte (deployer ou user1)

**"Transaction échoue"**
→ Vérifiez que MetaMask/Rabby est sur le réseau Hardhat (chainId 31337)

## 🏁 C'est tout !

Cette configuration simple fonctionne à tous les coups et permet de tester toutes les fonctionnalités Rent2Repay localement. 