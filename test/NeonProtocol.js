const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

describe("Neon Protocol (NManager) Testing", function () {
    async function deployContract(){
        const contractFactory = await ethers.getContractFactory("NManager");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const params = {
            resolver: owner.address,
            defaultApproval: 15000000,
            timeBase: 86400,
            minTau: 1,
            maxTau: 30
        }
        const contract = await contractFactory.deploy(params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau);
        await contract.deployed();

        //Connect to enbedded contract
        const dcaFactory = await ethers.getContractFactory("NCore");
        const dca = dcaFactory.attach(await contract.CORE());
        const poolFactory = await ethers.getContractFactory("NPairs");
        const pool = poolFactory.attach(await contract.POOL());
        return {contract, dca, pool, owner, addr1, addr2};
    }

    async function deployStrategy(){
        const strategyFactory = await ethers.getContractFactory("SimulateStrategy");
        const [owner, addr1, addr2] = await ethers.getSigners();
        const strategy = await strategyFactory.deploy();
        await strategy.deployed();
        return {strategyFactory, strategy, owner, addr1, addr2};
    }

    async function deployNeonToken1(){
        const neonToken1Factory = await ethers.getContractFactory("NeonToken");
        const neonToken1 = await neonToken1Factory.deploy();
        await neonToken1.deployed();
        return {neonToken1Factory, neonToken1};
    }

    async function deployNeonToken2(){
        const neonToken1Factory = await ethers.getContractFactory("NeonToken");
        const neonToken2 = await neonToken1Factory.deploy();
        await neonToken2.deployed();
        return {neonToken1Factory, neonToken2};
    }


    //pre-build funcionalities
    async function listToken(_owner, _contract, _pool, _srcToken, _destToken){
        await _pool.connect(_owner).listSrcTokens([_srcToken.address]);
        await _pool.connect(_owner).listDestTokens([_contract.deployTransaction.chainId], [_destToken.address], [18], ["NEON"]);
    }

    async function strategyEnable(_destToken){
        const { strategy, owner, addr2 } = await loadFixture(deployStrategy);
        const params = {
            token: _destToken.address,
            pool: addr2.address,
            vault: addr2.address,
        }
        await strategy.connect(owner).listNew(params.token, params.pool, params.vault);
        return {strategy};
    }

    async function createDCA(_owner, _contract, _dca, _srcToken, _params){
        await _srcToken.connect(_owner).approve(_dca.address, (_params.srcAmount.mul(_params.reqExecution)));
        await _contract.connect(_owner).createDCA(
            _params.reciever,
            _params.srcToken,
            _params.chainId,
            _params.destToken,
            _params.destDecimals,
            _params.ibStrategy,
            _params.srcAmount,
            _params.tau,
            _params.reqExecution,
            _params.nowFirstExecution
            );
    }

    async function startupResolver(_owner, _contract){
        await _contract.connect(_owner).startupResolver();
    }

   
    describe("Deployment", function () {
        it("Should set the right Addresses", async function () {
            const { contract, dca, pool, owner } = await loadFixture(deployContract);
            const resolver = await contract.RESOLVER();
            expect(owner.address).to.equal(resolver);
            expect(dca.address).to.equal(await contract.CORE());
            expect(pool.address).to.equal(await contract.POOL());
        });
    });

    describe("USER: Create DCA position", function () {
    //Fail Events
        it("Should fail if Pair isn't available", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            pool.connect(owner).blacklistPair(params.srcToken, params.chainId, params.destToken)
            await strategyEnable(neonToken1);
            await neonToken1.connect(owner).approve(dca.address, (params.srcAmount.mul(params.reqExecution)));
            await expect(
                contract.connect(owner).createDCA(
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
            ).to.be.revertedWithCustomError(contract, "PAIR_NOT_AVAILABLE");
        });
        it("Should fail if Strategy isn't available", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            const { strategy } = await strategyEnable(addr1);
            await neonToken1.connect(owner).approve(dca.address, (params.srcAmount.mul(params.reqExecution)));
            await expect(
                contract.connect(owner).createDCA(
                    params.reciever,
                    params.srcToken,
                    params.chainId,
                    params.destToken,
                    params.destDecimals,
                    strategy.address,
                    params.srcAmount,
                    params.tau,
                    params.reqExecution,
                    params.nowFirstExecution
                    )
            ).to.be.revertedWithCustomError(contract, "STRATEGY_NOT_AVAILABLE");
        });
    //Corrent Events
        it("Should create DCA ignoring Ib if address is 0x0", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            const { strategy } = await strategyEnable(neonToken1);
            await createDCA(owner, contract, dca, neonToken1, params);
        });
        it("Should create DCA ignoring Ib if Crosschain", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            await pool.connect(owner).listDestTokens([1], [neonToken1.address], [18], ["NEON"]);
            const { strategy } = await strategyEnable(neonToken1);
            const params = {
                user: owner.address,
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: 1,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: strategy.address,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await createDCA(owner, contract, dca, neonToken1, params);
        });
    });
    describe("USER: Close DCA position", function () {
        //Corrent Events
            it("Should close DCA", async function () {
                const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
                const { neonToken1 } = await loadFixture(deployNeonToken1);
                await listToken(owner, contract, pool, neonToken1, neonToken1);
                const { strategy } = await strategyEnable(neonToken1);
                const params = {
                    user: owner.address,
                    reciever: owner.address,
                    srcToken: neonToken1.address,
                    chainId: contract.deployTransaction.chainId,
                    destToken: neonToken1.address,
                    destDecimals: 18,
                    ibStrategy: strategy.address,
                    srcAmount: ethers.utils.parseUnits(String(200)),
                    tau: 10,
                    reqExecution: 1,
                    nowFirstExecution: true
                };
                await createDCA(owner, contract, dca, neonToken1, params);
                await contract.connect(owner).closeDCA(params.srcToken, params.chainId, params.destToken, params.ibStrategy);
            });
        });
    describe("USER: Skip Next Execution", function () {
        //Corrent Events
            it("Should skip execution", async function () {
                const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
                const { neonToken1 } = await loadFixture(deployNeonToken1);
                await listToken(owner, contract, pool, neonToken1, neonToken1);
                const { strategy } = await strategyEnable(neonToken1);
                const params = {
                    user: owner.address,
                    reciever: owner.address,
                    srcToken: neonToken1.address,
                    chainId: contract.deployTransaction.chainId,
                    destToken: neonToken1.address,
                    destDecimals: 18,
                    ibStrategy: strategy.address,
                    srcAmount: ethers.utils.parseUnits(String(200)),
                    tau: 10,
                    reqExecution: 1,
                    nowFirstExecution: true
                };
                await createDCA(owner, contract, dca, neonToken1, params);
                await contract.connect(owner).skipNextExecution(params.srcToken, params.chainId, params.destToken, params.ibStrategy);
            });
        });
    describe("RESOLVER: Get Residual", function () {
        //Fail Events
        it("Should fail if not Resolver", async function () {
            const { contract, addr1, addr2 } = await loadFixture(deployContract);
            const tokens = [addr1.address, addr2.address];
            await expect(
                contract.connect(addr1).getResidual(tokens)
            ).to.be.revertedWithCustomError(contract, "NOT_RESOLVER");
        });
        it("Should fail if Resolver is computing", async function () {
            const { contract, owner, addr1, addr2 } = await loadFixture(deployContract);
            const tokens = [addr1.address, addr2.address];
            await startupResolver(owner, contract);
            await expect(
                contract.connect(owner).getResidual(tokens)
            ).to.be.revertedWithCustomError(contract, "RESOLVER_BUSY");
        });
        //Corrent Events
        it("Should trasfer residual to Resolver", async function () {
            const { contract, owner } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const { neonToken2 } = await loadFixture(deployNeonToken2);
            const tokens = [neonToken1.address, neonToken2.address];
            await neonToken1.connect(owner).transfer(contract.address, ethers.utils.parseUnits(String(1000)));
            await neonToken2.connect(owner).transfer(contract.address, ethers.utils.parseUnits(String(1000)));
            await contract.connect(owner).getResidual(tokens);
            expect(await neonToken1.connect(owner).balanceOf(contract.address)).to.equal(0);
            expect(await neonToken2.connect(owner).balanceOf(contract.address)).to.equal(0);
            expect(await neonToken2.connect(owner).balanceOf(owner.address)).to.equal(ethers.utils.parseUnits(String(1000)));
            expect(await neonToken2.connect(owner).balanceOf(owner.address)).to.equal(ethers.utils.parseUnits(String(1000)));
        });
    });
    describe("RESOLVER: simulate execution", function () {
        //Corrent Events
            it("DCA In/Out execution ( 1 execution )", async function () {
                const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
                const { neonToken1 } = await loadFixture(deployNeonToken1);
                await listToken(owner, contract, pool, neonToken1, neonToken1);
                const { strategy } = await strategyEnable(neonToken1);
                await neonToken1.connect(owner).transfer(addr1.address, ethers.utils.parseUnits(String(500)));

                const params = {
                    reciever: owner.address,
                    srcToken: neonToken1.address,
                    chainId: contract.deployTransaction.chainId,
                    destToken: neonToken1.address,
                    destDecimals: 18,
                    ibStrategy: ethers.constants.AddressZero,
                    srcAmount: ethers.utils.parseUnits(String(200)),
                    tau: 10,
                    reqExecution: 1,
                    nowFirstExecution: true
                };
                await createDCA(owner, contract, dca, neonToken1, params);
                await createDCA(addr1, contract, dca, neonToken1, params);
                //Check Execution needs
                expect(await contract.connect(owner).isExecutionNeeded()).to.equal(true);
                //Start Resolver
                await startupResolver(owner, contract);
                expect(await contract.connect(owner).resolverBusy()).to.equal(true);
                //Verify each positions (will be skipped already tested in NDCA)
                //Start Execution
                const ids = [1, 2];
                await contract.connect(owner).startExecution(ids);
                //End Execution
                const data = [[1, ethers.utils.parseUnits(String(200)), 69, 200], [2, ethers.utils.parseUnits(String(200)), 70, 200]];
                await contract.connect(owner).closureExecution(data);
                //Reset resolver state
                expect(await contract.connect(owner).resolverBusy()).to.equal(false);
                //DCA closed reached max execution
                expect(await contract.connect(owner).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
                expect(await contract.connect(addr1).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
            });
            it("DCA CC execution ( 1 execution )", async function () {
                const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
                const { neonToken1 } = await loadFixture(deployNeonToken1);
                await listToken(owner, contract, pool, neonToken1, neonToken1);
                await pool.connect(owner).listDestTokens([1], [neonToken1.address], [18], ["NEON"]);
                const { strategy } = await strategyEnable(neonToken1);
                await neonToken1.connect(owner).transfer(addr1.address, ethers.utils.parseUnits(String(500)));

                const params = {
                    reciever: owner.address,
                    srcToken: neonToken1.address,
                    chainId: 1,
                    destToken: neonToken1.address,
                    destDecimals: 18,
                    ibStrategy: ethers.constants.AddressZero,
                    srcAmount: ethers.utils.parseUnits(String(200)),
                    tau: 10,
                    reqExecution: 1,
                    nowFirstExecution: true
                };
                await createDCA(owner, contract, dca, neonToken1, params);
                await createDCA(addr1, contract, dca, neonToken1, params);
                //Check Execution needs
                expect(await contract.connect(owner).isExecutionNeeded()).to.equal(true);
                //Start Resolver
                await startupResolver(owner, contract);
                expect(await contract.connect(owner).resolverBusy()).to.equal(true);
                //Verify each positions (will be skipped already tested in NDCA)
                //Start Execution
                const ids = [1, 2];
                await contract.connect(owner).startExecution(ids);
                //End Execution
                const data = [[1, ethers.utils.parseUnits(String(200)), 69, 200], [2, ethers.utils.parseUnits(String(200)), 70, 200]];
                await contract.connect(owner).closureExecution(data);
                //Reset resolver state
                expect(await contract.connect(owner).resolverBusy()).to.equal(false);
                //DCA closed reached max execution
                expect(await contract.connect(owner).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
                expect(await contract.connect(addr1).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
            });
            it("DCA Ib execution ( 1 execution )", async function () {
                const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
                const { neonToken1 } = await loadFixture(deployNeonToken1);
                await listToken(owner, contract, pool, neonToken1, neonToken1);
                const { strategy } = await strategyEnable(neonToken1);
                await neonToken1.connect(owner).transfer(addr1.address, ethers.utils.parseUnits(String(500)));

                const params = {
                    reciever: owner.address,
                    srcToken: neonToken1.address,
                    chainId: contract.deployTransaction.chainId,
                    destToken: neonToken1.address,
                    destDecimals: 18,
                    ibStrategy: strategy.address,
                    srcAmount: ethers.utils.parseUnits(String(200)),
                    tau: 10,
                    reqExecution: 1,
                    nowFirstExecution: true
                };
                await createDCA(owner, contract, dca, neonToken1, params);
                await createDCA(addr1, contract, dca, neonToken1, params);
                //Check Execution needs
                expect(await contract.connect(owner).isExecutionNeeded()).to.equal(true);
                //Start Resolver
                await startupResolver(owner, contract);
                expect(await contract.connect(owner).resolverBusy()).to.equal(true);
                //Verify each positions (will be skipped already tested in NDCA)
                //Start Execution
                const ids = [1, 2];
                await contract.connect(owner).startExecution(ids);
                //Simulate Resolver Send Token to NManager
                await neonToken1.connect(owner).transfer(contract.address, ethers.utils.parseUnits(String(200)));
                //End Execution
                const data = [[1, ethers.utils.parseUnits(String(100)), 69, 200], [2, ethers.utils.parseUnits(String(100)), 70, 200]];
                await contract.connect(owner).closureExecution(data);
                //Reset resolver state
                expect(await contract.connect(owner).resolverBusy()).to.equal(false);
                //DCA closed reached max execution
                expect(await contract.connect(owner).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
                expect(await contract.connect(addr1).checkAvailability(params.srcToken, params.chainId, params.destToken, params.ibStrategy)).to.equal(true);
            });
    });
    describe("View Data USER / RESOLVER", function () {
    //Corrent Events
        it("Get User DCAs details", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            const { strategy } = await strategyEnable(neonToken1);
            await createDCA(owner, contract, dca, neonToken1, params);
            const result = await contract.connect(owner).getDetail();
            expect(result[0][0].reciever).to.equal(params.reciever);
            expect(result[0][0].srcToken).to.equal(params.srcToken);
            expect(result[0][0].chainId).to.equal(params.chainId);
            expect(result[0][0].destToken).to.equal(params.destToken);
            expect(result[0][0].ibStrategy).to.equal(params.ibStrategy);
            expect(result[0][0].srcAmount).to.equal(params.srcAmount);
            expect(result[0][0].tau).to.equal(params.tau);
            expect(result[0][0].reqExecution).to.equal(params.reqExecution);
        });
        it("Get User DCAs historian", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            const { strategy } = await strategyEnable(neonToken1);
            await createDCA(owner, contract, dca, neonToken1, params);
            await contract.connect(owner).closeDCA(params.srcToken, params.chainId, params.destToken, params.ibStrategy);
            const result = await contract.connect(owner).getHistorian();
            expect(result[0][0].srcToken).to.equal(params.srcToken);
            expect(result[0][0].chainId).to.equal(params.chainId);
            expect(result[0][0].destToken).to.equal(params.destToken);
            expect(result[0][0].ibStrategy).to.equal(params.ibStrategy);
        });
        it("Get Resolver DCAs data", async function () {
            const { contract, pool, dca, owner, addr1 } = await loadFixture(deployContract);
            const { neonToken1 } = await loadFixture(deployNeonToken1);
            const params = {
                reciever: owner.address,
                srcToken: neonToken1.address,
                chainId: contract.deployTransaction.chainId,
                destToken: neonToken1.address,
                destDecimals: 18,
                ibStrategy: ethers.constants.AddressZero,
                srcAmount: ethers.utils.parseUnits(String(200)),
                tau: 10,
                reqExecution: 1,
                nowFirstExecution: true
            };
            await listToken(owner, contract, pool, neonToken1, neonToken1);
            const { strategy } = await strategyEnable(neonToken1);
            await createDCA(owner, contract, dca, neonToken1, params);
            const result = await contract.connect(owner).getDataDCA();
            expect(result[0][0].id).to.equal(1);
            expect(result[0][0].srcToken).to.equal(params.srcToken);
            expect(result[0][0].destToken).to.equal(params.destToken);
            expect(result[0][0].ibStrategy).to.equal(params.ibStrategy);
        });
    });
});