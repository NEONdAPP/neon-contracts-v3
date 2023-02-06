const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("NPairs Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("NPairs");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy();
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
            const contractOwner = await contract.owner();

            expect(owner.address).to.equal(contractOwner);
        });
    });
    
    describe("Function 'listSrcToken'", function () {
    //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).listSrcToken(owner.address)
              ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listSrcToken(ethers.constants.AddressZero)
            ).to.be.revertedWith("NPairs: Null address not allowed");
        });

        it("Should fail if Token is already listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);

            await expect(
                contract.connect(owner).listSrcToken(token1.address)
            ).to.be.revertedWith("NPairs: Token already listed");
        });

    //Correct Events
        it("Should list the Token & emit the event", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);

            await expect(contract.connect(owner).listSrcToken(token1.address))
            .to.emit(contract, "SrcTokenListed")
            .withArgs(token1.address, await token1.symbol());
        });

        it("Should increase counter by 1 per token listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listSrcToken(token1.address);
            await contract.connect(owner).listSrcToken(token2.address);
            var result = await contract.connect(owner).totalListed();

            expect(result[0]).to.equal(2);
        });

        it("Should return 'true' if Token is listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);

            expect(
                await contract.connect(owner).isSrcTokenListed(token1.address)
            ).to.equal(true);
        });

        it("Should return 'false' if Token isn't listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            expect(
                await contract.connect(owner).isSrcTokenListed(owner.address)
            ).to.equal(false);
        });
    });

    describe("Function 'listDestToken'", function () {
        //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).listDestToken(1, owner.address, 18, "TST")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listDestToken(1, ethers.constants.AddressZero, 18, "TST")
            ).to.be.revertedWith("NPairs: Null address not allowed");
        });

        it("Should fail if chainId is 0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listDestToken(0, owner.address, 18, "TST")
            ).to.be.revertedWith("NPairs: Chain ID must be > 0");
        });

        it("Should fail if Token is already listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");

            await expect(
                contract.connect(owner).listDestToken(1, token1.address, 18, "TST")
            ).to.be.revertedWith("NPairs: Token already listed");
        });

    //Correct Events
        it("Should list the Token & emit the event", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);

            await expect(contract.connect(owner).listDestToken(1, token1.address, 18, "TST"))
            .to.emit(contract, "DestTokenListed")
            .withArgs(1, token1.address, "TST");
        });

        it("Should list identical token if in different chain", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);

            await expect(contract.connect(owner).listDestToken(1, token1.address, 18, "TST"))
            .to.emit(contract, "DestTokenListed")
            .withArgs(1, token1.address, "TST");

            await expect(contract.connect(owner).listDestToken(2, token1.address, 18, "TST"))
            .to.emit(contract, "DestTokenListed")
            .withArgs(2, token1.address, "TST");
        });

        it("Should increase counter by 1 per token listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");
            await contract.connect(owner).listDestToken(1, token2.address, 18, "TST");
            await contract.connect(owner).listDestToken(2, token2.address, 18, "TST");
            var result = await contract.connect(owner).totalListed();

            expect(result[1]).to.equal(3);
        });

        it("Should return 'true' & correct Decimals if Token is listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");
            var result = await contract.connect(owner).isDestTokenListed(1, token1.address);

            expect(result[0]).to.equal(true);
            expect(result[1]).to.equal(18);
        });

        it("Should return Decimals & Symbol from ERC20 if in the current chain", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);

            await expect(contract.connect(owner).listDestToken(contract.deployTransaction.chainId, token1.address, 0, "-"))
            .to.emit(contract, "DestTokenListed")
            .withArgs(31337, token1.address, await token1.symbol());

            var result = await contract.connect(owner).isDestTokenListed(contract.deployTransaction.chainId, token1.address);
            expect(result[1]).to.equal(await token1.decimals());
        });

        it("Should return 'false' if Token isn't listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            var result = await contract.connect(owner).isDestTokenListed(1, owner.address);

            expect(result[0]).to.equal(false);
        });

        it("Should return 'false' if Token is in a different chain", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");
            var result = await contract.connect(owner).isDestTokenListed(2, token1.address);

            expect(result[0]).to.equal(false);
        });
    });

    describe("Function 'listIbStrategy'", function () {
    //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).listIbStrategy(addr1.address, addr1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listIbStrategy(ethers.constants.AddressZero, owner.address)
            ).to.be.revertedWith("NPairs: Null address not allowed");

            await expect(
                contract.connect(owner).listIbStrategy(owner.address, ethers.constants.AddressZero)
            ).to.be.revertedWith("NPairs: Null address not allowed");

            await expect(
                contract.connect(owner).listIbStrategy(ethers.constants.AddressZero, ethers.constants.AddressZero)
            ).to.be.revertedWith("NPairs: Null address not allowed");
        });

        it("Should fail if Token isn't listed", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(owner).listIbStrategy(addr1.address, addr1.address)
            ).to.be.revertedWith("NPairs: Reference token not listed");
        });

        it("Should fail if Strategy is already listed", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listDestToken(contract.deployTransaction.chainId, token1.address, 0, "-");
            await contract.connect(owner).listIbStrategy(token1.address, addr1.address);

            await expect(contract.connect(owner).listIbStrategy(token1.address, addr1.address)
            ).to.be.revertedWith("NPairs: Strategy already listed");
        });
    //Correct Events
        it("Should list the Strategy & emit the event", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listDestToken(contract.deployTransaction.chainId, token1.address, 0, "-");
            
            await expect(contract.connect(owner).listIbStrategy(token1.address, addr1.address))
            .to.emit(contract, "IbStrategyListed")
            .withArgs(token1.address, addr1.address);
        });

        it("Should increase counter by 1 per strategy listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listDestToken(contract.deployTransaction.chainId, token1.address, 0, "-");
            await contract.connect(owner).listDestToken(contract.deployTransaction.chainId, token2.address, 0, "-");
            
            await contract.connect(owner).listIbStrategy(token1.address, token1.address);
            await contract.connect(owner).listIbStrategy(token1.address, owner.address);
            await contract.connect(owner).listIbStrategy(token2.address, token1.address);
            var result = await contract.connect(owner).totalListed();

            expect(result[2]).to.equal(3);
        });
    });
    describe("Function 'definePairAvailability'", function () {
    //Fail Events
        it("Should fail if not Owner", async function () {
            const { contract, addr1 } = await loadFixture(deployContract);

            await expect(
                contract.connect(addr1).definePairAvailability(addr1.address, 1, addr1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail if address is 0x0", async function () {
            const { contract, owner } = await loadFixture(deployContract);
    
            await expect(
                contract.connect(owner).definePairAvailability(ethers.constants.AddressZero, 1, owner.address)
            ).to.be.revertedWith("NPairs: Null address not allowed");
    
            await expect(
                contract.connect(owner).definePairAvailability(owner.address, 1,  ethers.constants.AddressZero)
            ).to.be.revertedWith("NPairs: Null address not allowed");
    
            await expect(
                contract.connect(owner).definePairAvailability(ethers.constants.AddressZero, 1, ethers.constants.AddressZero)
            ).to.be.revertedWith("NPairs: Null address not allowed");
        });

        it("Should fail if SrcToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
    
            await expect(
                contract.connect(owner).definePairAvailability(owner.address, 1, owner.address)
            ).to.be.revertedWith("NPairs: Src.Token not listed");
        });

        it("Should fail if DestToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);

            await expect(
                contract.connect(owner).definePairAvailability(token1.address, 1, owner.address)
            ).to.be.revertedWith("NPairs: Dest.Token not listed");
        });

    //Correct Events
        it("Should return 'true' if combination available", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");

            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token1.address)).to.equal(true);
        });

        it("Should return 'false' if combination not available", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");
            await contract.connect(owner).definePairAvailability(token1.address, 1, token1.address)

            expect(await contract.connect(owner).isPairAvailable(token1.address, 1, token1.address)).to.equal(false);
        });

        it("Should not change state of the other combinations", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            const { token2 } = await loadFixture(deployToken2);
            await contract.connect(owner).listSrcToken(token1.address);
            await contract.connect(owner).listSrcToken(token2.address);
            await contract.connect(owner).listDestToken(1, token1.address, 18, "TST");
            await contract.connect(owner).listDestToken(1, token2.address, 18, "TST");
            await contract.connect(owner).definePairAvailability(token1.address, 1, token1.address)
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
            ).to.be.revertedWith("NPairs: Src.Token not listed");
        });

        it("Should fail if DestToken not listed", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { token1 } = await loadFixture(deployToken1);
            await contract.connect(owner).listSrcToken(token1.address);

            await expect(
                contract.connect(owner).isPairAvailable(token1.address, 1, owner.address)
            ).to.be.revertedWith("NPairs: Dest.Token not listed");
        });
    });
});