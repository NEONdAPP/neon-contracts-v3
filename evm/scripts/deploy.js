async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const params = {
      resolver: "0xc341B6b1C2A2017AFD9686aA879FfFE84E21d8eD",
      defaultApproval: 1500000000, //"1.500.000.000"
      timeBase: 86400,
      minTau: 1,
      maxTau: 30
  }

  const contractFactory = await ethers.getContractFactory("NCore");
  const contract = await contractFactory.deploy(params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau);

  console.log("NCore address:", contract.address);
  console.log("NDCA address:", await contract.DCA());
  console.log("NPairs address:", await contract.POOL());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
