export default class VoxReader {
    constructor (data) {
        this.data = data;
        this.chunkInfo = {};
        this.modelInfo = null;
    }

    isValid () {
        return String.fromCharCode.apply(String, this.data.slice(0, 4)) === 'VOX ';
    }

    read () {
        this._readChunk(8, this.chunkInfo);

        if ('MAIN' !== this.chunkInfo.header) {
            throw new Error('No MAIN section present in vox file');
        }
    }

    getModel () {
        // Lazy-load model info from the raw chunk data
        if (this.modelInfo) {
            return this.modelInfo;
        }
        this.modelInfo = {};

        _.each(this.chunkInfo.children, child => {
            if (child.header === 'SIZE') {
                this.modelInfo.size = {
                    x: new Uint32Array(child.content.buffer.slice(0, 4))[0],
                    y: new Uint32Array(child.content.buffer.slice(4, 8))[0],
                    z: new Int32Array(child.content.buffer.slice(8, 12))[0]
                }
            } else if (child.header === 'RGBA') {
                this.modelInfo.palette = [];
                for (var i = 0; i < child.content.length; i += 4) {
                    this.modelInfo.palette.push([
                        child.content[i],
                        child.content[i+1],
                        child.content[i+2],
                        child.content[i+3]
                    ]);
                }
            } else if (child.header === 'XYZI') {
                this.modelInfo.nVoxels = new Uint32Array(child.content.buffer.slice(0, 4))[0];
                this.modelInfo.voxels = child.content.slice(4);
            }
        });
        // TODO default palette if not set

        return this.modelInfo;
    }

    _readChunk (addr, chunkInfo) {
        var n = new Uint32Array(this.data.buffer.slice(addr + 4, addr + 8))[0];
        var m = new Uint32Array(this.data.buffer.slice(addr + 8, addr + 12))[0];

        chunkInfo.addr = addr;
        chunkInfo.header = String.fromCharCode.apply(String, this.data.slice(addr, addr + 4));
        chunkInfo.content = this.data.slice(addr + 12, addr + 12 + n);
        chunkInfo.children = [];

        addr += 12 + n;
        while (addr < chunkInfo.addr + 12 + n + m) {
            var childInfo = {};
            addr = this._readChunk(addr, childInfo);
            chunkInfo.children.push(childInfo);
        }

        return addr;
    }
}
