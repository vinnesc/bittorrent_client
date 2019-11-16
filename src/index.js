'use strict';

const fs = require('fs');
const bencode = require('bencode');
const url = require('url');
const TrackerClient = require('./tracker_client');

const torretFileName = 'test.torrent';
const torrent = fs.readFileSync(torretFileName);

const parsedTorrent = bencode.decode(torrent);
const announceUrl = url.parse(parsedTorrent.announce.toString('utf-8'));
console.log(parsedTorrent);

const client = new TrackerClient(torrent, announceUrl.hostname, announceUrl.host);
client.getPeers();