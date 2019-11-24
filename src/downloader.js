"use strict";

const net = require("net");
const Buffer = require("buffer").Buffer;
const utils = require("./utils");
const Pieces = require("./pieces");
const Tracker = require("./tracker_client");

// peers is an array of objects with ip and port
module.exports = torrent => {
  const clientName = "-VC0001-";
  const peerId = utils.getPeerId(clientName);
  const tracker = new Tracker(torrent, clientName, peerId);

  tracker.getPeers(peers => {
    const pieces = new Pieces(torrent.info.pieces.length / 20); // 20 bytes hashes
    peers.forEach(peer => {
      download(torrent, peerId, peer);
    });
  });
};

function buildHandshake(torrent, peerId) {
  console.log("build handshake");
  // see https://wiki.theory.org/index.php/BitTorrentSpecification#Handshake
  const buffer = Buffer.alloc(68);
  const protocol = "BitTorrent protocol";
  const infoHash = utils.getInfoHash(torrent);

  let offset = 0;
  buffer.writeUIntBE(19, offset, 1); //pstrlen
  offset += 1;
  buffer.write(protocol, offset, "utf-8"); //pstr
  offset += protocol.length;
  buffer.writeBigInt64BE(BigInt(0), offset); //reserved
  offset += 8;
  infoHash.copy(buffer, offset);
  offset += infoHash.length;
  peerId.copy(buffer, offset);

  return buffer;
}

function buildKeepAlive() {
  return Buffer.alloc(4);
}

/*
  Every message that follows starts with lenght and id.
*/

function buildChoke() {
  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(0, 4);

  return buffer;
}

function buildUnchoke() {
  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(1, 4);

  return buffer;
}

function buildInterested() {
  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(2, 4);

  return buffer;
}

function buildUninterested() {
  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(3, 4);

  return buffer;
}

function buildHave(piece) {
  const buffer = Buffer.alloc(9);

  buffer.writeUInt32BE(5, 0);
  buffer.writeUInt8(4, 4);
  buffer.writeUInt32BE(piece, 5); //piece index

  return buffer;
}

function buildBitfield(piece, bitfield) {
  const buffer = Buffer.alloc(14);

  buffer.writeUInt32BE(piece.length + 1, 0);
  buffer.writeUInt8(5, 4);

  bitfield.copy(buffer, 5);
  return buffer;
}

function buildRequest(piece) {
  const buffer = Buffer.alloc(17);

  buffer.writeUInt32BE(13, 0);
  buffer.writeUInt8(6, 4);

  buffer.writeUInt32BE(piece.index, 5);
  buffer.writeUInt32BE(piece.begin, 9);
  buffer.writeUInt32BE(piece.length, 13);
  return buffer;
}

function buildPiece(piece) {
  const buffer = Buffer.alloc(piece.block.length + 13);

  buffer.writeUInt32BE(piece.block.length + 9, 0);
  buffer.writeUInt8(7, 4);
  buffer.writeUInt32BE(piece.index, 5);
  buffer.writeUInt32BE(piece.begin, 9);
  piece.block.copy(buffer, 13);

  return buffer;
}

function buildCancel(piece) {
  const buffer = Buffer.alloc(17);

  buffer.writeUInt32BE(13, 0);
  buffer.writeUInt8(8, 4);
  buffer.writeUInt32BE(piece.index, 5);
  buffer.writeUInt32BE(piece.begin, 9);
  buffer.writeUInt32BE(piece.length, 13);

  return buffer;
}

function buildPort(port) {
  const buffer = Buffer.alloc(7);

  buffer.writeUInt32BE(3, 0);
  buffer.writeUInt8(9, 4);
  buffer.writeUInt16BE(port, 5);

  return buffer;
}

function getMessageLength(handshake, buffer) {
  // if this is the first message it will be the handshake so length + 49,
  // otherwise just get the length field
  return handshake ? buffer.readUInt8(0) + 49 : buffer.readInt32BE(0) + 4;
}

function bufferPackets(socket, callback) {
  let buffer = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", data => {
    buffer = Buffer.concat([buffer, data]);

    while (
      buffer.length >= 4 &&
      buffer.length >= getMessageLength(handshake, buffer)
    ) {
      callback(buffer.slice(0, getMessageLength(handshake, buffer)));
      buffer = buffer.slice(getMessageLength(handshake, buffer));
      handshake = false;
    }
  });
}

function messageHandler(message, socket, requestedPieces, queue) {
  if (utils.isHandshake(message)) {
    const interested = buildInterested();
    socket.write(interested);
  } else {
    const parsedMessage = parseMessage(message);

    switch (parsedMessage.id) {
      case 0: {
        //choke
        socket.end();
        break;
      }
      case 1: {
        //unchoke
        queue.chocked = false;
        askForPiece(socket, requestedPieces, queue);
        break;
      }
      case 4: {
        // have
        const index = message.readUInt32BE(0);
        queue.push(index);

        if (queue.length == 1) {
          askForPiece(socket, requestedPieces, queue);
        }
        if (!requestedPieces[index]) {
          socket.write(message.buildRequest());
        }
        requestedPieces[index] = true;
        break;
      }
      case 5: {
        break;
      }
      case 7: {
        // piece
        queue.shift();
        askForPiece(socket, requestedPieces, queue);
        break;
      }
    }
  }
}

function askForPiece(socket, requestedPieces, queue) {
  if (queue.choked) {
    return null;
  }

  while (queue.queue.length) {
    const pieceIndex = queue.shift();
    if (requestedPieces.needed(pieceIndex)) {
      socket.write(message.buildRequest(pieceIndex));
      requestedPieces.addRequested(pieceIndex);
      break;
    }
  }
}

function parseMessage(message) {
  // if length < 4 then it's keep-ahead
  const id = message.length > 4 ? message.readInt8(4) : null;
  // if length < 5 there's no payload
  let payload = message.length > 5 ? message.slice(5) : null;

  if (id === 6 || id === 7 || id === 8) {
    const rest = payload.slice(8);
    payload = {
      index: payload.readInt32BE(0),
      begin: payload.readInt32BE(4)
    };
    payload[id === 7 ? "block" : "length"] = rest;
  }

  return {
    size: message.readInt32BE(0),
    id: id,
    payload: payload
  };
}

function download(torrent, peerId, peer, requestedPieces) {
  const socket = net.connect(peer.port, peer.ip, () => {
    const handshake = buildHandshake(torrent, peerId);
    socket.write(handshake);
  });

  socket.on("error", err => {
    console.log(err);
    socket.end();
  });

  const queue = { chocked: true, queue: [] };
  bufferPackets(socket, message =>
    messageHandler(message, socket, requestedPieces, queue)
  );
}
