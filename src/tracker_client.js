const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const crypto = require('crypto');
const bencode = require('bencode');

class TrackerClient {
    constructor(torrent, trackerUrl, trackerPort) {
        this.torrent = torrent;
        this.trackerUrl = trackerUrl;
        this.trackerPort = trackerPort;
        this.clientName = '-VC0001-'; //vinny client version 0001 see: http://www.bittorrent.org/beps/bep_0020.html
        this.socket = null;
        this.transactionId = null;
        this.connectionId = null;
        this.peerId = null;
    }

    // move this somewhere else??
    _infoHash() {
        const info = bencode.encode(bencode.decode(this.torrent).info); //todo: change this
        
        return crypto.createHash('sha1').update(info).digest();
    }

    // move this too??
    _getPeerId() {
        if (this.peerId == null) {
            const id = crypto.randomBytes(20);
            const name = Buffer.from(this.clientName);
            name.copy(id, 0);
            
            this.peerId = id;
        }
        
        return this.peerId;
    }

    _buildConnectRequest() {
        // See: http://www.bittorrent.org/beps/bep_0015.html
        const buffer = Buffer.allocUnsafe(16);
        const magic_h = 0x417;
        const magic_l = 0x27101980;
        const connectAction = 0x0;
        const transactionId = crypto.randomBytes(4);
        this.transactionId = transactionId.readUInt32BE(0); // this will override old id, i guess it doesn't matter??
    
        buffer.writeUInt32BE(magic_h, 0);
        buffer.writeUInt32BE(magic_l, 4);
        buffer.writeUInt32BE(connectAction, 8);
        transactionId.copy(buffer, 12);
    
        return buffer; 
    }

    _buildAnnounceRequest() {
        // See: http://www.bittorrent.org/beps/bep_0015.html
        const buffer = Buffer.allocUnsafe(98);
        const announceAction = 0x1;
        const transactionId = crypto.randomBytes(4);
        this.transactionId = transactionId.readUInt32BE(0); // this will override old id, i guess it doesn't matter??
        const infoHash = this._infoHash();
        const peerId = this._getPeerId();
        const key = crypto.randomBytes(4);
    
        buffer.writeBigInt64BE(this.connectionId, 0);   
        buffer.writeUInt32BE(announceAction, 8);
        transactionId.copy(buffer, 12);
        infoHash.copy(buffer, 16);
        peerId.copy(buffer, 36);
        // big ints in javascript are just numbers with 'n' appended to them
        buffer.writeBigInt64BE(BigInt(0), 56); // downloaded
        buffer.writeBigInt64BE(BigInt(0), 64); // left
        buffer.writeBigInt64BE(BigInt(0), 72); // uploaded
        buffer.writeUInt32BE(0, 80); // event: none
        buffer.writeUInt32BE(0, 84); // ip address: default
        key.copy(buffer, 88);
        buffer.writeInt32BE(-1, 92); // num_want: default
        buffer.writeUInt16BE(this.trackerPort, 96);

        return buffer; 
    }

    _initSocket() {
        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            console.log(`socket error:\n${err.stack}`);
            this.socket.close();
        })
        //ok so this is very weird and i don't even know if you should do it
        this.socket.on('message', this._responseHandler.bind(this));
    }

    _responseHandler(response) {
        console.log('response ', response);
        const type = response.readUInt32BE(0);

        if (type == 0x0) {
            // connect response
            const serverTransactionId = response.readUInt32BE(4);
            if (serverTransactionId != this.transactionId) {
                // throw exception???
                console.log("server transaction id doesn't match with client's");
                console.log('received ', serverTransactionId);
                console.log('got ', this.transactionId);
            }

            // save connection id for later
            this.connectionId = response.readBigUInt64BE(8);
            console.log('connection id ', this.connectionId);
            this._sendAnnounce();
        } else if (type == 0x1) {
            // Announce response
        } else {
            // Unknown
        }
    }

    // todo: merge send funcitons
    // we should probably fire a timeout after sending the messages to later check if we got response
    _sendAnnounce() {
        const request = this._buildAnnounceRequest();
        this.socket.send(request, this.trackerPort, this.trackerUrl);
    }

    _sendConnect() {
        const request = this._buildConnectRequest();
        this.socket.send(request, this.trackerPort, this.trackerUrl);
    }

    getPeers() {
        if (this.socket === null) {
            this._initSocket();
            this._sendConnect();
        }
    }
}

module.exports = TrackerClient;