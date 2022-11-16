import { Ed25519Keypair, JsonRpcProvider, RawSigner } from '@mysten/sui.js';
import bip39 from 'bip39'
import axios from 'axios'
import https from 'https';
import fs from 'fs';
import consoleStamp from 'console-stamp';
import { exit } from 'process';

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

function parseFile() { // parse proxy list from file, with regex
    const proxyFile = fs.readFileSync('proxy.txt', 'utf8');
    // regular expression to match ip:port@username:password
    const proxyRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})@(\w+):(\w+)/g;
    const proxies = [];

    let match;
    while ((match = proxyRegex.exec(proxyFile)) !== null) {
        // write the match to the proxies array ip:port@username:password and limited/auth failed
        proxies.push({
            full: match[3] + ':' + match[4] + '@' + match[1] + ':' + match[2],
            ip: match[1],
            port: match[2],
            username: match[3],
            password: match[4],
            limited: false,
            authFailed: false,
        });
    }
    // example object:
    /*
        [{
            ip: string,
            port: string,
            username: string,
            password: string,
            limited: bool,
            authFailed: bool
        }]
    */
    return proxies;
}

async function checkProxy(proxy) {
    let checkedProxy = proxy.map(async (proxy) => {
        await axios.get("https://api64.ipify.org/?format=json", {
            proxy: {                                                        // provide proxy
                host: proxy.ip,
                port: proxy.port,
                auth: {
                    username: proxy.username,
                    password: proxy.password
                },
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false                                   // ignore self-signed certificate
            }),
            rejectUnauthorized: false,
            timeout: 5000,                                                  // timeout after 5 seconds
        }).then(res => {
            return proxy;
        }).catch(err => {
            console.log('Proxy check error:', err?.response?.statusText)
            switch (err?.response?.status) {
                case 407: proxy.authFailed = true;
                case 429: proxy.limited = true;
            }
            return proxy;
        });
    });

    checkedProxy = await Promise.all(checkedProxy);
    return proxy.filter((proxy) => !proxy.limited && !proxy.authFailed);
}

function saveMnemonic(mnemonic) {
    fs.appendFileSync("mnemonic.txt", `${mnemonic}\n`, "utf8");
}

async function requestSuiFromFaucet(proxy, recipient) {
    console.log(`Requesting sui from faucet with proxy ${proxy.ip}`);

    let res = await axios.post("https://faucet.testnet.sui.io/gas", {
        proxy: {                                                        // provide proxy
            host: proxy.ip,
            port: proxy.port,
            auth: {
                username: proxy.username,
                password: proxy.password
            },
        },
        httpsAgent: new https.Agent({
            rejectUnauthorized: false                                   // ignore self-signed certificate
        }),
        rejectUnauthorized: false,
        timeout: 5000,                                                  // timeout after 5 seconds
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
            FixedAmountRequest: { recipient },
        }),
        method: "POST",
    }).catch(err => {
        console.log('Faucet error:', err?.response?.statusText)

        switch (err?.response?.status) {
            case 407: proxy.authFailed = true;
            case 429: proxy.limited = true;
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
    let proxyList = await checkProxy(parseFile()); // got proxy list that is not limited or auth failed
    if (proxyList.length === 0) {
        console.log('No working proxies found');
        exit();
    }

    while (proxyList.every(proxy => !proxy.limited)) {
        for (let i = 0; i < proxyList.length; i++) {
            if (proxyList[i].limited) continue; // skip limited proxy
            try {
                const mnemonic = bip39.generateMnemonic()

                console.log(`Mnemonic: ${mnemonic}`);
                saveMnemonic(mnemonic);

                const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
                const address = keypair.getPublicKey().toSuiAddress()
                console.log(`Sui Address: 0x${address}`)

                let response = await requestSuiFromFaucet(proxyList[i], address)

                if (response) {
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