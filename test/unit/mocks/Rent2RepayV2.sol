// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../src/Rent2Repay.sol";

/**
 * @title Rent2RepayV2
 * @dev Version 2 du contrat Rent2Repay pour tester les upgrades UUPS
 */
contract Rent2RepayV2 is Rent2Repay {
    
    /**
     * @notice Retourne la version du contrat
     * @return Version string
     */
    function version() public pure override returns (string memory) {
        return "2.0.0";
    }
    
    /**
     * @notice Fonction de test pour vérifier que l'upgrade a fonctionné
     * @return true si l'upgrade est réussi
     */
    function isUpgraded() public pure returns (bool) {
        return true;
    }
}
