#!/bin/bash

# Script de commandes pour les tests de fork Gnosis

echo "=== RENT2REPAY FORK TESTING COMMANDS ==="

# Fonction pour exécuter les tests de fork
run_fork_tests() {
    echo "Running fork tests..."
    forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com -vvv
}

# Fonction pour exécuter le script de test simple
run_fork_script() {
    echo "Running fork script..."
    forge script script/TestFork.s.sol --fork-url https://rpc.gnosischain.com -vvv
}

# Fonction pour exécuter le script avec des tokens réels
run_real_tokens_script() {
    echo "Running real tokens script..."
    forge script script/TestWithRealTokens.s.sol --fork-url https://rpc.gnosischain.com -vvv
}

# Fonction pour déployer sur Gnosis (nécessite une clé privée)
deploy_gnosis() {
    echo "Deploying to Gnosis..."
    echo "Make sure to set PRIVATE_KEY in .env file"
    forge script script/DeployGnosis.s.sol --rpc-url https://rpc.gnosischain.com --broadcast --verify
}

# Fonction pour tester avec un block spécifique
run_fork_tests_block() {
    local block_number=${1:-35000000}
    echo "Running fork tests at block $block_number..."
    forge test --match-path test/Rent2RepayFork.t.sol --fork-url https://rpc.gnosischain.com --fork-block-number $block_number -vvv
}

# Fonction pour exécuter un test spécifique
run_specific_test() {
    local test_name=${1:-"testForkInitialization"}
    echo "Running specific test: $test_name..."
    forge test --match-test $test_name --fork-url https://rpc.gnosischain.com -vvv
}

# Fonction pour nettoyer et recompiler
clean_and_build() {
    echo "Cleaning and building..."
    forge clean
    forge build
}

# Fonction pour vérifier la connexion RPC
check_rpc() {
    echo "Checking RPC connection..."
    curl -X POST -H "Content-Type: application/json" \
         --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
         https://rpc.gnosischain.com
}

# Fonction d'aide
show_help() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  test                    - Run all fork tests"
    echo "  script                  - Run fork script"
    echo "  real-tokens             - Run real tokens script"
    echo "  deploy                  - Deploy to Gnosis (requires PRIVATE_KEY)"
    echo "  test-block [number]     - Run tests at specific block"
    echo "  test-specific [name]    - Run specific test"
    echo "  clean                   - Clean and build"
    echo "  check-rpc               - Check RPC connection"
    echo "  help                    - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 test"
    echo "  $0 test-block 36000000"
    echo "  $0 test-specific testForkInitialization"
    echo "  $0 deploy"
}

# Main script
case "$1" in
    "test")
        run_fork_tests
        ;;
    "script")
        run_fork_script
        ;;
    "real-tokens")
        run_real_tokens_script
        ;;
    "deploy")
        deploy_gnosis
        ;;
    "test-block")
        run_fork_tests_block $2
        ;;
    "test-specific")
        run_specific_test $2
        ;;
    "clean")
        clean_and_build
        ;;
    "check-rpc")
        check_rpc
        ;;
    "help"|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
