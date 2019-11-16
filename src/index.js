'use strict';

const fs = require('fs');
const bencode = require('bencode');
const url = require('url');
const TrackerClient = require('./tracker_client');

const torretFileName = 'test.torrent';
const torrentFile = fs.readFileSync(torretFileName);

const parsedTorrent = bencode.decode(torrentFile);
const announceUrl = url.parse(parsedTorrent.announce.toString('utf-8'));
console.log(announceUrl);

const client = new TrackerClient(announceUrl);
client.getPeers();