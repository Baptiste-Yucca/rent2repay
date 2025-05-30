# 🔴 Activation de Gnosis Mainnet

⚠️ **ATTENTION**: Vous êtes sur le point d'activer le déploiement sur Gnosis Mainnet. Assurez-vous que c'est intentionnel !

## 📋 Étapes pour activer Gnosis Mainnet

### 1. Décommenter dans `hardhat.config.js`

```javascript
networks: {
  // ... autres réseaux
  gnosis: {
    url: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
    chainId: 100,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
  }
}
```

### 2. Décommenter dans `scripts/deploy-modular.js`

```javascript
gnosis: {
  name: "Gnosis Mainnet",
  rmmAddress: process.env.GNOSIS_RMM_PROXY || "0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3",
  supportedAssets: {
    WXDAI: process.env.GNOSIS_WXDAI_ADDRESS || "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
    USDC: process.env.GNOSIS_USDC_ADDRESS || "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83"
  },
  defaultRepaymentAsset: process.env.GNOSIS_DEFAULT_ASSET || "WXDAI",
  useMock: false
}
```

### 3. Configurer votre fichier `.env`

```bash
# Private key for deployment (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Gnosis Mainnet
GNOSIS_RPC_URL=https://rpc.gnosischain.com
GNOSIS_RMM_PROXY=0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3
GNOSIS_WXDAI_ADDRESS=0xe91d153e0b41518a2ce8dd3d7944fa863463a97d
GNOSIS_USDC_ADDRESS=0xddafbb505ad214d7b80b1f830fccc89b60fb7a83
GNOSIS_DEFAULT_ASSET=WXDAI

# Pour la vérification des contrats
GNOSISSCAN_API_KEY=your_gnosisscan_api_key_here
```

### 4. Décommenter dans `hardhat.config.js` pour etherscan

```javascript
etherscan: {
  apiKey: {
    gnosis: process.env.GNOSISSCAN_API_KEY || "",
    chiado: process.env.GNOSISSCAN_API_KEY || ""
  }
}
```

### 5. Déployer

```bash
npx hardhat run scripts/deploy-modular.js --network gnosis
```

## ⚠️ Vérifications avant déploiement

- [ ] J'ai suffisamment de xDAI pour les frais de gas
- [ ] Ma clé privée est sécurisée et correspond au bon wallet
- [ ] J'ai testé le contrat sur Chiado testnet
- [ ] Les adresses RMM et des tokens sont correctes
- [ ] Je comprends que c'est un déploiement sur le VRAI Gnosis mainnet

## 💰 Coûts estimés

Le déploiement coûte environ 0.01-0.05 xDAI en frais de gas.

## 🔐 Sécurité

- Gardez votre clé privée sécurisée
- Vérifiez les adresses deux fois
- Commencez par de petits montants de test
- Utilisez un wallet dédié au déploiement 