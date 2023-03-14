const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers"); //Key function
const helpers = require("@nomicfoundation/hardhat-network-helpers"); //Full folder
const { ethers } = require("hardhat");

describe("NDCA Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("NDCA");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const contract = await contractFactory.deploy(owner.address, addr1.address, 15000000, 86400, 1, 30);
        await contract.deployed();
        return {contractFactory, contract, owner, addr1, addr2};
    }

    async function deployNeonToken1(){
        const neonToken1Factory = await ethers.getContractFactory("NeonToken");
        const neonToken1 = await neonToken1Factory.deploy();
        await neonToken1.deployed();
        return {neonToken1Factory, neonToken1};
    }

    async function createDCA(){
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
            )
        const timeDiff = (await helpers.time.latest() - startTime);
        const exeTime = startTime - timeDiff + 2; //error time execution
        return {contract, owner, addr1, neonToken1, params, startTime};
    }


    describe("Deployment", function () {
        it("Should set the right parameter", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);

            expect(await contract.NCORE()).to.equal(owner.address);
            expect(await contract.RESOLVER()).to.equal(addr1.address);
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

        it("Should fail if function isn't called by NCore", async function () {
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
                contract.connect(addr1).createDCA(
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
            ).to.be.revertedWith("NDCA: Only Core is allowed");
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
            const result = await contract.connect(owner).detailDCA(1, params.user);
            const timeDiff = Math.abs((startTime + (result.tau * 86400)) - result.nextExecution)
            //Expected error of times up to 5 sec, because depend on computation time and there isn't a direct comparison
            const timeOk = timeDiff <= 5; 

            expect(result.reciever).to.equal(params.reciever);
            expect(result.srcToken).to.equal(params.srcToken);
            expect(result.chainId).to.equal(params.chainId);
            expect(result.destToken).to.equal(params.destToken);
            expect(result.ibStrategy).to.equal(params.ibStrategy);
            expect(result.srcAmount).to.equal(params.srcAmount);
            expect(result.tau).to.equal(params.tau);
            expect(timeOk).to.equal(true); //nextExecution
            expect(result.lastExecutionOk).to.equal(0);
            expect(result.averagePrice).to.equal(0);
            expect(result.destTokenEarned).to.equal(0);
            expect(result.reqExecution).to.equal(params.reqExecution);
            expect(result.perfExecution).to.equal(0);
            expect(result.strike).to.equal(0);
            expect(result.code).to.equal(0);
            expect(result.allowOk).to.equal(true);
            expect(result.balanceOk).to.equal(true);
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
            const {nextExecution} = await contract.connect(owner).detailDCA(1, params.user);
            const timeDiff = Math.abs(startTime - nextExecution);
            //Expected error of times up to 5 sec, because depend on computation time and there isn't a direct comparison
            const timeOk = timeDiff <= 5; 

            expect(timeOk).to.equal(true); //nextExecution
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

            const {allowanceDCA} = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);
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
        it("Should fail if User has not DCA to close", async function () {
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

            const { allowanceDCA } = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);
            const refAllowance = (params.srcAmount.mul(params.reqExecution));
            expect(allowanceDCA).to.equal(refAllowance);
        });
    });

    describe("Function 'Skip Execute'", function () {
    //Fail Events
        it("Should fail if DCA is closed", async function () {
            const { contract, owner, addr1 } = await loadFixture(deployContract);
            await expect(
                contract.connect(owner).skipNextExecution(
                    owner.address,
                    addr1.address,
                    1,
                    addr1.address,
                    addr1.address,
                    )
            ).to.be.revertedWith("NDCA: Already closed");
        });
    //Correct Events 
        it("Should skip & emit the event", async function () {
            const { contract, owner, params } = await loadFixture(createDCA);
            const { nextExecution } = await contract.connect(owner).detailDCA(1, params.user);
            const nextExe = nextExecution + (params.tau * 86400);
            await expect(
                contract.connect(owner).skipNextExecution(
                    params.user,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.ibStrategy,
                    )
            ).to.emit(contract, "DCASkipExe")
            .withArgs(await contract.connect(owner).totalPositions(), params.user, nextExe);
        });
    });

    describe("Function 'updateDCA'", function () {
    //Fail Events
        it("Should fail if id out of range", async function () {
            const { contract, owner} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            await expect(
                contract.connect(owner).updateDCA(
                    0,
                    data.destTokenAmount,
                    data.code,
                    data.averagePrice
                    )
            ).to.be.revertedWith("NDCA: Id out of range");

            await expect(
                contract.connect(owner).updateDCA(
                    2,
                    data.destTokenAmount,
                    data.code,
                    data.averagePrice
                    )
            ).to.be.revertedWith("NDCA: Id out of range");
        });
        it("Should fail if it's not the time to execute", async function () {
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
                )

            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            await expect(
                contract.connect(owner).updateDCA(
                    data.dcaId,
                    data.destTokenAmount,
                    data.code,
                    data.averagePrice
                    )
            ).to.be.revertedWith("NDCA: Execution not required");
        });
    //Correct Events
        it("Should Execute & emit the event", async function () {
            const { contract, owner, params} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            const ibEnable = params.ibStrategy != ethers.constants.AddressZero;
            await expect(
                contract.connect(owner).updateDCA(
                    data.dcaId,
                    data.destTokenAmount,
                    data.code,
                    data.averagePrice
                    )
            ).to.emit(contract, "DCAExecuted")
            .withArgs(data.dcaId, params.reciever, params.chainId, data.destTokenAmount, ibEnable, data.code);
        });

        it("Should Error & emit the event", async function () {
            const { contract, owner, params} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 400,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };

            await expect(
                contract.connect(owner).updateDCA(
                    data.dcaId,
                    data.destTokenAmount,
                    data.code,
                    data.averagePrice
                    )
            ).to.emit(contract, "DCAError")
            .withArgs(data.dcaId, params.user, 1);
        });

        it("Should refund user in case of error from the ROUTER", async function () {
            const { contract, owner, addr1, params, neonToken1} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 400,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            const initialBalance = await neonToken1.balanceOf(params.user);
            const RESOLVER = addr1;
            const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
            await contract.connect(owner).initExecution(await contract.connect(owner).totalPositions());
            await neonToken1.connect(RESOLVER).approve(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            
            expect(await neonToken1.balanceOf(RESOLVER.address)).to.equal(0);
            expect(await neonToken1.balanceOf(params.user)).to.equal(initialBalance);
        });

        it("Should refund user in case of error from the CONTRACT (Ib Strategy)", async function () {
            const { contract, owner, params, neonToken1} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(200)),
                code: 402,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            
            await neonToken1.connect(owner).transfer(contract.address, params.srcAmount);
            const initialBalance = await neonToken1.balanceOf(params.user);
            await contract.connect(owner).initExecution(await contract.connect(owner).totalPositions());
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            
            expect(await neonToken1.balanceOf(params.user)).to.equal(initialBalance);
        });

        it("Should automatic Close DCA after required execution reached", async function () {
            const { contract, owner, params} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            const {reciever} = await contract.connect(owner).detailDCA(1, params.user);
            expect(await contract.connect(owner).activeDCAs()).to.equal(0);
            expect(reciever).to.equal(ethers.constants.AddressZero);
        });

        it("Should Close DCA after 2 strike", async function () {
            const { contract, owner, params} = await loadFixture(createDCA);
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 400,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            //First Strike - DCA still presence
            var {reciever} = await contract.connect(owner).detailDCA(1, params.user);
            expect(await contract.connect(owner).activeDCAs()).to.equal(1);
            expect(reciever).to.equal(params.user);
            //skip time to execute second time
            await helpers.time.increase((params.tau * 86400));
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            //Second Strike - DCA closed
            var {reciever} = await contract.connect(owner).detailDCA(1, params.user);
            expect(await contract.connect(owner).activeDCAs()).to.equal(0);
            expect(reciever).to.equal(ethers.constants.AddressZero);
        });

        it("Should not close DCA if is setted unlimited", async function () {
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
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            //First Execution
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            var {reciever, perfExecution} = await contract.connect(owner).detailDCA(1, params.user);
            expect(await contract.connect(owner).activeDCAs()).to.equal(1);
            expect(reciever).to.equal(params.user);
            expect(perfExecution).to.equal(1);
            //Second Execution
            await helpers.time.increase((params.tau * 86400));
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            var {reciever, perfExecution} = await contract.connect(owner).detailDCA(1, params.user);
            expect(await contract.connect(owner).activeDCAs()).to.equal(1);
            expect(reciever).to.equal(params.user);
            expect(perfExecution).to.equal(2);
        });

        it("Should assign correct values", async function () {
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
            const data = {
                dcaId: await contract.connect(owner).totalPositions(),
                destTokenAmount: ethers.utils.parseUnits(String(999)),
                code: 200,
                averagePrice: ethers.BigNumber.from(String(1000000))
            };
            //First Execution
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            var result = await contract.connect(owner).detailDCA(1, params.user);
            expect(result.destTokenEarned).to.equal(data.destTokenAmount);
            expect(result.averagePrice).to.equal(data.averagePrice);
            //Second Execution
            await helpers.time.increase((params.tau * 86400));
            await contract.connect(owner).updateDCA(
                data.dcaId,
                data.destTokenAmount,
                data.code,
                data.averagePrice
                )
            var result = await contract.connect(owner).detailDCA(1, params.user);
            expect(result.destTokenEarned).to.equal(data.destTokenAmount.mul(2));
            expect(result.averagePrice).to.equal(data.averagePrice.add(data.averagePrice).div(2));
        });
    });

    describe("Function 'initExecution'", function () {
    //Fail Events
        it("Should fail if id out of range", async function () {
            const { contract, owner} = await loadFixture(createDCA);

            await expect(
                contract.connect(owner).initExecution(0)
            ).to.be.revertedWith("NDCA: Id out of range");

            await expect(
                contract.connect(owner).initExecution(2)
            ).to.be.revertedWith("NDCA: Id out of range");
        });
        it("Should fail if it's not the time to execute", async function () {
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
                )

            await expect(
                contract.connect(owner).initExecution(await contract.connect(owner).totalPositions())
            ).to.be.revertedWith("NDCA: Execution not required");
        });
    //Correct Events
        it("Should transfer correct amount of token", async function () {
            const { contract, owner, params, neonToken1} = await loadFixture(createDCA);
            await contract.connect(owner).initExecution(await contract.connect(owner).totalPositions());
            const RESOLVER = await contract.RESOLVER();
            expect(await neonToken1.balanceOf(RESOLVER)).to.equal(params.srcAmount);
        });
        it("Should transfer token only one time per execution", async function () {
            const { contract, owner, params, neonToken1} = await loadFixture(createDCA);
            await contract.connect(owner).initExecution(await contract.connect(owner).totalPositions());
            await contract.connect(owner).initExecution(await contract.connect(owner).totalPositions());
            const RESOLVER = await contract.RESOLVER();
            expect(await neonToken1.balanceOf(RESOLVER)).to.equal(params.srcAmount);
        });
    });

    describe("Function 'preCheck'", function () {
        //Correct Events
            it("Should return true if need to be execute", async function () {
                const { contract, owner} = await loadFixture(createDCA);
                const result = await contract.connect(owner).preCheck(await contract.connect(owner).totalPositions());
                expect(result).to.equal(true);
            });
            it("Should return false if doesn't exist DCA", async function () {
                const { contract, owner } = await loadFixture(deployContract);
                const result = await contract.connect(owner).preCheck(await contract.connect(owner).totalPositions());
                expect(result).to.equal(false);
            });
            it("Should return false if doesn't need to be execute", async function () {
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
                    nowFirstExecution: false
                };
                const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
                await neonToken1.connect(owner).approve(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
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
                const result = await contract.connect(owner).preCheck(await contract.connect(owner).totalPositions());
                expect(result).to.equal(false);
            });
        });

    describe("Function 'check'", function () {
        //Correct Events
            it("Should return true if need to be execute & balanceOK & AllowOK", async function () {
                const { contract, owner} = await loadFixture(createDCA);
                const result = await contract.connect(owner).check(await contract.connect(owner).totalPositions());
                expect(result.exe).to.equal(true);
                expect(result.allowOk).to.equal(true);
                expect(result.balanceOk).to.equal(true);
            });
            it("Should return false if not enough allowance", async function () {
                const { contract, owner, neonToken1} = await loadFixture(createDCA);
                await neonToken1.connect(owner).approve(contract.address, ethers.utils.parseUnits(String(0)));
                const { allowOk } = await contract.connect(owner).check(await contract.connect(owner).totalPositions());
                expect(allowOk).to.equal(false);
            });
            it("Should return false if not enough balance", async function () {
                const { contract, owner, neonToken1} = await loadFixture(createDCA);
                await neonToken1.connect(owner).transfer(contract.address, await neonToken1.connect(owner).balanceOf(owner.address));
                const { balanceOk } = await contract.connect(owner).check(await contract.connect(owner).totalPositions());
                expect(balanceOk).to.equal(false);
            });
            it("Should return false if doesn't exist DCA", async function () {
                const { contract, owner } = await loadFixture(deployContract);
                const { exe } = await contract.connect(owner).check(await contract.connect(owner).totalPositions());
                expect(exe).to.equal(false);
            });
            it("Should return false if doesn't need to be execute", async function () {
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
                    nowFirstExecution: false
                };
                const approvalAmount = await contract.connect(owner).DEFAULT_APPROVAL();
                await neonToken1.connect(owner).approve(contract.address, ethers.utils.parseUnits(String(approvalAmount)));
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
                const { exe } = await contract.connect(owner).check(await contract.connect(owner).totalPositions());
                expect(exe).to.equal(false);
            });
        });

    describe("Function 'detailDCA'", function () {
        //Correct Events
            it("Should return correct value", async function () {
                const { contract, owner, params, neonToken1} = await loadFixture(createDCA);
                const result = await contract.connect(owner).detailDCA(await contract.connect(owner).totalPositions(), params.user);
                const result1 = await contract.connect(owner).dataDCA(await contract.connect(owner).totalPositions());
                expect(result1.reciever).to.equal(result.reciever);
                expect(result1.srcToken).to.equal(result.srcToken);
                expect(result1.srcDecimals).to.equal(await neonToken1.connect(owner).decimals());
                expect(result1.chainId).to.equal(result.chainId);
                expect(result1.destToken).to.equal(result.destToken);
                expect(result1.destDecimals).to.equal(18);
                expect(result1.srcAmount).to.equal(result.srcAmount);                
            });
        });

    describe("Function 'checkAllowance'", function () {
        //Correct Events
            it("Should return AllowOk, CASE: ERC20 allowance > DCA allowance", async function () {
                const { contract, owner, addr1} = await loadFixture(deployContract);
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
                await neonToken1.connect(owner).increaseAllowance(contract.address, (params.srcAmount.mul(params.reqExecution)));
                const result = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);     
                expect(result.allowOk).to.equal(true);    
                expect(result.increase).to.equal(false);
                expect(result.allowanceToAdd).to.equal(0);         
                expect(result.allowanceDCA).to.equal(0);

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
                const { allowanceDCA } =  await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);    
                expect(allowanceDCA).to.equal((params.srcAmount.mul(params.reqExecution)));
            });
            it("Should return increase, CASE: ERC20 allowance & DCA allowance are equal", async function () {
                const { contract, owner, addr1} = await loadFixture(deployContract);
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
                
                const result = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);     
                expect(result.allowOk).to.equal(false);    
                expect(result.increase).to.equal(true);
                expect(result.allowanceToAdd).to.equal((params.srcAmount.mul(params.reqExecution)));         
                expect(result.allowanceDCA).to.equal(0);

                await neonToken1.connect(owner).increaseAllowance(contract.address, (params.srcAmount.mul(params.reqExecution)));
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
                const { allowanceDCA } =  await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);    
                expect(allowanceDCA).to.equal((params.srcAmount.mul(params.reqExecution)));
            });
            it("Should return approve, CASE: ERC20 allowance < DCA allowance", async function () {
                const { contract, owner, addr1} = await loadFixture(deployContract);
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
                
                await neonToken1.connect(owner).increaseAllowance(contract.address, (params.srcAmount.mul(params.reqExecution)));
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
                //Bring at 0 ERC20 allowance
                await neonToken1.connect(owner).approve(contract.address, ethers.utils.parseUnits(String(0)));
                const expectedAllowance = params.srcAmount.mul(params.reqExecution).mul(2);
                const result = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);     
                expect(result.allowOk).to.equal(false);    
                expect(result.increase).to.equal(false);
                expect(result.allowanceToAdd).to.equal(expectedAllowance);         
                expect(result.allowanceDCA).to.equal(params.srcAmount.mul(params.reqExecution));

                await neonToken1.connect(owner).approve(contract.address, expectedAllowance);
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
                )
                const { allowanceDCA } =  await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);    
                expect(allowanceDCA).to.equal(expectedAllowance);
            });
            it("Should return 'DEAFULT AMOUNT' in case of required execution is 0", async function () {
                const { contract, owner, addr1} = await loadFixture(deployContract);
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
                await neonToken1.connect(owner).increaseAllowance(contract.address, ethers.utils.parseUnits(String(approvalAmount)));

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
                const result = await contract.connect(owner).checkAllowance(params.user, params.srcToken, params.srcAmount, params.reqExecution);     
                expect(result.allowOk).to.equal(false);    
                expect(result.increase).to.equal(true);
                expect(result.allowanceToAdd).to.equal(ethers.utils.parseUnits(String(approvalAmount)));         
                expect(result.allowanceDCA).to.equal(ethers.utils.parseUnits(String(approvalAmount)));
            });
        });
    describe("Function 'checkAvailability'", function () {
        //Correct Events
            it("Should return true when DCA is available to be created", async function () {
                const { contract, owner, addr1} = await loadFixture(deployContract);
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
                const result = await contract.connect(owner).checkAvailability(params.user, params.srcToken, params.chainId, params.destToken, params.ibStrategy);
                expect(result).to.equal(true);              
            });
            it("Should return false when DCA is already created", async function () {
                const { contract, owner, params} = await loadFixture(createDCA);
                const result = await contract.connect(owner).checkAvailability(params.user, params.srcToken, params.chainId, params.destToken, params.ibStrategy);
                expect(result).to.equal(false);              
            });
        });
});
