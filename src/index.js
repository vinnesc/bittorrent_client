'use strict';

const fs = require('fs');
const bencode = require('bencode');

const torret_file_name = 'test.torrent';
const torrent_file = fs.readFileSync(torret_file_name);

const parsed_torrent = bencode.decode(torrent_file, 'utf-8');

console.log(parsed_torrent);