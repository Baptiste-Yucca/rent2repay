# Guide de Test Rent2Repay

Ce guide explique comment configurer et utiliser l'environnement de test local pour le projet Rent2Repay.

## 📋 Prérequis

- Node.js (version 16 ou supérieure)
- npm ou yarn
- Git

## 🚀 1. Lancement du nœud local

### Démarrer le nœud Hardhat

Pour commencer, vous devez lancer un nœud blockchain local avec Hardhat :

```bash
# Depuis la racine du projet
npx hardhat node
```

Cette commande :
- Lance un nœud blockchain local sur `http://127.0.0.1:8545`
- Crée 20 comptes de test avec 10,000 ETH chacun
- Affiche les clés privées des comptes pour les tests
- Maintient le nœud actif en attendant les transactions

**⚠️ Important :** Gardez ce terminal ouvert pendant tous vos tests !

## 🛠️ 2. Déploiement de l'environnement de test

### Option A : Déploiement ultra-rapide avec setup complet (⚡ Recommandé)

Pour un déploiement complet en une seule commande :

```bash
# Dans un nouveau terminal, depuis le dossier test/front_local
cd test/front_local
chmod +x setup-full.sh
./setup-full.sh
```

Ce script automatise TOUT le processus :
- ✅ Vérifie que le nœud Hardhat fonctionne
- 🚀 Déploie tous les contrats automatiquement
- 🔧 Configure l'environnement de test
- ✨ Exécute les vérifications de base
- 📋 Affiche un résumé des commandes disponibles

**C'est le moyen le plus rapide pour commencer !**

### Option B : Déploiement automatique complet

Le moyen le plus simple pour déployer tout l'environnement :

```bash
# Dans un nouveau terminal, depuis le dossier test/front_local
cd test/front_local
node deploy-complete-auto.js
```

Ce script déploie automatiquement :
- **MockRMM** : Contrat simulant le Risk Management Module
- **Rent2Repay** : Le contrat principal
- **Tokens** : WXDAI et USDC de test
- **Tokens de dette** : debtWXDAI et debtUSDC
- **Configuration User1** : Un utilisateur pré-configuré pour les tests

### Option C : Déploiement manuel étape par étape

Si vous préférez contrôler chaque étape :

```bash
cd test/front_local

# 1. Déployer les contrats de base
node deploy-simple.js

# 2. Configurer les tokens de dette
node deploy-debt-tokens.js

# 3. Configurer les tokens pour les tests
node setup-tokens.js

# 4. Vérifier la configuration
node verify-user1-config.js
```

### Vérification du déploiement

Après le déploiement, vérifiez que tout fonctionne :

```bash
# Afficher les adresses des contrats
node show-address-mapping.js

# Tester les tokens de dette
node test-debt-tokens.js

# Vérifier les rôles
node test-roles.js
```

## 🔍 3. Utilisation des scripts de vérification

Le dossier `test/front_local` contient plusieurs scripts utiles pour tester et vérifier le système :

### Scripts principaux

#### 🔎 Script de vérification (`check`)
```bash
# Vérifier l'état général du système
./check

# Vérifier un utilisateur spécifique
./check --user 0x1234...

# Vérifier avec plus de détails
./check --verbose
```

#### 💰 Script de gestion des tokens (`token`)
```bash
# Afficher les balances des tokens
./token

# Minter des tokens pour un utilisateur
./token --mint --user 0x1234... --amount 1000

# Approuver des tokens
./token --approve --spender 0x5678... --amount 500
```

#### 💸 Script de remboursement (`repay`)
```bash
# Effectuer un remboursement de test
./repay

# Remboursement avec montant spécifique
./repay --amount 100 --token WXDAI

# Remboursement pour un utilisateur spécifique
./repay --user 0x1234... --amount 50 --token USDC
```

### Scripts de configuration avancés

```bash
# Mettre à jour la configuration
node update-config.js

# Déployer avec des adresses fixes
node deploy-fixed-addresses.js

# Vérifier la configuration User1
node verify-user1-config.js
```

## 🌐 4. Interface Web de test

Une interface web est disponible pour interagir avec les contrats de manière graphique :

```bash
# Depuis test/front_local
# Ouvrir index.html dans votre navigateur
open index.html
# ou
python -m http.server 8000  # puis aller sur http://localhost:8000
```

L'interface permet de :
- Voir les balances des tokens
- Configurer Rent2Repay pour différents utilisateurs
- Effectuer des remboursements
- Visualiser l'état des contrats

## 📊 5. Tests automatisés

Pour exécuter la suite de tests complète :

```bash
# Depuis la racine du projet
npm test

# Tests spécifiques
npx hardhat test test/Rent2Repay.test.js
npx hardhat test test/token-management.test.js
```

## 🛠️ 6. Résolution des problèmes courants

### Erreur "Network not found"
```bash
# Vérifiez que le nœud Hardhat est en cours d'exécution
npx hardhat node
```

### Erreur "Contract not deployed"
```bash
# Redéployez l'environnement
cd test/front_local
node deploy-complete-auto.js
```

### Problème de configuration
```bash
# Vérifiez le fichier de configuration
cat config.js

# Régénérez la configuration
node update-config.js
```

### Reset complet
```bash
# Arrêter le nœud (Ctrl+C)
# Redémarrer le nœud
npx hardhat node

# Redéployer tout
cd test/front_local
node deploy-complete-auto.js
```

## 📁 7. Structure des fichiers de test

```
test/
├── README.md                    # Ce guide
├── Rent2Repay.test.js          # Tests principaux
├── token-management.test.js     # Tests de gestion des tokens
└── front_local/                # Outils de test frontend
    ├── setup-full.sh           # 🚀 Script de setup complet automatique
    ├── check                   # Script de vérification
    ├── check-script.js         # Logique de vérification
    ├── repay                   # Script de remboursement
    ├── repay-script.js         # Logique de remboursement
    ├── token                   # Script de gestion des tokens
    ├── token-script.js         # Logique des tokens
    ├── deploy-complete-auto.js # Déploiement automatique
    ├── config.js               # Configuration des contrats
    ├── index.html              # Interface web
    ├── app.js                  # Logique frontend
    └── style.css               # Styles CSS
```

## 🎯 8. Workflow de développement recommandé

### Démarrage rapide (⚡ Nouveau)
```bash
# 1. Démarrer le nœud
npx hardhat node

# 2. Dans un autre terminal - Setup complet automatique
cd test/front_local
./setup-full.sh
```

### Workflow détaillé
1. **Démarrage** : Lancez le nœud Hardhat (`npx hardhat node`)
2. **Setup automatique** : Utilisez `./setup-full.sh` pour tout configurer
3. **Vérification** : Le script exécute automatiquement les vérifications
4. **Tests** : Utilisez les scripts (`./check`, `./token`, `./repay`) ou l'interface web
5. **Itération** : Modifiez le code et relancez `./setup-full.sh` si nécessaire

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez que le nœud Hardhat fonctionne
2. Consultez les logs dans le terminal
3. Utilisez `./check --verbose` pour plus de détails
4. Consultez les tests unitaires pour des exemples d'utilisation 