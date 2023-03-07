const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("SimulateStrategy Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("SimulateStrategy");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy();
        await contract.deployed();
        return {contractFactory, contract, owner, addr1, addr2};
    }
    
    async function deployNeonToken1(){
        const neonToken1Factory = await ethers.getContractFactory("NeonToken");
        const [nt1Owner, nt1Addr1, nt1Addr2] = await ethers.getSigners();
        const neonToken1 = await neonToken1Factory.deploy();
        await neonToken1.deployed();
        return {neonToken1Factory, neonToken1, nt1Owner, nt1Addr1, nt1Addr2};
    }
   
    describe("Simulate Deposit & Stake", function () {
    //Correct Events
        it("Deposit & Stake", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                token: neonToken1.address,
                pool: addr1.address,
                vault: addr2.address,
                amount: ethers.utils.parseUnits(String(200))

            }
            await contract.connect(owner).listNew(params.token, params.pool, params.vault);
            await neonToken1.connect(owner).approve(contract.address, params.amount);
            var baseline = await neonToken1.connect(owner).balanceOf(owner.address);
            await contract.connect(owner).depositAndStake(owner.address, owner.address, params.token, params.amount);
            var result = await contract.connect(owner).balanceOf(owner.address);
            expect(result).to.equal(ethers.utils.parseUnits(String(200)));
            expect(await neonToken1.connect(owner).balanceOf(owner.address)).to.equal(baseline.sub(ethers.utils.parseUnits(String(200))));
        });


    });

});