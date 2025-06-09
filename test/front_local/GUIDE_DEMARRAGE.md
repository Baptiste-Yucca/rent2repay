# 🚀 Guide de Démarrage Rapide - Interface Rent2Repay

## ✅ Votre environnement est prêt !

Tous les contrats sont déployés et configurés. Voici comment tester l'interface :

## 📋 Informations du Déploiement

### Adresses des Contrats
- **Rent2Repay:** `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **MockRMM:** `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **WXDAI Token:** `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`
- **USDC Token:** `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- **debtWXDAI Token:** `0x95401dc811bb5740090279Ba06cfA8fcF6113778`
- **debtUSDC Token:** `0x998abeb3E57409262aE5b751f60747921B33613E`

### Comptes de Test Disponibles
1. **Admin/Deployer:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` 
   - Clé privée: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - **Rôles:** 👑 DEFAULT_ADMIN, 🔧 ADMIN, 🚨 EMERGENCY, ⚙️ OPERATOR
   - **Permissions:** Toutes les fonctions administratives

2. **User1 (PRÉ-CONFIGURÉ):** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Clé privée: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - **Rôle:** 🔸 Utilisateur standard
   - **Configuration Rent2Repay:** WXDAI: 100/semaine, USDC: 50/semaine
   - **Tokens de dette:** 150 debtWXDAI, 20 debtUSDC
   - **Statut:** ✅ Prêt pour tests de remboursement

3. **User2-4:** Comptes avec tokens mais sans configuration
   - **Rôle:** 🔸 Utilisateurs standards

## 🔧 Étapes pour Tester

### 1. Configurer votre Wallet

**Dans Rabby ou MetaMask :**
1. Ajouter le réseau personnalisé :
   - **Nom:** `Hardhat Local`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Symbole:** `ETH`

2. Importer un compte de test (au choix) :
   - Utiliser une des clés privées ci-dessus
   - Recommandé : Commencer par User1 (déjà configuré)

### 2. Ouvrir l'Interface

```bash
# Option 1: Ouvrir directement
open test/front_local/index.html

# Option 2: Serveur web local
cd test/front_local
python3 -m http.server 8000
# Puis aller sur http://localhost:8000
```

### 3. Tests Recommandés

#### Test 1: Connexion et Visualisation
1. Connecter votre wallet
2. L'interface devrait afficher :
   - Vos balances ETH, WXDAI, USDC
   - Les informations du contrat
   - Si User1: Votre configuration existante

#### Test 2: Configuration de Limites (avec User2-4)
1. Connectez-vous avec User2, User3 ou User4
2. **Mint des tokens :**
   - Section "Contrôles Mock" → Sélectionner WXDAI → Mint 1000
   - Répéter pour USDC
3. **Configurer une limite :**
   - Section "Configuration" → WXDAI → Limite 200 → Configurer
4. **Approuver les tokens :**
   - Section "Contrôles Mock" → Approuver 500 tokens

#### Test 3: Remboursement (avec Admin/User1)
1. Connectez-vous avec l'Admin
2. **Mint des tokens pour payer :**
   - Contrôles Mock → Mint 1000 WXDAI et USDC
   - Approuver 500 de chaque
3. **Test de remboursement :**
   - Section "Remboursement" 
   - Adresse cible: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Cliquer "Vérifier" → Devrait afficher les limites de User1
   - Token: WXDAI, Montant: 50
   - Exécuter le remboursement

#### Test 4: Tokens de Dette
1. **Mint/Burn des tokens de dette :**
   - Section "Contrôles Mock" → Sélectionner debtWXDAI
   - Mint 500 tokens → Vérifier balance mise à jour
   - Burn 200 tokens → Vérifier diminution de balance
2. **Approbation des tokens de dette :**
   - Approuver 300 debtUSDC pour Rent2Repay

#### Test 5: Fonctions Admin
1. Connecté en tant qu'Admin
2. **Pause/Unpause :**
   - Mettre en pause le contrat
   - Essayer une opération (devrait échouer)
   - Débloquer le contrat

## 🎯 Scénarios d'Utilisation

### 🔐 Test des Rôles et Permissions

#### Scénario A: Connexion Admin
```
Admin (0xf39Fd...) → Connexion → 
L'interface affiche:
• 👑 Rôles administratifs avec badges colorés
• Sections "Gestion des Tokens" visibles
• Fonctions pause/unpause disponibles
• Toutes les permissions activées
```

#### Scénario B: Connexion Utilisateur Standard
```
User1-4 → Connexion → 
L'interface affiche:
• 🔸 Utilisateur standard
• Sections admin masquées
• Fonctions limitées aux opérations utilisateur
• Configuration et révocation disponibles
```

### 💰 Test des Tokens de Dette

#### Scénario C: Gestion des Tokens de Dette
```
User2 → Mint debtWXDAI (1000) → Burn debtWXDAI (300) → 
Approuver debtUSDC pour Rent2Repay → 
Vérifier balances et allowances
```

### Scénario D: Utilisateur Normal
```
User2 → Mint tokens → Configure limites → Approuve → 
Admin → Rembourse pour User2 → Vérifier limites mises à jour
```

### Scénario E: Multi-Tokens
```
User3 → Configure WXDAI (100) et USDC (75) → 
Admin → Rembourse 50 WXDAI et 25 USDC → 
Vérifier les limites restantes
```

## 🔍 Commandes Utiles pour Vérifier

### Test des Rôles
```bash
# Vérifier qui a quels rôles
npx hardhat run test/front_local/test-roles.js --network localhost
```

### Test des Tokens de Dette
```bash
# Tester les tokens de dette
npx hardhat run test/front_local/test-debt-tokens.js --network localhost
```

### Vérification User1
```bash
# Vérifier la configuration complète de User1
npx hardhat run test/front_local/verify-user1-config.js --network localhost
```

### Redéploiement Complet
```bash
# Si vous voulez repartir de zéro
npx hardhat run scripts/deploy-modular.js --network localhost
npx hardhat run test/front_local/setup-tokens.js --network localhost
npx hardhat run test/front_local/deploy-debt-tokens.js --network localhost
```

## 🐛 Dépannage

### Problèmes Courants

1. **"Contrat non trouvé"**
   - L'interface va vous demander l'adresse
   - Entrez: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

2. **"Balances des tokens de dette à 0"**
   - Exécutez: `npx hardhat run test/front_local/deploy-debt-tokens.js --network localhost`
   - Mettez à jour les adresses dans config.js

3. **"Insufficient allowance"**
   - Utilisez la section "Contrôles Mock" pour approuver plus de tokens

4. **"Weekly limit exceeded"**
   - Normal ! Cela valide que les limites fonctionnent
   - Révoquez et reconfigurez une limite plus élevée

5. **"Cannot repay for self"**
   - Le système empêche l'auto-remboursement
   - Utilisez des comptes différents

6. **"Sections admin non visibles"**
   - Connectez-vous avec le compte Deployer (0xf39Fd...)
   - Vérifiez vos rôles dans l'interface

### Vérifications

- ✅ Blockchain Hardhat en cours (`npx hardhat node`)
- ✅ Réseau 31337 dans votre wallet
- ✅ Tokens mintés pour vos tests
- ✅ Tokens de dette déployés et mintés
- ✅ Allowances approuvées
- ✅ Comptes différents pour rembourseur et bénéficiaire

## 📊 Que Regarder

### Dans l'Interface
- **Rôles utilisateur** affichés avec badges colorés
- **Balances** de tous les tokens (ETH, WXDAI, USDC, debtWXDAI, debtUSDC)
- **Configuration utilisateur** qui affiche les limites et montants dépensés
- **Logs** qui montrent tous les événements
- **Status du contrat** (actif/pause)
- **Sections admin** visibles selon permissions

### Transactions Blockchain
- Chaque action génère une transaction avec hash
- Les events sont émis et loggés
- Les allowances et balances évoluent

## 🎉 Vous Devriez Voir

1. **Interface connectée** avec vos balances et rôles
2. **Tokens disponibles** (WXDAI, USDC, debtWXDAI, debtUSDC)
3. **Détection automatique** des permissions
4. **Sections admin** conditionnelles
5. **Configuration facile** des limites
6. **Remboursements fonctionnels** avec vérification des limites
7. **Gestion complète des tokens de dette** (mint/burn/approve)
8. **Logs détaillés** de toutes les opérations
9. **Fonctions admin** selon vos rôles

---

**L'environnement est complètement fonctionnel avec tokens de dette et gestion des rôles !** 🚀

Vous pouvez maintenant tester toutes les fonctionnalités du smart contract Rent2Repay via cette interface web, y compris la gestion des tokens de dette, avec une gestion intelligente des permissions selon votre rôle.

### 🎯 Test Rapide User1

User1 est maintenant **pré-configuré** ! Connectez-vous avec sa clé privée pour voir :
- Balances : 150 debtWXDAI + 20 debtUSDC
- Configuration active : 100 WXDAI/semaine + 50 USDC/semaine
- Prêt pour remboursements immédiats par l'admin