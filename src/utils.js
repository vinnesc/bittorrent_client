"use strict";

const bencode = require("bencode");
const crypto = require("crypto");

module.exports.getInfoHash = decodedTorrent => {
  const info = bencode.encode(decodedTorrent.info);
  return crypto
    .createHash("sha1")
    .update(info)
    .digest();
};

module.exports.getPeerId = name => {
  const id = crypto.randomBytes(20);
  const nameBuffer = Buffer.from(name);
  nameBuffer.copy(id, 0);

  return id;
};

module.exports.getTorrentSize = decodedTorrent => {
  // todo: test BigInt
  let size = 0;
  if (decodedTorrent.info.files) {
    size = BigInt(
      decodedTorrent.info.files
        .map(file => file.length)
        .reduce((total, size) => total + size, 0)
    );
  } else {
    size = BigInt(decodedTorrent.info.length);
  }

  return size;
};

module.exports.isHandshake = message => {
  return (
    message.length === message.readUInt8(0) + 49 &&
    message.toString("utf8", 1) === "BitTorrent protocol"
  );
};
