// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./MockERC20.sol";
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
    
    event Repaid(address token, uint256 amount, uint256 mode, address user);
    event Withdrawn(address token, uint256 amount, address to);

    
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
        

        uint256 actualRepaidAmount = amount;

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

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 /* referralCode */
    ) external override {
        require(tokenToSupplyToken[asset] != address(0), "Token not supported");

        address supplyToken = tokenToSupplyToken[asset];

        // 1. User envoie l'asset (ex: USDC) au MockRMM
        require(
            IERC20(asset).transferFrom(msg.sender, address(this), amount),
            "Transfer asset failed"
        );

        // 2. Mint ou transférer les supplyTokens
        // Ici on suppose que supplyToken est un ERC20 mintable mock
        MockERC20(supplyToken).mint(onBehalfOf, amount);
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
