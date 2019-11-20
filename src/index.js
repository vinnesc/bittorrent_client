'use strict';

const fs = require('fs');
const bencode = require('bencode');
const url = require('url');
const TrackerClient = require('./tracker_client');
const download = require('./downloader')
const utils = require('./utils');

const torretFileName = 'test.torrent';
const torrent = fs.readFileSync(torretFileName);

/* Move parsing logic somewhere else */
const decodedTorrent = bencode.decode(torrent);
console.log(decodedTorrent);
const announceUrl = url.parse(decodedTorrent.announce.toString('utf-8'));

const clientName = '-VC0001-';
const peerId = utils.getPeerId(clientName);
const client = new TrackerClient(decodedTorrent, announceUrl, clientName, peerId);

client.getPeers((peers) => {
    download(decodedTorrent, peerId, peers);
});