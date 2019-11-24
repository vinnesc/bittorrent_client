"use strict";

const dgram = require("dgram");
const Buffer = require("buffer").Buffer;
const crypto = require("crypto");
const utils = require("./utils");
const url = require("url");

class TrackerClient {
  constructor(torrent, clientName, peerId) {
    const trackerUrl = url.parse(torrent.announce.toString("utf-8"));
    this.torrent = torrent;
    this.trackerUrl = trackerUrl.hostname;
    this.trackerPort = trackerUrl.port;
    this.clientName = clientName; // see: http://www.bittorrent.org/beps/bep_0020.html
    this.peerId = peerId;
    this.connected = false;
    this.currentTracker = 0;
  }

  _buildConnectRequest(connectTransactionId) {
    // See: http://www.bittorrent.org/beps/bep_0015.html
    const buffer = Buffer.alloc(16);
    const magic_h = 0x417;
    const magic_l = 0x27101980;
    const connectAction = 0x0;

    buffer.writeUInt32BE(magic_h, 0);
    buffer.writeUInt32BE(magic_l, 4);
    buffer.writeUInt32BE(connectAction, 8);
    connectTransactionId.copy(buffer, 12);

    return buffer;
  }

  _buildAnnounceRequest(announceTransactionId, connectionId) {
    // See: http://www.bittorrent.org/beps/bep_0015.html
    const buffer = Buffer.alloc(98);
    const announceAction = 0x1;
    const infoHash = utils.getInfoHash(this.torrent);
    const key = crypto.randomBytes(4);

    connectionId.copy(buffer, 0); // no point on handling big ints
    buffer.writeUInt32BE(announceAction, 8);
    announceTransactionId.copy(buffer, 12);
    infoHash.copy(buffer, 16);
    this.peerId.copy(buffer, 36);
    // big ints in javascript are just numbers with 'n' appended to them
    buffer.writeBigInt64BE(BigInt(0), 56); // downloaded
    buffer.writeBigInt64BE(utils.getTorrentSize(this.torrent), 64); // todo: left
    buffer.writeBigInt64BE(BigInt(0), 72); // uploaded
    buffer.writeUInt32BE(0, 80); // event: none
    buffer.writeUInt32BE(0, 84); // ip address: default
    key.copy(buffer, 88);
    buffer.writeInt32BE(-1, 92); // num_want: default
    buffer.writeUInt16BE(this.trackerPort, 96);

    return buffer;
  }

  _parseConnectResponse(response, connectTransactionId) {
    const serverTransactionId = response.slice(4, 8);
    if (!serverTransactionId.equals(connectTransactionId)) {
      // throw exception???
      console.log("connect server transaction id doesn't match with client's");
      console.log("received ", serverTransactionId);
      console.log("got ", connectTransactionId);
    }

    // save connection id for later
    const connectionId = response.slice(8);
    console.log("connection id ", connectionId);

    return connectionId;
  }

  _parseAnnounceResponse(response, announceTransactionId) {
    // announce response
    const serverTransactionId = response.slice(4, 8);
    if (!serverTransactionId.equals(announceTransactionId)) {
      // throw exception???
      console.log("announce server transaction id doesn't match with client's");
      console.log("received ", serverTransactionId);
      console.log("got ", announceTransactionId);
    }

    const interval = response.readUInt32BE(8);
    const leechers = response.readUInt32BE(12);
    const seeders = response.readUInt32BE(16);
    const peers = [];
    console.log("number of peers ", leechers + seeders);

    for (let i = 20; i < response.length; i += 6) {
      const ip = response.slice(i, i + 4).join(".");
      const port = response.readUInt16BE(i + 4);

      peers.push({ ip, port });
      console.log("peer ip ", ip);
      console.log("peer port ", port);
    }

    return peers;
  }

  _initSocket(callback) {
    const socket = dgram.createSocket("udp4");
    let connectTransactionId = null;
    let announceTransactionId = null;

    socket.on("error", err => {
      console.log(`socket error:\n${err.stack}`);
      this.socket.close();
    });

    connectTransactionId = this._sendConnect(socket);

    if (!this.connected) {
      setTimeout(() => {
        if (!this.connected) {
          this._tryNewTracker();
          this._initSocket(callback);
        }
      }, 3000);
    }
    // response handler
    socket.on("message", response => {
      console.log("response ", response);
      const type = response.readUInt32BE(0);
      if (type == 0x0) {
        // connect response
        if (connectTransactionId == null) {
          console.log("connect response received before connect request");
        }

        this.connected = true;
        const connectionId = this._parseConnectResponse(
          response,
          connectTransactionId
        );
        announceTransactionId = this._sendAnnounce(connectionId, socket);
      } else if (type == 0x1) {
        // announce response
        if (announceTransactionId == null) {
          console.log("announce response received before connect response");
        }
        const peers = this._parseAnnounceResponse(
          response,
          announceTransactionId
        );
        callback(peers);
      } else {
        // Unknown
      }
    });

    return socket;
  }

  _tryNewTracker() {
    if (this.connected) {
      return;
    }
    console.log("trying new tracker ");
    const list = this.torrent["announce-list"];

    if (this.currentTracker < list.length) {
      const newTrackerUrl = url.parse(
        list[this.currentTracker].toString("utf-8")
      );
      this.trackerPort = newTrackerUrl.port;
      this.trackerUrl = newTrackerUrl.hostname;

      this.currentTracker++;
    } else {
      // throw exception
    }
  }
  // we should probably fire a timeout after sending the messages to later check if we got response
  _sendAnnounce(connectionId, socket) {
    const announceTransactionId = crypto.randomBytes(4);
    const request = this._buildAnnounceRequest(
      announceTransactionId,
      connectionId
    );

    socket.send(request, this.trackerPort, this.trackerUrl);
    console.log("sent announce message");
    return announceTransactionId;
  }

  _sendConnect(socket) {
    const connectTransactionId = crypto.randomBytes(4);
    const request = this._buildConnectRequest(connectTransactionId);

    socket.send(request, this.trackerPort, this.trackerUrl);
    console.log("sent connect message");

    return connectTransactionId;
  }

  getPeers(callback) {
    this._initSocket(callback);
  }
}

module.exports = TrackerClient;
