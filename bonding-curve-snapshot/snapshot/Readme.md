# gnosis-contribution-snapshot

Extract transactions sent to a Gnosis Safe.

> Snapshots ETH contributions to a Gnosis Safe

## Environment variables


```sh
NODE_ENV=development
# Infura Provider
PROVIDER_ENDPOINT=
SAFE_ADDRESS=
SAFE_DEPLOYED_IN_BLOCK=13724221
AUCTION_ENDED_IN_BLOCK=13770208
MERKLE_DISTRIBUTOR=false
```

## Build, Run

To extract contribution transfer amounts for an auction which will distribute the contributions on a pro-rate basis, then increasing the `BLOCK_PER_CHUNK` to a larger value like 100 will speed up the extraction. However, for distributions where block number or order is important, such as a bonding curve, then set the `BLOCK_PER_CHUNK` to 1.

```
git clone https://github.com/atsignhandle/gnosis-safe-contribution-snapshot
yarn install && yarn build
yarn run start
```

Or during development or edits.

```sh
ts-node ./node_modules/.bin/ts-node ./src/index.ts
```

## Development

In addition to the safe environment variables, a `daemon.ts` file which reads each block from a starting position to the current position and extracts `Transfer` events.

```sh
ts-node ./src/daemon.ts
```

### Example output

```sh
{
  NODE_ENV: 'development',
  VERBOSITY: true,
  PROVIDER_ENDPOINT: 'https://mainnet.infura.io/v3/',
  SAFE_ADDRESS: '',
  SAFE_DEPLOYED_IN_BLOCK: 13724221,
  AUCTION_ENDED_IN_BLOCK: 13770208,
  BLOCKS_PER_CHUNK: 1,
  SNAPSHOT_FILENAME: 'snapshot.csv',
  NEXT_BLOCK_INFO: 'next.json',
  MERKLE_DISTRIBUTOR: false
}
[info][20211210-21450512] development, 0x6b175474e89094c44da98b954eedeac495271d0f, 9360414
[info][20211210-21450512] development and testing used DAI addresses, deployed version to use address of interest and block range of interest
[info][20211210-21450513] with the final or current block watched
[info][20211210-21450513] parse the output and serialize, so that it can be looked up by another process
[info][20211210-21450513] connected to:https://mainnet.infura.io/v3/b4d27f8892f744e586e57ec09fedae38, network:{"_isProvider":true,"_events":[],"_emitted":{"block":-2},"formatter":{"formats":{"transaction":{},"transactionRequest":{},"receiptLog":{},"receipt":{},"block":{},"blockWithTransactions":{},"filter":{},"filterLog":{}}},"anyNetwork":false,"_networkPromise":{},"_maxInternalBlockNumber":-1024,"_lastBlockNumber":-2,"_pollingInterval":4000,"_fastQueryDate":0,"connection":{"url":"https://mainnet.infura.io/v3/b4d27f8892f744e586e57ec09fedae38"},"_nextId":42}
[info][20211210-21450605] current block number 13782076
[info][20211210-21450605] searching blocks 9360414 through 13782076 for event Transfer(address indexed src, address indexed dst, uint val)
[info][20211210-21450631] current gas price 0.000000047577364188
[info][20211210-21450695] (9360414), 40.536692599705728738 ETH, 0x0000000000000000000000000000000000000000,0x2a9588489F1EAD78AcD7158Ca88c25aB301fa996,40536692599705728738, Transfer(address,address,uint256)
[info][20211210-21450695] (9360414), 10.0 ETH, 0x09475262c6a1ffBeDd480d2a15f35F978AaaAc38,0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958,10000000000000000000, Transfer(address,address,uint256)
[info][20211210-21450695] (9360414), 10.0 ETH, 0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958,0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,10000000000000000000, Transfer(address,address,uint256)
[info][20211210-21450695] (9360414), 10.0 ETH, 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,0x0000000000000000000000000000000000000000,10000000000000000000, Transfer(address,address,uint256)
[info][20211210-21451240] (9360420), 193.386752862851864156 ETH, 0x2a9588489F1EAD78AcD7158Ca88c25aB301fa996,0x65bF64Ff5f51272f729BDcD7AcFB00677ced86Cd,193386752862851864156, Transfer(address,address,uint256)
[info][20211210-21451240] (9360420), 193.386752862851864156 ETH, 0x65bF64Ff5f51272f729BDcD7AcFB00677ced86Cd,0x63825c174ab367968EC60f061753D3bbD36A0D8F,193386752862851864156, Transfer(address,address,uint256)
```

### Notes

- not perfectly solid-state. If it crashes, run it from the beginning.
- snapshot.csv is exported by default
- snapshot.json is exported if you set the env MERKLE_DISTRIBUTOR_EXPORT to true

