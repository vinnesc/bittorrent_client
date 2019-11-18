'use strict';

const fs = require('fs');
const bencode = require('bencode');
const url = require('url');
const TrackerClient = require('./tracker_client');

const torretFileName = 'test.torrent';
const torrent = fs.readFileSync(torretFileName);

const parsedTorrent = bencode.decode(torrent);
console.log(parsedTorrent);
const announceUrl = url.parse(parsedTorrent.announce.toString('utf-8'));

const client = new TrackerClient(parsedTorrent, announceUrl.hostname, announceUrl.port);
client.getPeers((peers) => {console.log(peers)});