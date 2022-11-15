# sui-testnet-nft-bot

This script allows you to mint SUI testnet NFTs 

## Algoritm
1) Generating account
2) Requesting Sui from faucet (rate limited)
3) Minting testnet NFTs
4) Logging link to explorer with minted NFTs


## Requeremets
<b>To run this bot you need to have pool of proxies.</b>

Mnemonics from generated accounts will be saved to file `mnemonic.txt`

## Setup bot
1) Download ZIP and extract it to a folder
2) Install node.js: `https://nodejs.org/en/` (LTS)
3) Paste your proxies in `proxy.txt` (ip:port@login:password), each proxy on a new line
4) Open folder with the bot in `cmd`
```bash
cd <path to folder with script>
```
5) Install dependencies
```bash
npm install
```
6) Start
```bash
node index
```
