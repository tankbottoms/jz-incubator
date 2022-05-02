import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory, Transaction, utils } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';

const project_name = `Juicebox DAO's Commemorative FC17 Banny Collection`;
const project_symbol = `BANA`;
const project_description = 
    `Juicebox is celebrating the successful completion of its 17th Governance Cycle, which ended on March 5th, 2022. To mark this special occasion, a commemorative Banny NFT was painstakingly crafted, and if you are reading this, subsequently airdropped to a worthy wallet. You are welcome. 

The Juicebox DAO custodians presented and subsequently ratified proposals in furtherance of their core values and mission; notable decisions included the approval of an airdrop of the DAO's token stash to a swath of active members, expanding the fat treasury's Gnosis multsigners to fourteen (14) rad Ledger-wielding volunteers, reducing the protocol fee from five percent (5%) to two point five percent (2.5%), adding vibe-setting contributors as recurring Ethereum paid contributors, and so much more, see the Juicebox's Snapshot at https://snapshot.org/#/jbdao.eth and proposals JBP-115 through JBP-126.  

About Juicebox DAO, WAGMI Studios and Banny.  

Juicebox DAO (https://juicebox.money) is a programmable treasury for community-owned Ethereum projects. 

WAGMI Studios (https://wagmistudios.xyz, http://wagmistudios.info/) is a collective of quirky creatives making sure "we're all gonna make it" and the home of Banny, our banana and savior.  

Banny is an anthropomorphic banana, who provides visual aesthetics to all things Juicebox including its website and documentation.  Banny enjoys hash hot knifing, helping people and projects understand the Juicebox protocol, and dressing up in our favorite characters including copyrighted characters from Marvel.  Banny has an affinity for wielding unusually aggressive weapons such as a live shark, an AK-47 and a Hattori Hanzo sword.  Banny is also the protagonist in the epic fruit salad saga, the BannyVerse, an adventure mystery pay-to-have, play-to-earn, have-to-enjoy status-symbol-utility-art-jpeg masquerading as unapproachable, Web3, hard-core art with IRL finanacial FOMO-inducing consequences.
`;
const project_image_gif = 'ipfs://QmP5S2TXzs8mjqEkwfRQ2ZPmT4UDKUKcDWtpsb2DFGc8Cg';
const project_base_uri = `ipfs://QmQ27q66UqqYp16b1yn5k72txtyy9m1CBGbw7a7shuLFBZ/`;
const provenance = `7bc3747f6058515690c3acc78b7c6e04ea89802b023a156985eadd0c0dae32c1`;
const project_max_tokens = 75;
const project_start_sale = 1;
const project_external_url = `https://wagmistudios.xyz`;
const project_seller_fee_basis_points = 5000;
const project_fee_recipient = `0x6a67c678eFb4a61635fFBaEbcD38B3370009592f`;
// const project_fee_recipient_ens = `.eth`;

export const project_config = {
    tokenName: project_name,
    tokenSymbol: project_symbol,
    baseURI: project_base_uri,
    maxTokens: project_max_tokens,
    startSale: project_start_sale,
};

export const opensea_storefront = {
    name: project_name,
    description: project_description,
    image: project_image_gif,
    external_link: project_external_url,
    seller_fee_basis_points: project_seller_fee_basis_points,
    fee_recipient: project_fee_recipient,
}

false && console.log(project_config);

(async () => {
    console.log('writing opensea.json...');
    await fs.writeFile(path.join(__dirname, './opensea.json'), JSON.stringify({
        name: project_name,
        description: project_description,
        image: project_image_gif,
        external_link: project_external_url,
        seller_fee_basis_points: project_seller_fee_basis_points,
        fee_recipient: project_fee_recipient,
        discord: "https://discord.gg/juicebox",
        twitter: "https://twitter.com/juiceboxETH"
    }, null, '  '));
})();