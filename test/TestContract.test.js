const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestContract", function () {
  let testContract;
  const initialMessage = "Hello, Gnosis!";

  beforeEach(async function () {
    const TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy(initialMessage);
    await testContract.waitForDeployment();
  });

  it("Should return the initial message", async function () {
    expect(await testContract.getMessage()).to.equal(initialMessage);
  });

  it("Should update the message", async function () {
    const newMessage = "Updated message";
    await testContract.setMessage(newMessage);
    expect(await testContract.getMessage()).to.equal(newMessage);
  });

  it("Should emit MessageUpdated event", async function () {
    const newMessage = "Updated message";
    await expect(testContract.setMessage(newMessage))
      .to.emit(testContract, "MessageUpdated")
      .withArgs(initialMessage, newMessage);
  });
}); 