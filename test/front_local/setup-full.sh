#!/bin/bash
# Script pour setup complet de l'environnement de test

echo "🚀 SETUP COMPLET RENT2REPAY"
echo "=========================="

# Vérifier que le nœud Hardhat tourne
echo "🔍 Vérification du nœud Hardhat..."
if ! curl -s -f http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "❌ Le nœud Hardhat n'est pas accessible!"
    echo "💡 Lancez d'abord dans un autre terminal:"
    echo "   npx hardhat node"
    exit 1
fi
echo "✅ Nœud Hardhat accessible"

# Déployer tout l'environnement
echo ""
echo "📦 Déploiement des contrats..."
npx hardhat run deploy-complete-auto.js --network localhost

if [ $? -ne 0 ]; then
    echo "❌ Erreur pendant le déploiement"
    exit 1
fi

# Vérifier avec User1
echo ""
echo "🔍 Vérification User1..."
./check 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

echo ""
echo "🎉 Setup terminé avec succès!"
echo ""
echo "📚 Commandes disponibles:"
echo "  ./check <adresse>     - Vérifier un wallet"
echo "  ./token              - Gestion des tokens"
echo "  ./repay              - Scripts de remboursement"
echo "  open index.html      - Interface web" 