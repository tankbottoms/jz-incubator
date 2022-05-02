import { ethers } from 'hardhat';
import { createAlchemyWeb3 } from "@alch/alchemy-web3";

const nft_to_addresses = [
`0x07526014841efE42A563EFCd497Ab86346ABd9d2`,
];

const mape_transfer = `erc721,0xdd407a053fa45172079916431d06E8e07f655042,`;

(async () => {
    const mapes = `0xdd407a053fa45172079916431d06E8e07f655042`;
    const web3 = createAlchemyWeb3(
    `https://eth-mainnet.g.alchemy.com/v2/kiaHfA88GhCn8XkX9ILDmNGp2L30hLs6`,
    );

    const ownerAddr = "0x2187e6a7c765777d50213346F0Fe519fCA706fbD"; // gnosis developer safe
    const balances = await web3.alchemy.getTokenBalances(ownerAddr,[mapes])
    if (balances){
        false && console.log(balances);
        const floor_token_id = 300;
        const nfts = await web3.alchemy.getNfts({owner: ownerAddr})
        console.log(`${nfts.totalCount} total nfts found`);
        let undefined_count = 0;
        let line_count = 0;
        if (nfts){
            const { ownedNfts } = nfts;
            console.log(`returning ${ownedNfts.length} tokenIds for ${mapes}`);                        
            for (let i = 0; i< ownedNfts.length; i++){                
                const nft = Object.values(ownedNfts[i]);
                const { address } = nft[0];
                const { tokenId } = nft[1];
                const balance = nft[2];                
                false && console.log(`${mapes} == ${address}`, `${mapes}` == `${address}`);
                const token_id = ethers.BigNumber.from(tokenId.toString());
                if (Number(token_id) > floor_token_id){
                    false && console.log(`${ethers.BigNumber.from(tokenId.toString())}`);                
                    if (nft_to_addresses[i] == undefined){
                        undefined_count++;
                        break;
                        console.warn(`${undefined_count} => ${token_id}`);
                    } else {
                        line_count++;
                        false && console.log(`(${line_count})${nft_to_addresses[i]}${token_id}`);
                        console.log(`${mape_transfer}${nft_to_addresses[i]}` + `,,` + `${token_id}`);
                    }                    
                }
            }

        }
    }    
})();
