// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestContract {
    string private message;

    event MessageUpdated(string oldMessage, string newMessage);

    constructor(string memory initialMessage) {
        message = initialMessage;
    }

    function setMessage(string memory newMessage) public {
        string memory oldMessage = message;
        message = newMessage;
        emit MessageUpdated(oldMessage, newMessage);
    }

    function getMessage() public view returns (string memory) {
        return message;
    }
} 