// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Rent2RepayAuthorizer {
    // Structure pour stocker toutes les informations d'un utilisateur
    struct UserConfig {
        uint256 weeklyMaxAmount;     // Montant maximum par semaine
        uint256 lastRepayTimestamp;  // Timestamp du dernier remboursement
        uint256 currentWeekSpent;    // Montant déjà remboursé cette semaine
    }

    // Une seule map pour tout stocker
    mapping(address => UserConfig) public userConfigs;

    // Constante pour une semaine en secondes
    uint256 constant WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

    // Événements
    event Rent2RepayConfigured(address indexed user, uint256 weeklyMaxAmount);
    event Rent2RepayRevoked(address indexed user);
    event RepaymentExecuted(address indexed user, uint256 amount, uint256 remainingThisWeek);

    /**
     * @notice Configure le mécanisme Rent2Repay pour msg.sender
     * @param weeklyMaxAmount Montant maximum autorisé par semaine (doit être > 0)
     */
    function configureRent2Repay(uint256 weeklyMaxAmount) external {
        require(weeklyMaxAmount > 0, "Amount must be greater than 0");
        
        userConfigs[msg.sender] = UserConfig({
            weeklyMaxAmount: weeklyMaxAmount,
            lastRepayTimestamp: 0,
            currentWeekSpent: 0
        });
        
        emit Rent2RepayConfigured(msg.sender, weeklyMaxAmount);
    }

    /**
     * @notice Révoque l'autorisation du mécanisme Rent2Repay pour msg.sender
     */
    function revokeRent2Repay() external {
        require(isAuthorized(msg.sender), "Not authorized");
        
        delete userConfigs[msg.sender];
        emit Rent2RepayRevoked(msg.sender);
    }

    /**
     * @notice Vérifie si un utilisateur a autorisé le mécanisme
     * @param user Adresse de l'utilisateur
     * @return true si autorisé (weeklyMaxAmount > 0)
     */
    function isAuthorized(address user) public view returns (bool) {
        return userConfigs[user].weeklyMaxAmount > 0;
    }

    /**
     * @notice Calcule le montant disponible pour remboursement cette semaine
     * @param user Adresse de l'utilisateur
     * @return Montant disponible pour cette semaine
     */
    function getAvailableAmountThisWeek(address user) public view returns (uint256) {
        UserConfig memory config = userConfigs[user];
        
        if (config.weeklyMaxAmount == 0) {
            return 0; // Utilisateur non autorisé
        }

        // Si plus d'une semaine s'est écoulée, reset le compteur
        if (block.timestamp >= config.lastRepayTimestamp + WEEK_IN_SECONDS) {
            return config.weeklyMaxAmount;
        }

        // Sinon, retourner ce qui reste pour cette semaine
        return config.weeklyMaxAmount - config.currentWeekSpent;
    }

    /**
     * @notice Fonction appelée avant un remboursement pour vérifier et mettre à jour les limites
     * @param user Adresse de l'utilisateur pour qui effectuer le remboursement
     * @param amount Montant à rembourser
     * @return true si le remboursement est autorisé
     */
    function validateAndUpdateRepayment(address user, uint256 amount) external returns (bool) {
        require(amount > 0, "Amount must be greater than 0");
        require(isAuthorized(user), "User not authorized");

        UserConfig storage config = userConfigs[user];

        // Si plus d'une semaine s'est écoulée, reset le compteur
        if (block.timestamp >= config.lastRepayTimestamp + WEEK_IN_SECONDS) {
            config.currentWeekSpent = 0;
        }

        // Vérifier si le montant est dans la limite
        require(config.currentWeekSpent + amount <= config.weeklyMaxAmount, "Weekly limit exceeded");

        // Mettre à jour les valeurs
        config.currentWeekSpent += amount;
        config.lastRepayTimestamp = block.timestamp;

        emit RepaymentExecuted(user, amount, config.weeklyMaxAmount - config.currentWeekSpent);
        
        return true;
    }

    /**
     * @notice Récupère la configuration d'un utilisateur
     * @param user Adresse de l'utilisateur
     * @return weeklyMaxAmount, lastRepayTimestamp, currentWeekSpent
     */
    function getUserConfig(address user) external view returns (uint256, uint256, uint256) {
        UserConfig memory config = userConfigs[user];
        return (config.weeklyMaxAmount, config.lastRepayTimestamp, config.currentWeekSpent);
    }
} 