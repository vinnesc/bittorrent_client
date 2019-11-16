const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const crypto = require('crypto');

class TrackerClient {
    constructor(trackerUrl) {
        this.trackerUrl = trackerUrl;
        this.socket = null;
        this.transactionId = null;
        this.connectionId = null;
    }

    _buildConnectRequest() {
        // See: http://www.bittorrent.org/beps/bep_0015.html
        const buffer = Buffer.allocUnsafe(16);
        const magic_h = 0x417;
        const magic_l = 0x27101980;
        const connectAction = 0x0;
        this.transactionId = crypto.randomBytes(4);
    
        buffer.writeUInt32BE(magic_h, 0);
        buffer.writeUInt32BE(magic_l, 4);
        buffer.writeUInt32BE(connectAction, 8);
        this.transactionId.forEach((value, i, buf) => {
            buffer.writeUInt8(value, 12 + i);
        })
    
        // We will need the transaciton id later
        return buffer; 
    }

    _responseHandler(response) {
        console.log('response ', response);
    }

    _connect() {
        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            console.log(`socket error:\n${err.stack}`);
            socket.close();
        })
        //ok so this is very weird and i don't even know if you should do it
        this.socket.on('message', this._responseHandler.bind(this));
        
        const request = this._buildConnectRequest();
        this.socket.send(request, this.trackerUrl.port, this.trackerUrl.hostname);
    }

    getPeers() {
        if (this.socket === null) {
            this._connect();
        }
    }
}

module.exports = TrackerClient;