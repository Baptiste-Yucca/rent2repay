// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRMM} from "interfaces/IRMM.sol";

/**
 * @title MockRMM
 * @notice Mock du RMM qui simule le comportement du vrai RMM
 * @dev Ce mock simplifie le comportement du RMM pour les tests locaux
 */
contract MockRMM is IRMM {
    // Mapping token => debtToken pour simuler la liaison entre les tokens
    mapping(address => address) public tokenToDebtToken;
    mapping(address => address) public tokenToSupplyToken;
    
    // Mode de fonctionnement pour les tests
    // 0 = fonctionnement normal (retourne amount)
    // 1 = retourne amount - 100 wei (pour simuler difference > 0)
    // 2 = retourne amount - customDifference (pour simuler difference personnalisée)
    uint256 public mode;
    
    // Différence personnalisée pour le mode 2
    uint256 public customDifference;

    event Repaid(address token, uint256 amount, uint256 mode, address user);
    event Withdrawn(address token, uint256 amount, address to);
    event ModeChanged(uint256 oldMode, uint256 newMode);
    
    /**
     * @notice Constructeur qui configure les paires token/debtToken
     * @param tokens Tableau des adresses des tokens de base
     * @param debtTokens Tableau des adresses des tokens de dette correspondants
     */
    constructor(address[] memory tokens, address[] memory debtTokens, address[] memory supplyTokens) {
        require(tokens.length == debtTokens.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Token address cannot be zero");
            require(debtTokens[i] != address(0), "Debt token address cannot be zero");
            tokenToDebtToken[tokens[i]] = debtTokens[i];
            tokenToSupplyToken[tokens[i]] = supplyTokens[i];
        }
        
        // Mode par défaut = 0 (fonctionnement normal)
        mode = 0;
    }

    /**
     * @notice Définit le mode de fonctionnement
     * @param newMode Le nouveau mode (0 = normal, 1 = soustraction 100 wei, 2 = soustraction personnalisée)
     */
    function setMode(uint256 newMode) external {
        require(newMode <= 2, "Mode must be 0, 1, or 2");
        uint256 oldMode = mode;
        mode = newMode;
        emit ModeChanged(oldMode, newMode);
    }

    /**
     * @notice Définit la différence personnalisée pour le mode 2
     * @param newDifference La nouvelle différence en wei
     */
    function setCustomDifference(uint256 newDifference) external {
        customDifference = newDifference;
    }

    /**
     * @notice Récupère la différence personnalisée
     * @return La différence personnalisée actuelle
     */
    function getCustomDifference() external view returns (uint256) {
        return customDifference;
    }

    /**
     * @notice Récupère le mode actuel
     * @return Le mode actuel
     */
    function getMode() external view returns (uint256) {
        return mode;
    }

    /**
     * @notice Simule le remboursement de dette
     * @param asset L'adresse du token utilisé pour le remboursement
     * @param amount Le montant à rembourser
     * @param interestRateMode Le mode de taux d'intérêt
     * @param onBehalfOf L'adresse pour laquelle on rembourse la dette
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external override returns (uint256) {
        require(tokenToDebtToken[asset] != address(0), "Token not supported");
        
        // Récupérer le token de dette correspondant
        address debtToken = tokenToDebtToken[asset];
        
        // Calculer le montant réellement remboursé selon le mode (pas interestRateMode)
        uint256 actualRepaidAmount;
        if (mode == 1) {
            // Mode 1: soustraire 100 wei pour simuler une différence
            require(amount > 100, "Amount must be greater than 100 wei in mode 1");
            actualRepaidAmount = amount - 100;
        } else {
            // Mode 0: fonctionnement normal
            actualRepaidAmount = amount;
        }
        
        // Simuler le remboursement en transférant les debt tokens vers l'adresse 0
        // (équivalent à les brûler) - on brûle le montant réellement remboursé
        if(IERC20(debtToken).balanceOf(onBehalfOf) < actualRepaidAmount) {
            revert("Insufficient balance");
        }
        require(IERC20(debtToken).transferFrom(onBehalfOf, address(0x000000000000000000000000000000000000dEaD), actualRepaidAmount), "Transfer from failed");
        
        // Transférer les tokens de remboursement vers ce contrat (simulation)
        // Le contrat reçoit le montant total demandé
        if(IERC20(asset).balanceOf(msg.sender) < amount) {
            revert("Insufficient balance");
        }
        require(IERC20(asset).transferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount), "Transfer from failed");
        
        emit Repaid(asset, actualRepaidAmount, interestRateMode, onBehalfOf);
        return actualRepaidAmount;
    }

    function withdraw(address asset, uint256 amount, address to) external override returns (uint256) {
        require(tokenToSupplyToken[asset] != address(0), "Token not supported");
        address supplyToken = tokenToSupplyToken[asset];
        require(IERC20(supplyToken).transferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount), "Transfer from failed");

        require(IERC20(asset).transfer(to, amount), "Transfer from failed");
        emit Withdrawn(asset, amount, to);
        return amount;
    }

   /**
     *  @notice Récupère l'adresse du token de dette pour un token donné
     * @param token L'adresse du token
     * @return L'adresse du token de dette correspondant
     */
    function getDebtToken(address token) external view returns (address) {
        return tokenToDebtToken[token];
    }
}
