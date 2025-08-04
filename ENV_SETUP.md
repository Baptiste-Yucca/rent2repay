# 🔧 Configuration des Variables d'Environnement

## 📋 Créer le fichier .env

Copiez ce contenu dans un fichier `.env` à la racine du projet :

```bash
# ===== CONFIGURATION TENDERLY =====
# URL RPC de votre fork Tenderly
TENDERLY_RPC_URL=https://rpc.tenderly.co/fork/your-fork-id

# Clé privée pour signer les transactions
# ATTENTION: Ne jamais commiter ce fichier avec une vraie clé privée!
PRIVATE_KEY=your-private-key-here

# ===== CONFIGURATION GNOSIS =====
# URL RPC Gnosis Chain (optionnel)
GNOSIS_RPC_URL=https://rpc.gnosischain.com

# ===== CONFIGURATION CHIADO (TESTNET) =====
# URL RPC Chiado testnet (optionnel)
CHIADO_RPC_URL=https://rpc.chiadochain.net

# ===== API KEYS =====
# Clé API pour GnosisScan (optionnel)
GNOSISSCAN_API_KEY=your-gnosisscan-api-key
```

## 🔑 Comment obtenir les valeurs

### 1. TENDERLY_RPC_URL

1. Aller sur https://dashboard.tenderly.co/battistu/rent2repay/infrastructure
2. Créer un nouveau fork Gnosis
3. Copier l'URL RPC du fork
4. Remplacer `your-fork-id` par l'ID de votre fork

### 2. PRIVATE_KEY

⚠️ **ATTENTION: Ne jamais partager votre clé privée!**

```bash
# Exemple de clé privée (NE PAS UTILISER EN PRODUCTION)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### 3. GNOSISSCAN_API_KEY (optionnel)

1. Aller sur https://gnosisscan.io
2. Créer un compte
3. Aller dans "API Keys"
4. Créer une nouvelle clé API

## 🚨 Sécurité

### ✅ À faire
- Utiliser un wallet dédié pour les tests
- Limiter les fonds dans le wallet de test
- Utiliser des clés privées de test uniquement

### ❌ À ne pas faire
- Commiter le fichier .env avec des vraies clés
- Utiliser votre wallet principal pour les tests
- Partager vos clés privées

## 🔧 Vérification

Après avoir créé le fichier `.env`, vérifiez la configuration :

```bash
# Vérifier que les variables sont chargées
npm run check:env
```

## 📝 Exemple complet

```bash
# .env
TENDERLY_RPC_URL=https://rpc.tenderly.co/fork/abc123def456
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
GNOSIS_RPC_URL=https://rpc.gnosischain.com
CHIADO_RPC_URL=https://rpc.chiadochain.net
GNOSISSCAN_API_KEY=ABC123DEF456
```

## 🎯 Prochaines étapes

1. ✅ Créer le fichier `.env`
2. ✅ Configurer Tenderly
3. ✅ Remplir `config-gnosis.js`
4. ✅ Déployer avec `npm run deploy:tenderly`
5. ✅ Vérifier avec `npm run check:tenderly` 