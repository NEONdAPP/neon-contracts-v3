import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script for the NManager contract`);

  // Initialize the wallet.
  const wallet = new Wallet("PRV_KEY");

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact("NManager");

  
  const params = {
    resolver: "0xf4aa9E0c00c22908c6E2941C5d481ef85bcb0e85",
    defaultApproval: "150000000000000000000000000000",
    timeBase: 86400,
    minTau: 1,
    maxTau: 30
    }

  // Estimate contract deployment fee
  const deploymentFee = await deployer.estimateDeployFee(artifact, [params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau]);


  // Deploy this contract. The returned object will be of a `Contract` type, similarly to ones in `ethers`.
  const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
  console.log(`The deployment is estimated to cost ${parsedFee} ETH`);

  const neonContract = await deployer.deploy(artifact, [params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau]);

  //obtain the Constructor Arguments
  console.log("constructor args:" + neonContract.interface.encodeDeploy([params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau]));

  // Show the contract info.
  const contractAddress = neonContract.address;
  console.log(`${artifact.contractName} was deployed to ${contractAddress}`);

  // Verify contract programmatically 
  //
  // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
  const contractFullyQualifedName = "contracts/NManager.sol:NManager";
  const verificationId = await hre.run("verify:verify", {
    address: contractAddress,
    contract: contractFullyQualifedName,
    constructorArguments: [params.resolver, params.defaultApproval, params.timeBase, params.minTau, params.maxTau],
    bytecode: artifact.bytecode,
  });
  console.log(`${contractFullyQualifedName} verified! VerificationId: ${verificationId}`)
}
