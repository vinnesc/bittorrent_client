"use strict";

const fs = require("fs");
const net = require("net");
const Buffer = require("buffer").Buffer;
const utils = require("./utils");
const Tracker = require("./tracker_client");
const Pieces = require("./pieces");
const Queue = require("./queue");

module.exports = (torrent, path) => {
  const clientName = "-VC0001-";
  const peerId = utils.getPeerId(clientName);
  const tracker = new Tracker(torrent, clientName, peerId);

  tracker.getPeers(peers => {
    const pieces = new Pieces(torrent);
    const file = fs.openSync(path, "w");

    peers.forEach(peer => {
      download(torrent, peerId, peer, pieces, file);
    });
  });
};

function buildHandshake(torrent, peerId) {
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

/*
  Every message that follows starts with lenght and id.
*/

function buildInterested() {
  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(2, 4);

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

function messageHandler(
  message,
  socket,
  requestedPieces,
  queue,
  torrent,
  file
) {
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
        const pieceIndex = parsedMessage.payload.readUInt32BE(0);
        const queueEmpty = queue.length() === 0;
        queue.queue(pieceIndex);
        if (queueEmpty) {
          askForPiece(socket, requestedPieces, queue);
        }
        break;
      }
      case 5: {
        // bitfield
        const queueEmpty = queue.length() === 0;
        parsedMessage.payload.forEach((byte, i) => {
          for (let j = 0; j < 8; j++) {
            if (byte % 2) queue.queue(i * 8 + 7 - j);
            byte = Math.floor(byte / 2);
          }
        });
        if (queueEmpty) {
          askForPiece(socket, requestedPieces, queue);
        }
        break;
      }
      case 7: {
        // piece
        requestedPieces.printPercentDone();
        requestedPieces.addReceived(parsedMessage.payload);

        const offset =
          parsedMessage.payload.index * torrent.info["piece length"] +
          parsedMessage.payload.begin;
        fs.write(
          file,
          parsedMessage.payload.block,
          0,
          parsedMessage.payload.block.length,
          offset,
          () => {}
        );

        if (requestedPieces.isDone()) {
          socket.end();
          console.log("DONE!");
          try {
            fs.closeSync(file);
          } catch (e) {}
        } else {
          askForPiece(socket, requestedPieces, queue);
        }
        break;
      }
    }
  }
}

function askForPiece(socket, requestedPieces, queue) {
  if (queue.choked) {
    return null;
  }

  while (queue.length()) {
    const pieceBlock = queue.deque();
    if (requestedPieces.needed(pieceBlock)) {
      socket.write(buildRequest(pieceBlock));
      requestedPieces.addRequested(pieceBlock);
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

function download(torrent, peerId, peer, requestedPieces, file) {
  const socket = net.connect(peer.port, peer.ip, () => {
    const handshake = buildHandshake(torrent, peerId);
    socket.write(handshake);
  });

  socket.on("error", err => {
    socket.end();
  });

  const queue = new Queue(torrent);
  bufferPackets(socket, message =>
    messageHandler(message, socket, requestedPieces, queue, torrent, file)
  );
}
