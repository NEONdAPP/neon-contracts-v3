const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers"); //Key function
const helpers = require("@nomicfoundation/hardhat-network-helpers"); //Full folder
const { ethers } = require("hardhat");

describe("NDCA Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("TestNDCA");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy(addr1.address, 15000000, 86400, 1, 30);
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

    describe("Deployment", function () {
        it("Should set the right parameter", async function () {
            const { contract, addr1 } = await loadFixture(deployContract);

            expect(await contract.NROUTER()).to.equal(addr1.address);
            expect(await contract.DEFAULT_APPROVAL()).to.equal(15000000);
        });
    });

    describe("Function 'Create DCA'", function () {
    //Fail Events
        it("Should fail if User or Reciever are 0x0", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 1,
                reqExecution: 0,
                nowFirstExecution: true
            };
            await expect(
                contract.connect(owner).createDCA(
                    ethers.constants.AddressZero,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Null address not allowed");
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    ethers.constants.AddressZero,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Null address not allowed");
        });

        it("Should fail if Tau is out of range (1-30)", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 0,
                nowFirstExecution: true
            };
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    0,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Tau out of limits");
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    31,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Tau out of limits");
        });

        it("Should fail if User try to create two identical DCA", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                )

            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Already created with this pair");
        });

        it("Should fail if User doesn't have balance", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            }
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await neonToken1.connect(owner).transfer(contract.address, await neonToken1.connect(owner).balanceOf(owner.address));
            
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Insufficient balance");
        });

        it("Should fail if User doesn't have allowance", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            }

            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWith("NDCA: Insufficient approved token");
        });
    //Correct Events 
        it("Should increase position and active DCA", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            }
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                )
            expect(await contract.connect(owner).activeDCAs()).to.equal(1);
            expect(await contract.connect(owner).totalPositions()).to.equal(1);
        });

        it("Should create DCA & emit the event", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.emit(contract, "DCACreated")
            .withArgs(await contract.connect(owner).totalPositions(), params.user);
        });

        it("Should accept 'DEFAUL_APPROVAL' if execution request is 0", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 0,
                nowFirstExecution: true
            };
            const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
            await neonToken1.connect(owner).approve(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
            
            await expect(
                contract.connect(owner).createDCA(
                    params.user,
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    params.ibStrategy,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.emit(contract, "DCACreated")
            .withArgs(await contract.connect(owner).totalPositions(), params.user);
        });

        it("Should assign correct values to the DCA", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: false
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            const startTime = await helpers.time.latest();
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            const timeDiff = (await helpers.time.latest() - startTime);
            const result = await contract.connect(owner).detailDCA(1, params.user);

            expect(result.reciever).to.equal(params.reciever);
            expect(result.srcToken).to.equal(params.srcToken);
            expect(result.chainId).to.equal(params.chainId);
            expect(result.destToken).to.equal(params.destToken);
            expect(result.ibStrategy).to.equal(params.ibStrategy);
            expect(result.srcAmount).to.equal(params.srcAmount);
            expect(result.tau).to.equal(params.tau);
            expect(result.nextExecution).to.equal((startTime + timeDiff + (result.tau * 86400)));
            expect(result.lastExecutionOk).to.equal(0);
            expect(result.averagePrice).to.equal(0);
            expect(result.destTokenEarned).to.equal(0);
            expect(result.reqExecution).to.equal(params.reqExecution);
            expect(result.perfExecution).to.equal(0);
            expect(result.strike).to.equal(0);
            expect(result.code).to.equal(0);
            expect(result.allowOK).to.equal(true);
            expect(result.balanceOK).to.equal(true);
        });

        it("Should assign actual time if DCA will be execute now", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            const startTime = await helpers.time.latest();
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            const timeDiff = (await helpers.time.latest() - startTime);
            const {nextExecution} = await contract.connect(owner).detailDCA(1, params.user);

            expect(nextExecution).to.equal((startTime + timeDiff));
        });

        it("Should assign correct allowance", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: false
            };
            //First DCA
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            //Second DCA
            await neonToken1.connect(owner).increaseAllowance(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                2,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            //Third DCA
            const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
            await neonToken1.connect(owner).increaseAllowance(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                3,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                0,
                params.nowFirstExecution
                );

            const {allowanceDCA} = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount);
            const refAllowance = params.srcAmount.mul(params.reqExecution).add(params.srcAmount.mul(params.reqExecution).add(ethers.utils.parseUnits(String(approvalAmount))));
            expect(allowanceDCA).to.equal(refAllowance);
        });
    });

    describe("Function 'Close DCA'", function () {
        //Fail Events
        it("Should fail if User are 0x0", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: false
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );

            await expect(
                contract.connect(owner).closeDCA(
                    ethers.constants.AddressZero,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.ibStrategy,
                    )
            ).to.be.revertedWith("NDCA: Null address not allowed");
        });
        it("Should fail if User have not DCA to close", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: false
            };

            await expect(
                contract.connect(owner).closeDCA(
                    params.user,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.ibStrategy,
                    )
            ).to.be.revertedWith("NDCA: Already closed");
        });
        //Correct Events 
        it("Should close DCA & emit the event", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                )
            await expect(
                contract.connect(owner).closeDCA(
                    params.user,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.ibStrategy,
                    )
            ).to.emit(contract, "DCAClosed")
            .withArgs(await contract.connect(owner).totalPositions(), params.user);
        });
        it("Should decrease active DCA but not positions", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                )
            await contract.connect(owner).closeDCA(
                params.user,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.ibStrategy,
                )
            expect(await contract.connect(owner).activeDCAs()).to.equal(0);
            expect(await contract.connect(owner).totalPositions()).to.equal(1);
        });
        it("Should decrease allowance", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: addr1.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: false
            };
            //First DCA
            await neonToken1.connect(owner).approve(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            //Second DCA
            await neonToken1.connect(owner).increaseAllowance(contract.address, (params.srcAmount.mul(params.reqExecution)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                2,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                params.reqExecution,
                params.nowFirstExecution
                );
            //Third DCA
            const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
            await neonToken1.connect(owner).increaseAllowance(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
            await contract.connect(owner).createDCA(
                params.user,
                params.reciever,
                params.srcToken,
                3,
                params.destToken,
                params.destDecimals,
                params.ibStrategy,
                params.srcAmount,
                params.tau,
                0,
                params.nowFirstExecution
                );
            
            await contract.connect(owner).closeDCA(
                params.user,
                params.srcToken,
                params.chainId,
                params.destToken,
                params.ibStrategy,
                )
            await contract.connect(owner).closeDCA(
                params.user,
                params.srcToken,
                3,
                params.destToken,
                params.ibStrategy,
                )

            const {allowanceDCA} = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount);
            const refAllowance = (params.srcAmount.mul(params.reqExecution));
            expect(allowanceDCA).to.equal(refAllowance);
        });
    });

});
