const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("NPairs Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("NPairs");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy(owner.address);
        await contract.deployed();
        return {contractFactory, contract, owner, addr1, addr2};
    }
    async function deployToken1(){
        const token1Factory = await ethers.getContractFactory("ERC20");
        const [t1Owner, t1Addr1, t1Addr2] = await ethers.getSigners();
        const token1 = await token1Factory.deploy("TestToken1", "TST1");
        await token1.deployed();
        return {token1Factory, token1, t1Owner, t1Addr1, t1Addr2};
    }

    async function deployToken2(){
        const token2Factory = await ethers.getContractFactory("ERC20");
        const [t2Owner, t2Addr1, t2Addr2] = await ethers.getSigners();
        const token2 = await token2Factory.deploy("TestToken2", "TST2");
        await token2.deployed();
        return {token2Factory, token2, t2Owner, t2Addr1, t2Addr2};
    }

    describe("Deployment", function () {
        it("Should set the right Owner", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const contractOwner = await contract.OWNER();

            expect(owner.address).to.equal(contractOwner);
        });
    });
    
    describe("Function 'listSrcTokens'", function () {
    //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).listSrcTokens([owner.address])
              ).to.be.revertedWithCustomError(contract, "NOT_OWNER");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            await expect(
                contract.connect(owner).listSrcTokens([ethers.constants.AddressZero])
            ).to.be.revertedWithCustomError(contract, "ZERO_ADDRESS_2");
        });

        it("Should fail if Token is already listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const tokens = [token1.address, token1.address];

            await expect(
                contract.connect(owner).listSrcTokens(tokens)
            ).to.be.revertedWithCustomError(contract, "ALREADY_LISTED");
        });

    //Correct Events
        it("Should list the Token & emit the event", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);

            await expect(contract.connect(owner).listSrcTokens([token1.address]))
            .to.emit(contract, "SrcTokenListed")
            .withArgs(token1.address, await token1.symbol());
        });

        it("Should increase counter by 1 per token listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listSrcTokens([token1.address, token2.address]);
            var result = await contract.connect(owner).totalListed();

            expect(result[0]).to.equal(2);
        });
    });

    describe("Function 'listDestTokens'", function () {
        //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).listDestTokens([1], [owner.address], [18], ["TST"])
            ).to.be.revertedWithCustomError(contract, "NOT_OWNER");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listDestTokens([1], [ethers.constants.AddressZero], [18], ["TST"])
            ).to.be.revertedWithCustomError(contract, "ZERO_ADDRESS_2");
        });

        it("Should fail if chainId is 0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listDestTokens([0], [owner.address], [18], ["TST"])
            ).to.be.revertedWithCustomError(contract, "INVALID_CHAIN");
        });

        it("Should fail if Token is already listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            //await contract.connect(owner).listDestTokens([1, 1], [token1.address, token1.address], [18, 18], ["TST", "TST"]);

            await expect(
                contract.connect(owner).listDestTokens([1, 1], [token1.address, token1.address], [18, 18], ["TST", "TST"])
            ).to.be.revertedWithCustomError(contract, "ALREADY_LISTED");
        });

    //Correct Events
        it("Should list the Token & emit the event", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);

            await expect(contract.connect(owner).listDestTokens([1], [token1.address], [18], ["TST"]))
            .to.emit(contract, "DestTokenListed")
            .withArgs(1, token1.address, "TST");
        });

        it("Should list identical token if in different chain", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);

            await expect(contract.connect(owner).listDestTokens([1], [token1.address], [18], ["TST"]))
            .to.emit(contract, "DestTokenListed")
            .withArgs(1, token1.address, "TST");

            await expect(contract.connect(owner).listDestTokens([2], [token1.address], [18], ["TST"]))
            .to.emit(contract, "DestTokenListed")
            .withArgs(2, token1.address, "TST");
        });

        it("Should increase counter by 1 per token listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listDestTokens([1, 1, 2], [token1.address, token2.address, token2.address], [18, 18, 18], ["TST", "TST", "TST"]);
            var result = await contract.connect(owner).totalListed();

            expect(result[1]).to.equal(3);
        });
    });

    describe("Function 'blacklistPair'", function () {
    //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).blacklistPair(addr1.address, 1, addr1.address)
            ).to.be.revertedWithCustomError(contract, "NOT_OWNER");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);
    
            await expect(
                contract.connect(owner).blacklistPair(ethers.constants.AddressZero, 1, owner.address)
            ).to.be.revertedWithCustomError(contract, "ZERO_ADDRESS_2");
    
            await expect(
                contract.connect(owner).blacklistPair(owner.address, 1,  ethers.constants.AddressZero)
            ).to.be.revertedWithCustomError(contract, "ZERO_ADDRESS_2");
    
            await expect(
                contract.connect(owner).blacklistPair(ethers.constants.AddressZero, 1, ethers.constants.AddressZero)
            ).to.be.revertedWithCustomError(contract, "ZERO_ADDRESS_2");
        });

        it("Should fail if SrcToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
    
            await expect(
                contract.connect(owner).blacklistPair(owner.address, 1, owner.address)
            ).to.be.revertedWithCustomError(contract, "NOT_LISTED");
        });

        it("Should fail if DestToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcTokens([token1.address]);

            await expect(
                contract.connect(owner).blacklistPair(token1.address, 1, owner.address)
            ).to.be.revertedWithCustomError(contract, "NOT_LISTED");
        });

    //Correct Events
        it("Should return 'true' if combination available", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcTokens([token1.address]);
            await contract.connect(owner).listDestTokens([1], [token1.address], [18], ["TST"]);

            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token1.address)).to.equal(true);
        });

        it("Should return 'false' if combination not available", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcTokens([token1.address]);
            await contract.connect(owner).listDestTokens([1], [token1.address], [18], ["TST"]);
            await contract.connect(owner).blacklistPair(token1.address, 1, token1.address)

            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token1.address)).to.equal(false);
        });

        it("Should not change state of the other combinations", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listSrcTokens([token1.address, token2.address]);
            await contract.connect(owner).listDestTokens([1, 1], [token1.address, token2.address], [18, 18], ["TST", "TST"]);
            await contract.connect(owner).blacklistPair(token1.address, 1, token1.address)
            /* Combinations (Based on chainId 1)
                Token1 - Token1
                Token1 - Token2
                Token2 - Token1
                Token2 - Token2
            */
            expect(await contract.connect(owner).isPairAvailable(token2.address, 1, token1.address)).to.equal(true);
            expect(await contract.connect(owner).isPairAvailable(token2.address, 1, token2.address)).to.equal(true);
            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token2.address)).to.equal(true);
            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token1.address)).to.equal(false);
        });

    });
    describe("Function 'isPairAvailable'", function () {
    //Fail Events
        it("Should fail if SrcToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).isPairAvailable(owner.address, 1, owner.address)
            ).to.be.revertedWithCustomError(contract, "NOT_LISTED");
        });

        it("Should fail if DestToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcTokens([token1.address]);

            await expect(
                contract.connect(owner).isPairAvailable(token1.address, 1, owner.address)
            ).to.be.revertedWithCustomError(contract, "NOT_LISTED");
        });
    });
});