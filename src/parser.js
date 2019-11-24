"use strict";

const fs = require("fs");
const bencode = require("bencode");
const utils = require("./utils");

module.exports.BLOCK_LEN = Math.pow(2, 14);

module.exports.open = filepath => {
  return bencode.decode(fs.readFileSync(filepath));
};

module.exports.pieceLen = (torrent, pieceIndex) => {
  const totalLength = Number(BigInt(utils.getTorrentSize(torrent)));
  const pieceLength = Number(BigInt(torrent.info["piece length"]));

  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = Math.floor(totalLength / pieceLength);

  return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength;
};

module.exports.blocksPerPiece = (torrent, pieceIndex) => {
  const pieceLength = this.pieceLen(torrent, pieceIndex);
  return Math.ceil(pieceLength / this.BLOCK_LEN);
};

module.exports.blockLen = (torrent, pieceIndex, blockIndex) => {
  const pieceLength = this.pieceLen(torrent, pieceIndex);

  const lastPieceLength = pieceLength % this.BLOCK_LEN;
  const lastPieceIndex = Math.floor(pieceLength / this.BLOCK_LEN);

  return blockIndex === lastPieceIndex ? lastPieceLength : this.BLOCK_LEN;
};
