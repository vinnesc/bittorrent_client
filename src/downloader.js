'use strict';

const net = require('net');
const Buffer = require('buffer').Buffer;
const utils = require('./utils');

// peers is an array of objects with ip and port
module.exports = (torrent, peerId, peers) => {
    peers.map((peer) => {
        download(torrent, peerId, peer);
    });
}

function buildHandshake(torrent, peerId) {
    // see https://wiki.theory.org/index.php/BitTorrentSpecification#Handshake
    const buffer = Buffer.alloc(68);
    const protocol = 'BitTorrent protocol';
    const infoHash = utils.getInfoHash(torrent);
    let offset = 0;

    buffer.writeUIntBE(19, offset); //pstrlen
    offset += 1;
    buffer.write(protocol, offset, 'utf-8'); //pstr
    offset += protocol.length;
    buffer.writeBigInt64BE(BigInt(0), offset); //reserved
    offset += 8;
    infoHash.copy(buffer, offset);
    offset += infoHash.length;
    peerId.copy(buffer, offset);

    return buffer;
}

function download(torrent, peerId, peer) {
    const socket = net.connect(peer.port, peer.ip, () => {
        const handshake = buildHandshake(torrent, peerId);
        socket.write(handshake);
        console.log('connected');
    });

    socket.on('error', (err) => {
        console.log(err);
        socket.end()
    });

    socket.on('data', (data) => {
        console.log(data);
    });

}