import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { Signers } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { SevenTwentyOne } from "../typechain/SeventyTwentyOne"
import { shouldBehaveLikeTokens } from "./Tokens.behavior";
import { project_config } from '../scripts/0_config';

const { deployContract } = hre.waffle;

describe("Setup Admin and Unnamed Accounts", function () {
    before(async function () {
        this.signers = {} as Signers;
        const signers: SignerWithAddress[] = await hre.ethers.getSigners();
        this.signers.admin = signers[0];
        this.unnamedAccounts = [] as Signers[];
        for (let i = 1; i <= (signers.length - 1); i++) {
            const unnamedAccount: SignerWithAddress = signers[i];
            this.unnamedAccounts.push(unnamedAccount);
        }
    });

    describe("Creating Contract", function () {
        before(async function () {
            
            const TokensArtifact: Artifact = await hre.artifacts.readArtifact("SevenTwentyOne");
            const { tokenName, tokenSymbol, baseURI, maxTokens, startSale } = project_config;
            this.Tokens = <TokensArtifact>await deployContract(
                this.signers.admin, 
                TokensArtifact, 
                [tokenName, tokenSymbol, baseURI, maxTokens, startSale]
                ); 
            console.log(`Deployed Tokens to the following address => ${this.Tokens.address}`);
            console.log(`Token name:${tokenName} (${tokenSymbol})`);
            console.log(`Max tokens:${maxTokens}, startSale:${startSale}`);            
            
        });
                
        shouldBehaveLikeTokens();
    });
});
