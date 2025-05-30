# 📋 Adresses de Référence - Rent2Repay

## 🌐 Gnosis Mainnet (Chain ID: 100)

⚠️ **CONFIGURATION DÉSACTIVÉE PAR DÉFAUT** - Pour éviter les déploiements accidentels sur le mainnet.

### RMM (Risk Management Module)
- **Proxy**: `0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3`
- **Version**: `0x5ad7501426e6e777B331Bd8cb077F7a35Bf2E211`

### Assets de Remboursement
- **WXDAI**: `0xe91d153e0b41518a2ce8dd3d7944fa863463a97d`
- **USDC**: `0xddafbb505ad214d7b80b1f830fccc89b60fb7a83`

### Debt Tokens (pour référence)
- **Debt WXDAI**: `0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34`
- **Debt USDC**: `0x69c731aE5f5356a779f44C355aBB685d84e5E9e6`

### Rent2Repay Contract
- **Address**: `TBD - à déployer (configuration désactivée)`

---

## 🧪 Chiado Testnet (Chain ID: 10200)

### RMM (Risk Management Module)
- **Proxy**: `TBD - à configurer`
- **Version**: `TBD - à configurer`

### Assets de Remboursement
- **WXDAI**: `TBD - à configurer`
- **USDC**: `TBD - à configurer`

### Rent2Repay Contract
- **Address**: `TBD - à déployer`

---

## 🏠 Local Development

Les adresses locales changent à chaque redémarrage du réseau Hardhat.
Utilisez les scripts de déploiement pour obtenir les adresses actuelles :

```bash
npx hardhat run scripts/deploy-modular.js --network hardhat
npx hardhat run scripts/test-local-deployment.js --network hardhat
```

---

## 📖 Utilisation

### Variables d'environnement requises

#### Pour Gnosis Mainnet :
```bash
PRIVATE_KEY=your_private_key_here
GNOSIS_RPC_URL=https://rpc.gnosischain.com
GNOSIS_RMM_PROXY=0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3
GNOSIS_WXDAI_ADDRESS=0xe91d153e0b41518a2ce8dd3d7944fa863463a97d
GNOSIS_USDC_ADDRESS=0xddafbb505ad214d7b80b1f830fccc89b60fb7a83
GNOSIS_DEFAULT_ASSET=WXDAI
```

#### Pour Chiado Testnet :
```bash
PRIVATE_KEY=your_private_key_here
CHIADO_RPC_URL=https://rpc.chiadochain.net
CHIADO_RMM_PROXY=TBD
CHIADO_WXDAI_ADDRESS=TBD
CHIADO_USDC_ADDRESS=TBD
CHIADO_DEFAULT_ASSET=WXDAI
```

### Commandes de déploiement

```bash
# Tests locaux
npx hardhat run scripts/deploy-modular.js --network hardhat

# Chiado Testnet
npx hardhat run scripts/deploy-modular.js --network chiado

# Gnosis Mainnet
npx hardhat run scripts/deploy-modular.js --network gnosis
```

---

## 🔍 Vérification des Contrats

### Gnosis Mainnet
Explorer : https://gnosisscan.io/

### Chiado Testnet  
Explorer : https://gnosis-chiado.blockscout.com/

### Commandes de vérification
```bash
# Après déploiement, la vérification est automatique
# Ou manuellement :
npx hardhat verify --network gnosis <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 📚 Ressources

- [Gnosis Chain Documentation](https://docs.gnosischain.com/)
- [Chiado Testnet Faucet](https://gnosisfaucet.com/)
- [RMM Documentation](TBD)
- [Rent2Repay Documentation](./DEPLOYMENT.md) 