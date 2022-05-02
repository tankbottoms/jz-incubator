import { promises as fs } from 'fs';
import path from 'path';

const project_name = `Juicebox Staked Governance Tokens`;
const project_symbol = `veBANA`;
const project_description = 
    `The Juicebox veBanny NFT is the Juicebox DAO's governance token, but so much more. The specific veBanny you receive is a function of how much of your Juicebox DAO tokens you have locked and for how long. Never before has how cool you are been reduced to an anthropomorphic banana. (You are welcome.) In addition to determining the future of your social life, your specific veBanny is your golden ticket into the BannyVerse, where dreams, adventure, and fruit salad, await.  https://wagmistudios.info/ is your portal, https://bannyverse.xyz is your door, only you can step through it, but don't think too hard, there are only so many AK-47s available.  Enter the Banny Quartermaster, use your veBanny to unlock powerful, fashionable, and accessorized bananas.  Choose from the shockingly vast combinations of banana characters, cock your weapons, and immortalize your Banny configuration through minting.  Leave your meatbag behind and start your true journey.  Or be uncool forever, its probably too late for you anyway.`;
const project_image_gif = `ipfs://QmNSK1RScZZNEk1m7upuXBXGxvvZuyuvJqzV5imo9d7Fes`;
const project_base_uri = `ipfs://Qmf92Xgzi8bsKARRrG6ACBxNYk6NJSRkEc2aewKdW2CKtJ/`;
const provenance = `fda87b2427b54fa172bc8a88a8dc952cb6fbfc008516c11d4d986a1eff4d8194`;
const project_max_tokens = 60;
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