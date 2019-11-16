'use strict';

const fs = require('fs');
const bencode = require('bencode');
const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const url = require('url');
const crypto = require('crypto');

function buildConnectRequest() {
    // See: http://www.bittorrent.org/beps/bep_0015.html
    const buffer = Buffer.allocUnsafe(16);
    const magic_h = 0x417;
    const magic_l = 0x27101980;
    const connectAction = 0x0;
    const transactionId = crypto.randomBytes(4);

    buffer.writeUInt32BE(magic_h, 0);
    buffer.writeUInt32BE(magic_l, 4);
    buffer.writeUInt32BE(connectAction, 8);
    transactionId.forEach((value, i, buf) => {
        buffer.writeUInt8(value, 12 + i);
    })

    // We will need the transaciton id later
    return [transactionId, buffer]; 
}

const torretFileName = 'test.torrent';
const torrentFile = fs.readFileSync(torretFileName);

const parsedTorrent = bencode.decode(torrentFile);
const announceURL = url.parse(parsedTorrent.announce.toString('utf-8'));
console.log(announceURL);

const socket = dgram.createSocket('udp4');

socket.on('error', (err) => {
    console.log(`socket error:\n${err.stack}`);
    socket.close();
})

socket.on('message', (msg) => {
    console.log('message received ', msg);
});

const [transactionId, payload] = buildConnectRequest();
console.log(transactionId);
console.log(payload);
socket.send(payload, announceURL.port, announceURL.hostname);