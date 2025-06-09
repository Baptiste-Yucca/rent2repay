# Interface de Test Rent2Repay

Cette interface web permet de tester facilement le smart contract Rent2Repay en local.

## 🚀 Démarrage Rapide

### 1. Préparer l'environnement

```bash
# Dans un terminal - Démarrer la blockchain locale
npx hardhat node

# Dans un autre terminal - Déployer les contrats
npx hardhat run scripts/deploy-modular.js --network localhost
```

### 2. Configurer votre wallet

1. **Ajouter le réseau local dans Rabby/MetaMask :**
   - Nom : `Hardhat Local`
   - RPC URL : `http://127.0.0.1:8545`
   - Chain ID : `31337`
   - Symbole : `ETH`

2. **Importer un compte de test :**
   - Utilisez une des clés privées affichées par `npx hardhat node`
   - Exemple : `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### 3. Ouvrir l'interface

```bash
# Ouvrir le fichier HTML dans votre navigateur
open test/front_local/index.html

# Ou servir avec un serveur web simple
cd test/front_local
python3 -m http.server 8000
# Puis aller sur http://localhost:8000
```

## 📋 Fonctionnalités

### Pour tous les utilisateurs

1. **🔗 Connexion Wallet**
   - Connecter MetaMask/Rabby
   - Affichage des balances
   - Détection automatique du contrat

2. **⚙️ Configuration Rent2Repay**
   - Configurer les limites hebdomadaires par token
   - Configuration simple ou multi-tokens
   - Révocation par token ou totale

3. **💰 Test de Remboursement**
   - Vérifier les configurations d'autres utilisateurs
   - Exécuter des remboursements
   - Suivi des limites et montants disponibles

4. **🧪 Contrôles Mock**
   - Mint des tokens de test
   - Approuver des montants
   - Gérer les allowances

### Pour les administrateurs

5. **🔧 Gestion des Tokens**
   - Autoriser de nouveaux tokens
   - Désautoriser des tokens existants
   - Pause/déblocage du contrat

## 🛠️ Utilisation

### Premiers tests

1. **Mint des tokens :**
   ```
   Contrôles Mock → Sélectionner WXDAI → Mint 1000 tokens
   ```

2. **Configurer Rent2Repay :**
   ```
   Configuration → Sélectionner WXDAI → Limite 100 → Configurer
   ```

3. **Approuver les tokens :**
   ```
   Contrôles Mock → Approuver 1000 tokens pour Rent2Repay
   ```

4. **Tester un remboursement :**
   ```
   Remboursement → Entrer votre adresse → Vérifier → Exécuter
   ```

### Comptes de test recommandés

- **Compte 1** (`0xf39F...`): Admin/Déployeur
- **Compte 2** (`0x7099...`): Utilisateur test 1
- **Compte 3** (`0x3C44...`): Utilisateur test 2

### Scénarios de test

1. **Configuration basique :**
   - Configurer un token avec une limite
   - Vérifier les informations affichées

2. **Multi-tokens :**
   - Configurer WXDAI et USDC en même temps
   - Tester les remboursements avec différents tokens

3. **Limites hebdomadaires :**
   - Exécuter plusieurs remboursements
   - Vérifier que les limites sont respectées

4. **Gestion admin :**
   - Autoriser un nouveau token
   - Mettre en pause le contrat

## 🐛 Dépannage

### Erreurs communes

1. **"Contrat non trouvé"**
   - Vérifiez que les contrats sont déployés
   - Entrez manuellement l'adresse du contrat

2. **"Transaction failed"**
   - Vérifiez vos balances de tokens
   - Assurez-vous que les allowances sont suffisantes

3. **"Network mismatch"**
   - Vérifiez que vous êtes sur le réseau Hardhat Local (31337)

### Logs

- Tous les événements sont loggés dans la section "Journaux d'Activité"
- Utilisez les couleurs pour identifier le type d'événement :
  - 🔵 Info (bleu)
  - 🟢 Succès (vert)
  - 🟡 Avertissement (jaune)
  - 🔴 Erreur (rouge)

## 📁 Structure des fichiers 