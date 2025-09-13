# Tests de Fork Gnosis

Ce document explique comment utiliser les tests de fork pour tester Rent2Repay avec le vrai RMM déployé sur Gnosis.

## Configuration

### 1. Variables d'environnement

Créez un fichier `.env` avec les adresses suivantes :

```bash
# Clés privées et adresses
PRIVATE_KEY=your_private_key_here
ADMIN_ADDRESS=0xD2f9d86f58E8871c6D97DCc2BF911efB98a4c97C
EMERGENCY_ADDRESS=0x19c13C99C13e648Cc9cF32ab04455Ea66eB6b6f8
OPERATOR_ADDRESS=0x5B3B05566724fD1E6C2941bC1499E9e89ca4E7f2

# Adresses des contrats sur Gnosis
RMM_ADDRESS=0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3
WXDAI_TOKEN=0xe91d153e0b41518a2ce8dd3d7944fa863463a97d
WXDAI_SUPPLY_TOKEN=0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b
USDC_TOKEN=0xddafbb505ad214d7b80b1f830fccc89b60fb7a83
USDC_SUPPLY_TOKEN=0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1
DAO_GOVERNANCE_TOKEN=0x0aa1e96d2a46ec6beb2923de1e61addf5f5f1dce

# Configuration RPC
GNOSIS_RPC_URL=https://rpc.gnosischain.com
```

### 2. Configuration Foundry

Le fichier `foundry.toml` contient une configuration de fork pour Gnosis :

```toml
[profile.fork]
fork_url = "https://rpc.gnosischain.com"
fork_block_number = 35000000  # Block récent sur Gnosis
```

## Exécution des tests

### 1. Test de script simple

```bash
# Exécuter le script de test de fork
forge script script/TestFork.s.sol --fork-url https://rpc.gnosischain.com -vvv
```

### 2. Tests de fork complets

```bash
# Exécuter tous les tests de fork
forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com -vvv

# Exécuter avec le profil fork
forge test --match-path test/Rent2RepayFork.t.sol --profile fork -vvv
```

### 3. Test avec un block spécifique

```bash
# Fork à un block spécifique
forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com --fork-block-number 35000000 -vvv
```

## Fichiers de test

### 1. `script/TestFork.s.sol`
Script simple qui :
- Fork Gnosis
- Déploie Rent2Repay
- Teste l'initialisation et la configuration
- Teste les validations de base

### 2. `test/Rent2RepayFork.t.sol`
Suite de tests complète qui :
- Teste l'initialisation sur le fork
- Vérifie les balances des tokens réels
- Teste la configuration des utilisateurs
- Teste les contrôles d'accès
- Teste l'intégration RMM

## Avantages des tests de fork

1. **Tests avec de vrais contrats** : Utilise le vrai RMM déployé sur Gnosis
2. **Tokens réels** : Teste avec de vrais tokens (WXDAI, USDC, etc.)
3. **État réel** : Utilise l'état actuel de la blockchain Gnosis
4. **Intégration complète** : Teste l'intégration avec l'écosystème réel

## Limitations

1. **Tokens nécessaires** : Pour tester `rent2repay`, il faut des tokens réels
2. **Approbations** : Il faut approuver le contrat pour dépenser les tokens
3. **Coûts de gas** : Les tests peuvent consommer du gas (sur le fork)
4. **Dépendance réseau** : Nécessite une connexion à Gnosis

## Exemple d'utilisation

```bash
# 1. Exécuter le script de base
forge script script/TestFork.s.sol --fork-url https://rpc.gnosischain.com -vvv

# 2. Exécuter les tests complets
forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com -vvv

# 3. Exécuter un test spécifique
forge test --match-test testForkInitialization --fork-url https://rpc.gnosischain.com -vvv
```

## Dépannage

### Erreur de connexion RPC
```bash
# Vérifier la connexion
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' https://rpc.gnosischain.com
```

### Erreur de block
```bash
# Utiliser un block plus récent
forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com --fork-block-number 36000000 -vvv
```

### Erreur de compilation
```bash
# Nettoyer et recompiler
forge clean
forge build
```
