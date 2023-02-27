const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("NHistorian Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("TestNHistorian");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy();
        await contract.deployed();
        return {contractFactory, contract, owner, addr1, addr2};
    }
   
    describe("Store and Get Data", function () {
    //Fail Events
        it("Should fail if address is 0x0", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).store(ethers.constants.AddressZero, [addr1.address, 1, addr1.address, owner.address, 69, 4])
            ).to.be.revertedWith("NHistorian: Null address not allowed");
        });
    //Correct Events
        it("Should increase data counter by 1", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            await contract.connect(owner).store(owner.address, [addr1.address, 1, addr1.address, owner.address, 69, 4]);
            var result = await contract.connect(owner).getData(owner.address);
            expect(result[1]).to.equal(1);
        });

        it("Should be limited at 200", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            for(var i=1; i<=201; i++){
                await contract.connect(owner).store(owner.address, [addr1.address, 1, addr1.address, owner.address, 69, 4]);
            }
            var result = await contract.connect(owner).getData(owner.address);
            expect(result[1]).to.equal(200);
        });

        it("If Addr1 store data, Addr2 should remains unchanged", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            await contract.connect(owner).store(addr1.address, [addr1.address, 1, addr1.address, owner.address, 69, 4]);
            var result = await contract.connect(owner).getData(addr2.address);
            expect(result[1]).to.equal(0);
        });

        it("Over 200 should restart from the first one", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            for(var i=1; i<=200; i++){
                await contract.connect(owner).store(owner.address, [addr1.address, 1, addr1.address, owner.address, 69, 4]);
            }
            await contract.connect(owner).store(owner.address, [addr1.address, 1, addr1.address, owner.address, 69, 4]);
            var result = await contract.connect(owner).getData(owner.address);
            expect(result[0][0][1]).to.equal(ethers.BigNumber.from(1));//chainId
        });
    });

});