"use strict";

const download = require("./downloader");
const utils = require("./utils");
const parser = require("./parser");

const torretFileName = "test_2.torrent";

/* Move parsing logic somewhere else */
const torrent = parser.open(torretFileName);

download(torrent);
