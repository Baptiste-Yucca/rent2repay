// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IRMM.sol";
import "hardhat/console.sol";

/**
 * @title MockRMM
 * @notice Mock du Risk Management Module qui simule le comportement du vrai RMM
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
        
        // Simuler le remboursement en transférant les debt tokens vers l'adresse 0
        // (équivalent à les brûler)
        require(IERC20(debtToken).transferFrom(onBehalfOf, address(0x000000000000000000000000000000000000dEaD), amount), "Transfer from failed");
        
        // Transférer les tokens de remboursement vers ce contrat (simulation)
        require(IERC20(asset).transferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount), "Transfer from failed");
        
        emit Repaid(asset, amount, interestRateMode, onBehalfOf);
        return amount;
    }

    function withdraw(address asset, uint256 amount, address to) external override returns (uint256) {
        console.log("rmm.asset addr", asset);
        require(tokenToSupplyToken[asset] != address(0), "Token not supported");
        address supplyToken = tokenToSupplyToken[asset];
        console.log("rmm.supplyToken addr", supplyToken);
   
        require(IERC20(supplyToken).transferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount), "Transfer from failed");

        uint256 tmpbalance2 = IERC20(asset).balanceOf(address(this));
        console.log("rmm.tmpbalance stable", tmpbalance2);

        require(IERC20(asset).transfer(to, amount), "Transfer from failed");
        tmpbalance2 = IERC20(asset).balanceOf(address(this));
        console.log("rmm.tmpbalance stable after", tmpbalance2);
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