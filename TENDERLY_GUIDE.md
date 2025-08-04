# 🧪 Guide Tenderly - Déploiement sur Gnosis Chain

## 📋 Prérequis

1. **Compte Tenderly** : https://dashboard.tenderly.co
2. **Projet créé** : https://dashboard.tenderly.co/battistu/rent2repay/infrastructure
3. **Clé privée** : Pour signer les transactions
4. **Adresses Gnosis** : Toutes les adresses RMM et tokens

## 🚀 Étapes de déploiement

### 1. Configuration des adresses

Éditez `config-gnosis.js` et remplissez toutes les adresses :

```bash
# Ouvrir le fichier de configuration
code config-gnosis.js
```

**Adresses obligatoires à remplir :**
- `RMM_ADDRESS` : Contrat RMM sur Gnosis
- `WXDAI_TOKEN` : Token WXDAI
- `USDC_TOKEN` : Token USDC
- `WXDAI_SUPPLY_TOKEN` : Token de supply WXDAI dans RMM
- `USDC_SUPPLY_TOKEN` : Token de supply USDC dans RMM
- `ADMIN_ADDRESS` : Votre adresse admin
- `EMERGENCY_ADDRESS` : Votre adresse emergency
- `OPERATOR_ADDRESS` : Votre adresse operator
- `DAO_TREASURY_ADDRESS` : Adresse du trésor DAO

### 2. Configuration Tenderly

#### A. Créer un Fork Gnosis

1. Aller sur https://dashboard.tenderly.co/battistu/rent2repay/infrastructure
2. Cliquer sur "Fork" → "New Fork"
3. Sélectionner "Gnosis Chain"
4. Cliquer sur "Create Fork"

#### B. Récupérer l'URL RPC

1. Dans votre fork, copier l'URL RPC
2. Ajouter dans votre `.env` :

```bash
TENDERLY_RPC_URL=https://rpc.tenderly.co/fork/your-fork-id
PRIVATE_KEY=your-private-key
```

### 3. Déploiement

```bash
# Compiler les contrats
npm run compile

# Déployer sur Tenderly
npm run deploy:tenderly
```

## 🔍 Vérification du déploiement

### Dans Tenderly Dashboard

1. **Transactions** : Voir toutes les transactions
2. **State** : Vérifier l'état du contrat
3. **Events** : Voir les événements émis
4. **Debug** : Déboguer les transactions

### Commandes de vérification

```bash
# Vérifier les rôles
npx hardhat run scripts/check-roles.js --network tenderly

# Vérifier la configuration
npx hardhat run scripts/check-config.js --network tenderly
```

## 🧪 Tests sur Tenderly

### 1. Test de configuration utilisateur

```javascript
// Dans Tenderly Console
const rent2Repay = await ethers.getContractAt("Rent2Repay", "CONTRACT_ADDRESS");

// Configurer un utilisateur
await rent2Repay.configureRent2Repay(
  ["WXDAI_ADDRESS"],
  [ethers.parseEther("100")],
  604800, // 1 semaine
  1
);
```

### 2. Test de remboursement

```javascript
// Simuler un remboursement
await rent2Repay.rent2repay("USER_ADDRESS", "WXDAI_ADDRESS");
```

## 🔧 Configuration avancée

### Variables d'environnement

```bash
# .env
TENDERLY_RPC_URL=https://rpc.tenderly.co/fork/your-fork-id
PRIVATE_KEY=your-private-key
GNOSIS_RPC_URL=https://rpc.gnosischain.com
```

### Configuration Hardhat

Le fichier `hardhat.config.js` est déjà configuré pour :
- `tenderly` : Fork Tenderly
- `gnosis` : Gnosis Chain mainnet

## 📊 Monitoring

### Dans Tenderly Dashboard

1. **Gas Usage** : Surveiller la consommation de gas
2. **Error Tracking** : Voir les erreurs de transaction
3. **State Changes** : Suivre les changements d'état
4. **Event Logs** : Analyser les événements

### Alertes

Configurer des alertes pour :
- Échecs de transaction
- Gas usage élevé
- Erreurs de contrat

## 🚨 Dépannage

### Erreurs courantes

1. **"Nonce too high"**
   ```bash
   # Réinitialiser le fork
   # Ou utiliser un nouveau fork
   ```

2. **"Insufficient funds"**
   ```bash
   # Ajouter des fonds au compte dans le fork
   ```

3. **"Contract not found"**
   ```bash
   # Vérifier l'adresse du contrat
   # Recompiler et redéployer
   ```

### Commandes utiles

```bash
# Vérifier la balance
npx hardhat run scripts/check-balance.js --network tenderly

# Vérifier les rôles
npx hardhat run scripts/check-roles.js --network tenderly

# Vérifier la configuration
npx hardhat run scripts/check-config.js --network tenderly
```

## 📈 Métriques importantes

### À surveiller

1. **Gas Usage** : Optimiser les transactions
2. **Success Rate** : Taux de succès des transactions
3. **User Activity** : Nombre d'utilisateurs actifs
4. **Fee Collection** : Collecte des fees DAO

### KPIs

- Transactions par jour
- Volume traité
- Fees collectées
- Utilisateurs actifs

## 🔗 Liens utiles

- **Tenderly Dashboard** : https://dashboard.tenderly.co/battistu/rent2repay/infrastructure
- **Gnosis Explorer** : https://gnosisscan.io
- **Gnosis RPC** : https://rpc.gnosischain.com
- **Documentation RMM** : [À ajouter]

## 📝 Notes importantes

1. **Fork Tenderly** : Les forks ont une durée de vie limitée
2. **Gas Limits** : Gnosis a des limites de gas différentes
3. **Token Approvals** : N'oubliez pas d'approuver les tokens
4. **Role Management** : Vérifiez les rôles après déploiement
5. **Fee Configuration** : Configurez les fees avant utilisation

## 🎯 Prochaines étapes

1. ✅ Déployer sur Tenderly
2. ✅ Tester les fonctionnalités
3. ✅ Optimiser le gas
4. ✅ Déployer sur Gnosis mainnet
5. ✅ Monitorer en production 