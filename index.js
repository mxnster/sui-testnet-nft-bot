import { Ed25519Keypair, JsonRpcProvider, RawSigner } from '@mysten/sui.js';
import bip39 from 'bip39'
import axios from 'axios'
import HttpsProxyAgent from 'https-proxy-agent';
import fs from 'fs';
import consoleStamp from 'console-stamp';

consoleStamp(console, { format: ':date(HH:MM:ss)' });

const timeout = ms => new Promise(res => setTimeout(res, ms))
const provider = new JsonRpcProvider('https://fullnode.testnet.sui.io')

const nftArray = [[
    'Example NFT',
    'An NFT created by Sui Wallet',
    'ipfs://QmZPWWy5Si54R3d26toaqRiqvCH7HkGdXkxwUgCm2oKKM2?filename=img-sq-01.png',
], [
    'Example NFT',
    'An NFT created by the wallet Command Line Tool',
    'ipfs://bafkreibngqhl3gaa7daob4i2vccziay2jjlp435cf66vhono7nrvww53ty',
], [
    'Wizard Land',
    'Expanding The Magic Land',
    'https://gateway.pinata.cloud/ipfs/QmYfw8RbtdjPAF3LrC6S3wGVwWgn6QKq4LGS4HFS55adU2?w=800&h=450&c=crop',
]]

function parseFile(file) {
    let data = fs.readFileSync(file, "utf8");
    let array = data.split('\n').map(str => str.trim()).filter(str => str.length > 3);

    return array.map(proxy => ({ "ip": `http://${proxy.split("@")[1]}@${proxy.split("@")[0]}`, "limited": false }))
}

function saveMnemonic(mnemonic) {
    fs.appendFileSync("mnemonic.txt", `${mnemonic}\n`, "utf8");
}

async function requestSuiFromFaucet(proxy, recipient) {
    console.log(`Requesting sui from faucet with proxy ${proxy.ip.split("@")[1]}`);
    const axiosInstance = axios.create({ httpsAgent: HttpsProxyAgent(proxy.ip) })

    let res = await axiosInstance("https://faucet.testnet.sui.io/gas", {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
            FixedAmountRequest: { recipient },
        }),
        method: "POST"
    }).catch(err => {
        console.log('Faucet error:', err?.response?.statusText)

        if (err?.response?.status == 429) {
            proxy.limited = true;
        }
    })

    console.log(`Faucet request status: ${res?.statusText}`);
    
    return res?.data
}

async function mintNft(signer, args) {
    console.log(`Minting: ${args[1]}`);

    return await signer.executeMoveCall({
        packageObjectId: '0x2',
        module: 'devnet_nft',
        function: 'mint',
        typeArguments: [],
        arguments: args,
        gasBudget: 10000,
    })
}


(async () => {
    let proxyList = parseFile('proxy.txt');

    while (proxyList.every(proxy => !proxy.limited)) {
        for (let i = 0; i < proxyList.length; i++) {
            try {
                const mnemonic = bip39.generateMnemonic()

                const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
                const address = keypair.getPublicKey().toSuiAddress()
                console.log(`Sui Address: 0x${address}`)

                let response = await requestSuiFromFaucet(proxyList[i], address)

                if (response) {
                    console.log(`Mnemonic: ${mnemonic}`);
                    saveMnemonic(mnemonic);
                    const signer = new RawSigner(keypair, provider);

                    for (let i = 0; i < nftArray.length; i++) {
                        await mintNft(signer, nftArray[i])
                    }

                    console.log(`Result: https://explorer.sui.io/addresses/${address}?network=testnet`);
                }
                console.log("-".repeat(100));
            } catch (err) {
                console.log(err.message);
                await timeout(10000)
            }
        }
    }
})()