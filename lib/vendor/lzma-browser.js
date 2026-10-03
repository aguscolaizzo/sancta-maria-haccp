var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/lzma-purejs/lib/freeze.js
var require_freeze = __commonJS({
  "node_modules/lzma-purejs/lib/freeze.js"(exports, module) {
    module.exports = (function() {
      "use strict";
      if (Object.freeze) {
        return Object.freeze;
      } else {
        return function(o) {
          return o;
        };
      }
    })();
  }
});

// node_modules/lzma-purejs/lib/makeBuffer.js
var require_makeBuffer = __commonJS({
  "node_modules/lzma-purejs/lib/makeBuffer.js"(exports, module) {
    module.exports = (function() {
      "use strict";
      var makeBuffer = function(len) {
        var b = [], i;
        for (i = 0; i < len; i++) {
          b[i] = 0;
        }
        return b;
      };
      if (typeof Uint8Array !== "undefined") {
        makeBuffer = function(len) {
          return new Uint8Array(len);
        };
      } else if (typeof Buffer !== "undefined") {
        makeBuffer = function(len) {
          var b = new Buffer(len);
          b.fill(0);
          return b;
        };
      }
      return makeBuffer;
    })();
  }
});

// node_modules/lzma-purejs/lib/LZ/InWindow.js
var require_InWindow = __commonJS({
  "node_modules/lzma-purejs/lib/LZ/InWindow.js"(exports, module) {
    module.exports = (function(freeze, makeBuffer) {
      "use strict";
      var InWindow = function(keepSizeBefore, keepSizeAfter, keepSizeReserve, stream) {
        if (arguments.length >= 4) {
          var args = Array.prototype.slice.call(arguments, 0);
          var _stream = args.pop();
          this.create.apply(this, args);
          this.setStream(_stream);
          this.init();
        }
      };
      InWindow.prototype.moveBlock = function() {
        var i;
        var offset = this._bufferOffset + this._pos + this._keepSizeBefore;
        if (offset > 0) {
          offset--;
        }
        var numBytes = this._bufferOffset + this._streamPos - offset;
        for (i = 0; i < numBytes; i++) {
          this._bufferBase[i] = this._bufferBase[offset + i];
        }
        this._bufferOffset -= offset;
      };
      InWindow.prototype.readBlock = function() {
        if (this._streamEndWasReached) {
          return;
        }
        while (true) {
          var size = -this._bufferOffset + this._blockSize - this._streamPos;
          if (size === 0) {
            return;
          }
          var numReadBytes = this._stream.read(
            this._bufferBase,
            this._bufferOffset + this._streamPos,
            size
          );
          if (numReadBytes <= 0) {
            this._posLimit = this._streamPos;
            var pointerToPosition = this._bufferOffset + this._posLimit;
            if (pointerToPosition > this._pointerToLastSafePosition) {
              this._posLimit = this._pointerToLastSafePosition - this._bufferOffset;
            }
            this._streamEndWasReached = true;
            return;
          }
          this._streamPos += numReadBytes;
          if (this._streamPos >= this._pos + this._keepSizeAfter) {
            this._posLimit = this._streamPos - this._keepSizeAfter;
          }
        }
      };
      InWindow.prototype.free = function() {
        this._bufferBase = null;
      };
      InWindow.prototype.create = function(keepSizeBefore, keepSizeAfter, keepSizeReserve) {
        this._keepSizeBefore = keepSizeBefore;
        this._keepSizeAfter = keepSizeAfter;
        var blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserve;
        if (!this._bufferBase || this._blockSize !== blockSize) {
          this.free();
          this._blockSize = blockSize;
          this._bufferBase = makeBuffer(this._blockSize);
        }
        this._pointerToLastSafePosition = this._blockSize - keepSizeAfter;
      };
      InWindow.prototype.setStream = function(stream) {
        this._stream = stream;
      };
      InWindow.prototype.releaseStream = function() {
        this._stream = null;
      };
      InWindow.prototype.init = function() {
        this._bufferOffset = 0;
        this._pos = 0;
        this._streamPos = 0;
        this._streamEndWasReached = false;
        this.readBlock();
      };
      InWindow.prototype.movePos = function() {
        this._pos++;
        if (this._pos > this._posLimit) {
          var pointerToPosition = this._bufferOffset + this._pos;
          if (pointerToPosition > this._pointerToLastSafePosition) {
            this.moveBlock();
          }
          this.readBlock();
        }
      };
      InWindow.prototype.getIndexByte = function(index) {
        return this._bufferBase[this._bufferOffset + this._pos + index];
      };
      InWindow.prototype.getMatchLen = function(index, distance, limit) {
        var pby, i;
        if (this._streamEndWasReached) {
          if (this._pos + index + limit > this._streamPos) {
            limit = this._streamPos - (this._pos + index);
          }
        }
        distance++;
        pby = this._bufferOffset + this._pos + index;
        for (i = 0; i < limit && this._bufferBase[pby + i] === this._bufferBase[pby + i - distance]; ) {
          i++;
        }
        return i;
      };
      InWindow.prototype.getNumAvailableBytes = function() {
        return this._streamPos - this._pos;
      };
      InWindow.prototype.reduceOffsets = function(subValue) {
        this._bufferOffset += subValue;
        this._posLimit -= subValue;
        this._pos -= subValue;
        this._streamPos -= subValue;
      };
      return freeze(InWindow);
    })(require_freeze(), require_makeBuffer());
  }
});

// node_modules/lzma-purejs/lib/LZ/BinTree.js
var require_BinTree = __commonJS({
  "node_modules/lzma-purejs/lib/LZ/BinTree.js"(exports, module) {
    module.exports = (function(freeze, InWindow) {
      "use strict";
      var CrcTable = (function() {
        var table = [];
        if (typeof Uint32Array !== "undefined") {
          table = new Uint32Array(256);
        }
        var kPoly = 3988292384, i, j, r;
        for (i = 0; i < 256; i++) {
          r = i;
          for (j = 0; j < 8; j++) {
            if ((r & 1) !== 0) {
              r = r >>> 1 ^ kPoly;
            } else {
              r >>>= 1;
            }
          }
          table[i] = r;
        }
        return table;
      })();
      console.assert(CrcTable.length === 256);
      var kHash2Size = 1 << 10, kHash3Size = 1 << 16, kBT2HashSize = 1 << 16;
      var kStartMaxLen = 1, kHash3Offset = kHash2Size, kEmptyHashValue = 0;
      var kMaxValForNormalize = (1 << 30) - 1;
      function BinTree() {
        InWindow.call(this);
        this._cyclicBufferSize = 0;
        this._son = [];
        this._hash = [];
        this._cutValue = 255;
        this._hashSizeSum = 0;
        this.HASH_ARRAY = true;
        this.kNumHashDirectBytes = 0;
        this.kMinMatchCheck = 4;
        this.kFixHashSize = kHash2Size + kHash3Size;
        if (arguments.length >= 6) {
          var args = Array.prototype.slice.call(arguments, 0);
          this.setType(args.shift());
          var stream = args.pop();
          this.create.apply(this, args);
          this.setStream(stream);
          this.init();
        }
      }
      var _super_ = InWindow.prototype;
      BinTree.prototype = Object.create(_super_);
      BinTree.prototype.setType = function(numHashBytes) {
        this.HASH_ARRAY = numHashBytes > 2;
        if (this.HASH_ARRAY) {
          this.kNumHashDirectBytes = 0;
          this.kMinMatchCheck = 4;
          this.kFixHashSize = kHash2Size + kHash3Size;
        } else {
          this.kNumHashDirectBytes = 2;
          this.kMinMatchCheck = 2 + 1;
          this.kFixHashSize = 0;
        }
      };
      BinTree.prototype.init = function() {
        var i;
        _super_.init.call(this);
        for (i = 0; i < this._hashSizeSum; i++) {
          this._hash[i] = kEmptyHashValue;
        }
        this._cyclicBufferPos = 0;
        this.reduceOffsets(-1);
      };
      BinTree.prototype.movePos = function() {
        if (++this._cyclicBufferPos >= this._cyclicBufferSize) {
          this._cyclicBufferPos = 0;
        }
        _super_.movePos.call(this);
        if (this._pos === kMaxValForNormalize) {
          this.normalize();
        }
      };
      BinTree.prototype.create = function(historySize, keepAddBufferBefore, matchMaxLen, keepAddBufferAfter) {
        var windowReservSize, cyclicBufferSize, hs;
        if (historySize > kMaxValForNormalize - 256) {
          console.assert(false, "Unsupported historySize");
          return false;
        }
        this._cutValue = 16 + (matchMaxLen >>> 1);
        windowReservSize = (historySize + keepAddBufferBefore + matchMaxLen + keepAddBufferAfter) / 2 + 256;
        _super_.create.call(
          this,
          historySize + keepAddBufferBefore,
          matchMaxLen + keepAddBufferAfter,
          windowReservSize
        );
        this._matchMaxLen = matchMaxLen;
        cyclicBufferSize = historySize + 1;
        if (this._cyclicBufferSize !== cyclicBufferSize) {
          this._cyclicBufferSize = cyclicBufferSize;
          this._son = [];
          this._son.length = cyclicBufferSize * 2;
        }
        hs = kBT2HashSize;
        if (this.HASH_ARRAY) {
          hs = historySize - 1;
          hs |= hs >>> 1;
          hs |= hs >>> 2;
          hs |= hs >>> 4;
          hs |= hs >>> 8;
          hs >>>= 1;
          hs |= 65535;
          if (hs > 1 << 24) {
            hs >>>= 1;
          }
          this._hashMask = hs;
          hs++;
          hs += this.kFixHashSize;
        }
        if (hs !== this._hashSizeSum) {
          this._hashSizeSum = hs;
          this._hash = [];
          this._hash.length = this._hashSizeSum;
        }
        return true;
      };
      BinTree.prototype.getMatches = function(distances) {
        var lenLimit;
        if (this._pos + this._matchMaxLen <= this._streamPos) {
          lenLimit = this._matchMaxLen;
        } else {
          lenLimit = this._streamPos - this._pos;
          if (lenLimit < this.kMinMatchCheck) {
            this.movePos();
            return 0;
          }
        }
        var offset = 0;
        var matchMinPos = this._pos > this._cyclicBufferSize ? this._pos - this._cyclicBufferSize : 0;
        var cur = this._bufferOffset + this._pos;
        var maxLen = kStartMaxLen;
        var hashValue = 0, hash2Value = 0, hash3Value = 0;
        if (this.HASH_ARRAY) {
          var temp = CrcTable[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
          hash2Value = temp & kHash2Size - 1;
          temp ^= this._bufferBase[cur + 2] << 8;
          hash3Value = temp & kHash3Size - 1;
          hashValue = (temp ^ CrcTable[this._bufferBase[cur + 3]] << 5) & this._hashMask;
        } else {
          hashValue = this._bufferBase[cur] ^ this._bufferBase[cur + 1] << 8;
        }
        var curMatch = this._hash[this.kFixHashSize + hashValue];
        if (this.HASH_ARRAY) {
          var curMatch2 = this._hash[hash2Value];
          var curMatch3 = this._hash[kHash3Offset + hash3Value];
          this._hash[hash2Value] = this._pos;
          this._hash[kHash3Offset + hash3Value] = this._pos;
          if (curMatch2 > matchMinPos) {
            if (this._bufferBase[this._bufferOffset + curMatch2] === this._bufferBase[cur]) {
              distances[offset++] = maxLen = 2;
              distances[offset++] = this._pos - curMatch2 - 1;
            }
          }
          if (curMatch3 > matchMinPos) {
            if (this._bufferBase[this._bufferOffset + curMatch3] === this._bufferBase[cur]) {
              if (curMatch3 === curMatch2) {
                offset -= 2;
              }
              distances[offset++] = maxLen = 3;
              distances[offset++] = this._pos - curMatch3 - 1;
              curMatch2 = curMatch3;
            }
          }
          if (offset !== 0 && curMatch2 === curMatch) {
            offset -= 2;
            maxLen = kStartMaxLen;
          }
        }
        this._hash[this.kFixHashSize + hashValue] = this._pos;
        var ptr0 = (this._cyclicBufferPos << 1) + 1;
        var ptr1 = this._cyclicBufferPos << 1;
        var len0, len1;
        len0 = len1 = this.kNumHashDirectBytes;
        if (this.kNumHashDirectBytes !== 0) {
          if (curMatch > matchMinPos) {
            if (this._bufferBase[this._bufferOffset + curMatch + this.kNumHashDirectBytes] !== this._bufferBase[cur + this.kNumHashDirectBytes]) {
              distances[offset++] = maxLen = this.kNumHashDirectBytes;
              distances[offset++] = this._pos - curMatch - 1;
            }
          }
        }
        var count = this._cutValue;
        while (true) {
          if (curMatch <= matchMinPos || count-- === 0) {
            this._son[ptr0] = this._son[ptr1] = kEmptyHashValue;
            break;
          }
          var delta = this._pos - curMatch;
          var cyclicPos = (delta <= this._cyclicBufferPos ? this._cyclicBufferPos - delta : this._cyclicBufferPos - delta + this._cyclicBufferSize) << 1;
          var pby1 = this._bufferOffset + curMatch;
          var len = Math.min(len0, len1);
          if (this._bufferBase[pby1 + len] === this._bufferBase[cur + len]) {
            while (++len !== lenLimit) {
              if (this._bufferBase[pby1 + len] !== this._bufferBase[cur + len]) {
                break;
              }
            }
            if (maxLen < len) {
              distances[offset++] = maxLen = len;
              distances[offset++] = delta - 1;
              if (len === lenLimit) {
                this._son[ptr1] = this._son[cyclicPos];
                this._son[ptr0] = this._son[cyclicPos + 1];
                break;
              }
            }
          }
          if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
            this._son[ptr1] = curMatch;
            ptr1 = cyclicPos + 1;
            curMatch = this._son[ptr1];
            len1 = len;
          } else {
            this._son[ptr0] = curMatch;
            ptr0 = cyclicPos;
            curMatch = this._son[ptr0];
            len0 = len;
          }
        }
        this.movePos();
        return offset;
      };
      BinTree.prototype.skip = function(num) {
        var lenLimit, matchMinPos, cur, curMatch, hashValue, hash2Value, hash3Value, temp;
        var ptr0, ptr1, len0, len1, count, delta, cyclicPos, pby1, len;
        do {
          if (this._pos + this._matchMaxLen <= this._streamPos) {
            lenLimit = this._matchMaxLen;
          } else {
            lenLimit = this._streamPos - this._pos;
            if (lenLimit < this.kMinMatchCheck) {
              this.movePos();
              continue;
            }
          }
          matchMinPos = this._pos > this._cyclicBufferSize ? this._pos - this._cyclicBufferSize : 0;
          cur = this._bufferOffset + this._pos;
          if (this.HASH_ARRAY) {
            temp = CrcTable[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
            hash2Value = temp & kHash2Size - 1;
            this._hash[hash2Value] = this._pos;
            temp ^= this._bufferBase[cur + 2] << 8;
            hash3Value = temp & kHash3Size - 1;
            this._hash[kHash3Offset + hash3Value] = this._pos;
            hashValue = (temp ^ CrcTable[this._bufferBase[cur + 3]] << 5) & this._hashMask;
          } else {
            hashValue = this._bufferBase[cur] ^ this._bufferBase[cur + 1] << 8;
          }
          curMatch = this._hash[this.kFixHashSize + hashValue];
          this._hash[this.kFixHashSize + hashValue] = this._pos;
          ptr0 = (this._cyclicBufferPos << 1) + 1;
          ptr1 = this._cyclicBufferPos << 1;
          len0 = len1 = this.kNumHashDirectBytes;
          count = this._cutValue;
          while (true) {
            if (curMatch <= matchMinPos || count-- === 0) {
              this._son[ptr0] = this._son[ptr1] = kEmptyHashValue;
              break;
            }
            delta = this._pos - curMatch;
            cyclicPos = (delta <= this._cyclicBufferPos ? this._cyclicBufferPos - delta : this._cyclicBufferPos - delta + this._cyclicBufferSize) << 1;
            pby1 = this._bufferOffset + curMatch;
            len = len0 < len1 ? len0 : len1;
            if (this._bufferBase[pby1 + len] === this._bufferBase[cur + len]) {
              while (++len !== lenLimit) {
                if (this._bufferBase[pby1 + len] !== this._bufferBase[cur + len]) {
                  break;
                }
              }
              if (len === lenLimit) {
                this._son[ptr1] = this._son[cyclicPos];
                this._son[ptr0] = this._son[cyclicPos + 1];
                break;
              }
            }
            if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
              this._son[ptr1] = curMatch;
              ptr1 = cyclicPos + 1;
              curMatch = this._son[ptr1];
              len1 = len;
            } else {
              this._son[ptr0] = curMatch;
              ptr0 = cyclicPos;
              curMatch = this._son[ptr0];
              len0 = len;
            }
          }
          this.movePos();
        } while (--num !== 0);
      };
      BinTree.prototype.normalizeLinks = function(items, numItems, subValue) {
        var i, value;
        for (i = 0; i < numItems; i++) {
          value = items[i];
          if (value <= subValue) {
            value = kEmptyHashValue;
          } else {
            value -= subValue;
          }
          items[i] = value;
        }
      };
      BinTree.prototype.normalize = function() {
        var subValue = this._pos - this._cyclicBufferSize;
        this.normalizeLinks(this._son, this._cyclicBufferSize * 2, subValue);
        this.normalizeLinks(this._hash, this._hashSizeSum, subValue);
        this.reduceOffsets(subValue);
      };
      BinTree.prototype.setCutValue = function(cutValue) {
        this._cutValue = cutValue;
      };
      freeze(BinTree.prototype);
      return freeze(BinTree);
    })(require_freeze(), require_InWindow());
  }
});

// node_modules/lzma-purejs/lib/LZ/OutWindow.js
var require_OutWindow = __commonJS({
  "node_modules/lzma-purejs/lib/LZ/OutWindow.js"(exports, module) {
    module.exports = (function(freeze, makeBuffer) {
      "use strict";
      var OutWindow = function() {
        this._windowSize = 0;
      };
      OutWindow.prototype.create = function(windowSize) {
        if (!this._buffer || this._windowSize !== windowSize) {
          this._buffer = makeBuffer(windowSize);
        }
        this._windowSize = windowSize;
        this._pos = 0;
        this._streamPos = 0;
      };
      OutWindow.prototype.flush = function() {
        var size = this._pos - this._streamPos;
        if (size !== 0) {
          while (size--) {
            this._stream.writeByte(this._buffer[this._streamPos++]);
          }
          if (this._pos >= this._windowSize) {
            this._pos = 0;
          }
          this._streamPos = this._pos;
        }
      };
      OutWindow.prototype.releaseStream = function() {
        this.flush();
        this._stream = null;
      };
      OutWindow.prototype.setStream = function(stream) {
        this.releaseStream();
        this._stream = stream;
      };
      OutWindow.prototype.init = function(solid) {
        if (!solid) {
          this._streamPos = 0;
          this._pos = 0;
        }
      };
      OutWindow.prototype.copyBlock = function(distance, len) {
        var pos = this._pos - distance - 1;
        if (pos < 0) {
          pos += this._windowSize;
        }
        while (len--) {
          if (pos >= this._windowSize) {
            pos = 0;
          }
          this._buffer[this._pos++] = this._buffer[pos++];
          if (this._pos >= this._windowSize) {
            this.flush();
          }
        }
      };
      OutWindow.prototype.putByte = function(b) {
        this._buffer[this._pos++] = b;
        if (this._pos >= this._windowSize) {
          this.flush();
        }
      };
      OutWindow.prototype.getByte = function(distance) {
        var pos = this._pos - distance - 1;
        if (pos < 0) {
          pos += this._windowSize;
        }
        return this._buffer[pos];
      };
      freeze(OutWindow.prototype);
      return freeze(OutWindow);
    })(require_freeze(), require_makeBuffer());
  }
});

// node_modules/lzma-purejs/lib/LZ.js
var require_LZ = __commonJS({
  "node_modules/lzma-purejs/lib/LZ.js"(exports, module) {
    module.exports = (function(freeze, BinTree, InWindow, OutWindow) {
      "use strict";
      return freeze({
        BinTree,
        InWindow,
        OutWindow
      });
    })(require_freeze(), require_BinTree(), require_InWindow(), require_OutWindow());
  }
});

// node_modules/lzma-purejs/lib/LZMA/Base.js
var require_Base = __commonJS({
  "node_modules/lzma-purejs/lib/LZMA/Base.js"(exports, module) {
    module.exports = (function(freeze) {
      "use strict";
      var Base = /* @__PURE__ */ Object.create(null);
      Base.kNumRepDistances = 4;
      Base.kNumStates = 12;
      Base.stateInit = function() {
        return 0;
      };
      Base.stateUpdateChar = function(index) {
        if (index < 4) {
          return 0;
        }
        if (index < 10) {
          return index - 3;
        }
        return index - 6;
      };
      Base.stateUpdateMatch = function(index) {
        return index < 7 ? 7 : 10;
      };
      Base.stateUpdateRep = function(index) {
        return index < 7 ? 8 : 11;
      };
      Base.stateUpdateShortRep = function(index) {
        return index < 7 ? 9 : 11;
      };
      Base.stateIsCharState = function(index) {
        return index < 7;
      };
      Base.kNumPosSlotBits = 6;
      Base.kDicLogSizeMin = 0;
      Base.kNumLenToPosStatesBits = 2;
      Base.kNumLenToPosStates = 1 << Base.kNumLenToPosStatesBits;
      Base.kMatchMinLen = 2;
      Base.getLenToPosState = function(len) {
        len -= Base.kMatchMinLen;
        if (len < Base.kNumLenToPosStates) {
          return len;
        }
        return Base.kNumLenToPosStates - 1;
      };
      Base.kNumAlignBits = 4;
      Base.kAlignTableSize = 1 << Base.kNumAlignBits;
      Base.kAlignMask = Base.kAlignTableSize - 1;
      Base.kStartPosModelIndex = 4;
      Base.kEndPosModelIndex = 14;
      Base.kNumPosModels = Base.kEndPosModelIndex - Base.kStartPosModelIndex;
      Base.kNumFullDistances = 1 << Base.kEndPosModelIndex / 2;
      Base.kNumLitPosStatesBitsEncodingMax = 4;
      Base.kNumLitContextBitsMax = 8;
      Base.kNumPosStatesBitsMax = 4;
      Base.kNumPosStatesMax = 1 << Base.kNumPosStatesBitsMax;
      Base.kNumPosStatesBitsEncodingMax = 4;
      Base.kNumPosStatesEncodingMax = 1 << Base.kNumPosStatesBitsEncodingMax;
      Base.kNumLowLenBits = 3;
      Base.kNumMidLenBits = 3;
      Base.kNumHighLenBits = 8;
      Base.kNumLowLenSymbols = 1 << Base.kNumLowLenBits;
      Base.kNumMidLenSymbols = 1 << Base.kNumMidLenBits;
      Base.kNumLenSymbols = Base.kNumLowLenSymbols + Base.kNumMidLenSymbols + (1 << Base.kNumHighLenBits);
      Base.kMatchMaxLen = Base.kMatchMinLen + Base.kNumLenSymbols - 1;
      return freeze(Base);
    })(require_freeze());
  }
});

// node_modules/lzma-purejs/lib/RangeCoder/Encoder.js
var require_Encoder = __commonJS({
  "node_modules/lzma-purejs/lib/RangeCoder/Encoder.js"(exports, module) {
    module.exports = (function(freeze) {
      "use strict";
      var MAX32 = 4294967295;
      var MAX24 = 16777215;
      var MAX16 = 65535;
      var MAX8 = 255;
      var MASK24 = 4278190080;
      var kNumBitModelTotalBits = 11;
      var kBitModelTotal = 1 << kNumBitModelTotalBits;
      var kNumMoveBits = 5;
      var kNumMoveReducingBits = 2;
      var kNumBitPriceShiftBits = 6;
      var Encoder = function(stream) {
        this.init();
        if (stream) {
          this.setStream(stream);
        }
      };
      Encoder.prototype.setStream = function(stream) {
        this._stream = stream;
      };
      Encoder.prototype.releaseStream = function() {
        this._stream = null;
      };
      Encoder.prototype.init = function() {
        this._position = 0;
        this.low = 0;
        this.range = MAX32;
        this._cacheSize = 1;
        this._cache = 0;
      };
      Encoder.prototype.flushData = function() {
        var i;
        for (i = 0; i < 5; i++) {
          this.shiftLow();
        }
      };
      Encoder.prototype.flushStream = function() {
        if (this._stream.flush) {
          this._stream.flush();
        }
      };
      Encoder.prototype.shiftLow = function() {
        var overflow = this.low > MAX32 ? 1 : 0;
        if (this.low < MASK24 || overflow) {
          this._position += this._cacheSize;
          var temp = this._cache;
          do {
            this._stream.writeByte(temp + overflow & MAX8);
            temp = MAX8;
          } while (--this._cacheSize !== 0);
          this._cache = this.low >>> 24;
        }
        this._cacheSize++;
        this.low = (this.low & MAX24) * 256;
      };
      Encoder.prototype.encodeDirectBits = function(v, numTotalBits) {
        var i, mask;
        mask = 1 << numTotalBits - 1;
        for (i = numTotalBits - 1; i >= 0; i--, mask >>>= 1) {
          this.range >>>= 1;
          if (v & mask) {
            this.low += this.range;
          }
          if (this.range <= MAX24) {
            this.range *= 256;
            this.shiftLow();
          }
        }
      };
      Encoder.prototype.getProcessedSizeAdd = function() {
        return this._cacheSize + this._position + 4;
      };
      Encoder.initBitModels = function(probs, len) {
        var i;
        if (len && !probs) {
          if (typeof Uint16Array !== "undefined") {
            probs = new Uint16Array(len);
          } else {
            probs = [];
            probs.length = len;
          }
        }
        for (i = 0; i < probs.length; i++)
          probs[i] = kBitModelTotal >>> 1;
        return probs;
      };
      Encoder.prototype.encode = function(probs, index, symbol) {
        var prob = probs[index];
        var newBound = (this.range >>> kNumBitModelTotalBits) * prob;
        if (symbol === 0) {
          this.range = newBound;
          probs[index] = prob + (kBitModelTotal - prob >>> kNumMoveBits);
        } else {
          this.low += newBound;
          this.range -= newBound;
          probs[index] = prob - (prob >>> kNumMoveBits);
        }
        if (this.range <= MAX24) {
          this.range *= 256;
          this.shiftLow();
        }
      };
      var ProbPrices = [];
      if (typeof Uint32Array !== "undefined") {
        ProbPrices = new Uint32Array(kBitModelTotal >>> kNumMoveReducingBits);
      }
      (function() {
        var kNumBits = kNumBitModelTotalBits - kNumMoveReducingBits;
        var i, j;
        for (i = kNumBits - 1; i >= 0; i--) {
          var start = 1 << kNumBits - i - 1;
          var end = 1 << kNumBits - i;
          for (j = start; j < end; j++) {
            ProbPrices[j] = (i << kNumBitPriceShiftBits) + (end - j << kNumBitPriceShiftBits >>> kNumBits - i - 1);
          }
        }
      })();
      Encoder.getPrice = function(prob, symbol) {
        return ProbPrices[((prob - symbol ^ -symbol) & kBitModelTotal - 1) >>> kNumMoveReducingBits];
      };
      Encoder.getPrice0 = function(prob) {
        return ProbPrices[prob >>> kNumMoveReducingBits];
      };
      Encoder.getPrice1 = function(prob) {
        return ProbPrices[kBitModelTotal - prob >>> kNumMoveReducingBits];
      };
      Encoder.kNumBitPriceShiftBits = kNumBitPriceShiftBits;
      freeze(Encoder.prototype);
      return freeze(Encoder);
    })(require_freeze());
  }
});

// node_modules/lzma-purejs/lib/RangeCoder/BitTreeDecoder.js
var require_BitTreeDecoder = __commonJS({
  "node_modules/lzma-purejs/lib/RangeCoder/BitTreeDecoder.js"(exports, module) {
    module.exports = (function(freeze, Encoder) {
      "use strict";
      var BitTreeDecoder = function(numBitLevels) {
        this._numBitLevels = numBitLevels;
        this.init();
      };
      BitTreeDecoder.prototype.init = function() {
        this._models = Encoder.initBitModels(null, 1 << this._numBitLevels);
      };
      BitTreeDecoder.prototype.decode = function(rangeDecoder) {
        var m = 1, i = this._numBitLevels;
        while (i--) {
          m = m << 1 | rangeDecoder.decodeBit(this._models, m);
        }
        return m - (1 << this._numBitLevels);
      };
      BitTreeDecoder.prototype.reverseDecode = function(rangeDecoder) {
        var m = 1, symbol = 0, i = 0, bit;
        for (; i < this._numBitLevels; ++i) {
          bit = rangeDecoder.decodeBit(this._models, m);
          m = m << 1 | bit;
          symbol |= bit << i;
        }
        return symbol;
      };
      BitTreeDecoder.reverseDecode = function(models, startIndex, rangeDecoder, numBitLevels) {
        var m = 1, symbol = 0, i = 0, bit;
        for (; i < numBitLevels; ++i) {
          bit = rangeDecoder.decodeBit(models, startIndex + m);
          m = m << 1 | bit;
          symbol |= bit << i;
        }
        return symbol;
      };
      freeze(BitTreeDecoder.prototype);
      return freeze(BitTreeDecoder);
    })(require_freeze(), require_Encoder());
  }
});

// node_modules/lzma-purejs/lib/RangeCoder/BitTreeEncoder.js
var require_BitTreeEncoder = __commonJS({
  "node_modules/lzma-purejs/lib/RangeCoder/BitTreeEncoder.js"(exports, module) {
    module.exports = (function(freeze, Encoder) {
      "use strict";
      var BitTreeEncoder = function(numBitLevels) {
        this._numBitLevels = numBitLevels;
        this.init();
      };
      BitTreeEncoder.prototype.init = function() {
        this._models = Encoder.initBitModels(null, 1 << this._numBitLevels);
      };
      BitTreeEncoder.prototype.encode = function(rangeEncoder, symbol) {
        var m = 1, bitIndex;
        for (bitIndex = this._numBitLevels; bitIndex > 0; ) {
          bitIndex--;
          var bit = symbol >>> bitIndex & 1;
          rangeEncoder.encode(this._models, m, bit);
          m = m << 1 | bit;
        }
      };
      BitTreeEncoder.prototype.reverseEncode = function(rangeEncoder, symbol) {
        var m = 1, i;
        for (i = 0; i < this._numBitLevels; i++) {
          var bit = symbol & 1;
          rangeEncoder.encode(this._models, m, bit);
          m = m << 1 | bit;
          symbol >>>= 1;
        }
      };
      BitTreeEncoder.reverseEncode = function(models, startIndex, rangeEncoder, numBitLevels, symbol) {
        var m = 1, i;
        for (i = 0; i < numBitLevels; i++) {
          var bit = symbol & 1;
          rangeEncoder.encode(models, startIndex + m, bit);
          m = m << 1 | bit;
          symbol >>>= 1;
        }
      };
      BitTreeEncoder.prototype.getPrice = function(symbol) {
        var price = 0, m = 1, bitIndex;
        for (bitIndex = this._numBitLevels; bitIndex > 0; ) {
          bitIndex--;
          var bit = symbol >>> bitIndex & 1;
          price += Encoder.getPrice(this._models[m], bit);
          m = m << 1 | bit;
        }
        return price;
      };
      BitTreeEncoder.prototype.reverseGetPrice = function(symbol) {
        var price = 0, m = 1, bitIndex;
        for (bitIndex = this._numBitLevels; bitIndex > 0; bitIndex--) {
          var bit = symbol & 1;
          symbol >>>= 1;
          price += Encoder.getPrice(this._models[m], bit);
          m = m << 1 | bit;
        }
        return price;
      };
      BitTreeEncoder.reverseGetPrice = function(models, startIndex, numBitLevels, symbol) {
        var price = 0, m = 1, bitIndex;
        for (bitIndex = numBitLevels; bitIndex > 0; bitIndex--) {
          var bit = symbol & 1;
          symbol >>>= 1;
          price += Encoder.getPrice(models[startIndex + m], bit);
          m = m << 1 | bit;
        }
        return price;
      };
      freeze(BitTreeEncoder.prototype);
      return freeze(BitTreeEncoder);
    })(require_freeze(), require_Encoder());
  }
});

// node_modules/lzma-purejs/lib/RangeCoder/Decoder.js
var require_Decoder = __commonJS({
  "node_modules/lzma-purejs/lib/RangeCoder/Decoder.js"(exports, module) {
    module.exports = (function(freeze) {
      "use strict";
      var Decoder = function(stream) {
        if (stream) {
          this.setStream(stream);
          this.init();
        }
      };
      Decoder.prototype.setStream = function(stream) {
        this._stream = stream;
      };
      Decoder.prototype.releaseStream = function() {
        this._stream = null;
      };
      Decoder.prototype.init = function() {
        var i = 5;
        this._code = 0;
        this._range = -1;
        while (i--) {
          this._code = this._code << 8 | this._stream.readByte();
        }
      };
      Decoder.prototype.decodeDirectBits = function(numTotalBits) {
        var result = 0, i = numTotalBits, t;
        while (i--) {
          this._range >>>= 1;
          t = this._code - this._range >>> 31;
          this._code -= this._range & t - 1;
          result = result << 1 | 1 - t;
          if ((this._range & 4278190080) === 0) {
            this._code = this._code << 8 | this._stream.readByte();
            this._range <<= 8;
          }
        }
        return result;
      };
      Decoder.prototype.decodeBit = function(probs, index) {
        var prob = probs[index], newBound = (this._range >>> 11) * prob;
        if ((this._code ^ 2147483648) < (newBound ^ 2147483648)) {
          this._range = newBound;
          probs[index] += 2048 - prob >>> 5;
          if ((this._range & 4278190080) === 0) {
            this._code = this._code << 8 | this._stream.readByte();
            this._range <<= 8;
          }
          return 0;
        }
        this._range -= newBound;
        this._code -= newBound;
        probs[index] -= prob >>> 5;
        if ((this._range & 4278190080) === 0) {
          this._code = this._code << 8 | this._stream.readByte();
          this._range <<= 8;
        }
        return 1;
      };
      freeze(Decoder.prototype);
      return freeze(Decoder);
    })(require_freeze());
  }
});

// node_modules/lzma-purejs/lib/RangeCoder.js
var require_RangeCoder = __commonJS({
  "node_modules/lzma-purejs/lib/RangeCoder.js"(exports, module) {
    module.exports = (function(freeze, BitTreeDecoder, BitTreeEncoder, Decoder, Encoder) {
      "use strict";
      return freeze({
        BitTreeDecoder,
        BitTreeEncoder,
        Decoder,
        Encoder
      });
    })(require_freeze(), require_BitTreeDecoder(), require_BitTreeEncoder(), require_Decoder(), require_Encoder());
  }
});

// node_modules/lzma-purejs/lib/LZMA/Decoder.js
var require_Decoder2 = __commonJS({
  "node_modules/lzma-purejs/lib/LZMA/Decoder.js"(exports, module) {
    module.exports = (function(Base, LZ, RangeCoder) {
      "use strict";
      var initBitModels = RangeCoder.Encoder.initBitModels;
      var LenDecoder = function() {
        this._choice = initBitModels(null, 2);
        this._lowCoder = [];
        this._midCoder = [];
        this._highCoder = new RangeCoder.BitTreeDecoder(8);
        this._numPosStates = 0;
      };
      LenDecoder.prototype.create = function(numPosStates) {
        for (; this._numPosStates < numPosStates; ++this._numPosStates) {
          this._lowCoder[this._numPosStates] = new RangeCoder.BitTreeDecoder(3);
          this._midCoder[this._numPosStates] = new RangeCoder.BitTreeDecoder(3);
        }
      };
      LenDecoder.prototype.init = function() {
        var i = this._numPosStates;
        initBitModels(this._choice);
        while (i--) {
          this._lowCoder[i].init();
          this._midCoder[i].init();
        }
        this._highCoder.init();
      };
      LenDecoder.prototype.decode = function(rangeDecoder, posState) {
        if (rangeDecoder.decodeBit(this._choice, 0) === 0) {
          return this._lowCoder[posState].decode(rangeDecoder);
        }
        if (rangeDecoder.decodeBit(this._choice, 1) === 0) {
          return 8 + this._midCoder[posState].decode(rangeDecoder);
        }
        return 16 + this._highCoder.decode(rangeDecoder);
      };
      var LiteralDecoder = function() {
      };
      LiteralDecoder.Decoder2 = function() {
        this._decoders = initBitModels(null, 768);
      };
      LiteralDecoder.Decoder2.prototype.init = function() {
        initBitModels(this._decoders);
      };
      LiteralDecoder.Decoder2.prototype.decodeNormal = function(rangeDecoder) {
        var symbol = 1;
        do {
          symbol = symbol << 1 | rangeDecoder.decodeBit(this._decoders, symbol);
        } while (symbol < 256);
        return symbol & 255;
      };
      LiteralDecoder.Decoder2.prototype.decodeWithMatchByte = function(rangeDecoder, matchByte) {
        var symbol = 1, matchBit, bit;
        do {
          matchBit = matchByte >> 7 & 1;
          matchByte <<= 1;
          bit = rangeDecoder.decodeBit(this._decoders, (1 + matchBit << 8) + symbol);
          symbol = symbol << 1 | bit;
          if (matchBit !== bit) {
            while (symbol < 256) {
              symbol = symbol << 1 | rangeDecoder.decodeBit(this._decoders, symbol);
            }
            break;
          }
        } while (symbol < 256);
        return symbol & 255;
      };
      LiteralDecoder.prototype.create = function(numPosBits, numPrevBits) {
        var i;
        if (this._coders && this._numPrevBits === numPrevBits && this._numPosBits === numPosBits) {
          return;
        }
        this._numPosBits = numPosBits;
        this._posMask = (1 << numPosBits) - 1;
        this._numPrevBits = numPrevBits;
        this._coders = [];
        i = 1 << this._numPrevBits + this._numPosBits;
        while (i--) {
          this._coders[i] = new LiteralDecoder.Decoder2();
        }
      };
      LiteralDecoder.prototype.init = function() {
        var i = 1 << this._numPrevBits + this._numPosBits;
        while (i--) {
          this._coders[i].init();
        }
      };
      LiteralDecoder.prototype.getDecoder = function(pos, prevByte) {
        return this._coders[((pos & this._posMask) << this._numPrevBits) + ((prevByte & 255) >>> 8 - this._numPrevBits)];
      };
      var Decoder = function() {
        var i;
        this._outWindow = new LZ.OutWindow();
        this._rangeDecoder = new RangeCoder.Decoder();
        this._isMatchDecoders = initBitModels(null, Base.kNumStates << Base.kNumPosStatesBitsMax);
        this._isRepDecoders = initBitModels(null, Base.kNumStates);
        this._isRepG0Decoders = initBitModels(null, Base.kNumStates);
        this._isRepG1Decoders = initBitModels(null, Base.kNumStates);
        this._isRepG2Decoders = initBitModels(null, Base.kNumStates);
        this._isRep0LongDecoders = initBitModels(null, Base.kNumStates << Base.kNumPosStatesBitsMax);
        this._posSlotDecoder = [];
        this._posDecoders = initBitModels(null, Base.kNumFullDistances - Base.kEndPosModelIndex);
        this._posAlignDecoder = new RangeCoder.BitTreeDecoder(Base.kNumAlignBits);
        this._lenDecoder = new LenDecoder();
        this._repLenDecoder = new LenDecoder();
        this._literalDecoder = new LiteralDecoder();
        this._dictionarySize = -1;
        this._dictionarySizeCheck = -1;
        this._posStateMask = 0;
        for (i = 0; i < Base.kNumLenToPosStates; i++) {
          this._posSlotDecoder[i] = new RangeCoder.BitTreeDecoder(Base.kNumPosSlotBits);
        }
      };
      Decoder.prototype.setDictionarySize = function(dictionarySize) {
        if (dictionarySize < 0) {
          return false;
        }
        if (this._dictionarySize !== dictionarySize) {
          this._dictionarySize = dictionarySize;
          this._dictionarySizeCheck = Math.max(this._dictionarySize, 1);
          this._outWindow.create(Math.max(this._dictionarySizeCheck, 1 << 12));
        }
        return true;
      };
      Decoder.prototype.setLcLpPb = function(lc, lp, pb) {
        var numPosStates = 1 << pb;
        if (lc > Base.kNumLitContextBitsMax || lp > 4 || pb > Base.kNumPosStatesBitsMax) {
          return false;
        }
        this._literalDecoder.create(lp, lc);
        this._lenDecoder.create(numPosStates);
        this._repLenDecoder.create(numPosStates);
        this._posStateMask = numPosStates - 1;
        return true;
      };
      Decoder.prototype.init = function() {
        var i = Base.kNumLenToPosStates;
        this._outWindow.init(false);
        initBitModels(this._isMatchDecoders);
        initBitModels(this._isRepDecoders);
        initBitModels(this._isRepG0Decoders);
        initBitModels(this._isRepG1Decoders);
        initBitModels(this._isRepG2Decoders);
        initBitModels(this._isRep0LongDecoders);
        initBitModels(this._posDecoders);
        this._literalDecoder.init();
        while (i--) {
          this._posSlotDecoder[i].init();
        }
        this._lenDecoder.init();
        this._repLenDecoder.init();
        this._posAlignDecoder.init();
        this._rangeDecoder.init();
      };
      Decoder.prototype.code = function(inStream, outStream, outSize) {
        var state, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, nowPos64 = 0, prevByte = 0, posState, decoder2, len, distance, posSlot, numDirectBits;
        this._rangeDecoder.setStream(inStream);
        this._outWindow.setStream(outStream);
        this.init();
        state = Base.stateInit();
        while (outSize < 0 || nowPos64 < outSize) {
          posState = nowPos64 & this._posStateMask;
          if (this._rangeDecoder.decodeBit(this._isMatchDecoders, (state << Base.kNumPosStatesBitsMax) + posState) === 0) {
            decoder2 = this._literalDecoder.getDecoder(nowPos64, prevByte);
            if (!Base.stateIsCharState(state)) {
              prevByte = decoder2.decodeWithMatchByte(this._rangeDecoder, this._outWindow.getByte(rep0));
            } else {
              prevByte = decoder2.decodeNormal(this._rangeDecoder);
            }
            this._outWindow.putByte(prevByte);
            state = Base.stateUpdateChar(state);
            nowPos64++;
          } else {
            if (this._rangeDecoder.decodeBit(this._isRepDecoders, state) === 1) {
              len = 0;
              if (this._rangeDecoder.decodeBit(this._isRepG0Decoders, state) === 0) {
                if (this._rangeDecoder.decodeBit(this._isRep0LongDecoders, (state << Base.kNumPosStatesBitsMax) + posState) === 0) {
                  state = Base.stateUpdateShortRep(state);
                  len = 1;
                }
              } else {
                if (this._rangeDecoder.decodeBit(this._isRepG1Decoders, state) === 0) {
                  distance = rep1;
                } else {
                  if (this._rangeDecoder.decodeBit(this._isRepG2Decoders, state) === 0) {
                    distance = rep2;
                  } else {
                    distance = rep3;
                    rep3 = rep2;
                  }
                  rep2 = rep1;
                }
                rep1 = rep0;
                rep0 = distance;
              }
              if (len === 0) {
                len = Base.kMatchMinLen + this._repLenDecoder.decode(this._rangeDecoder, posState);
                state = Base.stateUpdateRep(state);
              }
            } else {
              rep3 = rep2;
              rep2 = rep1;
              rep1 = rep0;
              len = Base.kMatchMinLen + this._lenDecoder.decode(this._rangeDecoder, posState);
              state = Base.stateUpdateMatch(state);
              posSlot = this._posSlotDecoder[Base.getLenToPosState(len)].decode(this._rangeDecoder);
              if (posSlot >= Base.kStartPosModelIndex) {
                numDirectBits = (posSlot >> 1) - 1;
                rep0 = (2 | posSlot & 1) << numDirectBits;
                if (posSlot < Base.kEndPosModelIndex) {
                  rep0 += RangeCoder.BitTreeDecoder.reverseDecode(
                    this._posDecoders,
                    rep0 - posSlot - 1,
                    this._rangeDecoder,
                    numDirectBits
                  );
                } else {
                  rep0 += this._rangeDecoder.decodeDirectBits(numDirectBits - Base.kNumAlignBits) << Base.kNumAlignBits;
                  rep0 += this._posAlignDecoder.reverseDecode(this._rangeDecoder);
                  if (rep0 < 0) {
                    if (rep0 === -1) {
                      break;
                    }
                    return false;
                  }
                }
              } else {
                rep0 = posSlot;
              }
            }
            if (rep0 >= nowPos64 || rep0 >= this._dictionarySizeCheck) {
              return false;
            }
            this._outWindow.copyBlock(rep0, len);
            nowPos64 += len;
            prevByte = this._outWindow.getByte(0);
          }
        }
        this._outWindow.flush();
        this._outWindow.releaseStream();
        this._rangeDecoder.releaseStream();
        return true;
      };
      Decoder.prototype.setDecoderProperties = function(properties) {
        var value, lc, lp, pb, dictionarySize, i, shift;
        if (properties.length < 5) {
          return false;
        }
        value = properties[0] & 255;
        lc = value % 9;
        value = ~~(value / 9);
        lp = value % 5;
        pb = ~~(value / 5);
        if (!this.setLcLpPb(lc, lp, pb)) {
          return false;
        }
        dictionarySize = 0;
        for (i = 0, shift = 1; i < 4; i++, shift *= 256)
          dictionarySize += (properties[1 + i] & 255) * shift;
        return this.setDictionarySize(dictionarySize);
      };
      Decoder.prototype.setDecoderPropertiesFromStream = function(stream) {
        var buffer = [], i;
        for (i = 0; i < 5; i++) {
          buffer[i] = stream.readByte();
        }
        return this.setDecoderProperties(buffer);
      };
      return Decoder;
    })(require_Base(), require_LZ(), require_RangeCoder());
  }
});

// node_modules/lzma-purejs/lib/LZMA/Encoder.js
var require_Encoder2 = __commonJS({
  "node_modules/lzma-purejs/lib/LZMA/Encoder.js"(exports, module) {
    module.exports = (function(Base, RangeCoder, LZ, freeze, makeBuffer) {
      "use strict";
      var initBitModels = RangeCoder.Encoder.initBitModels;
      var EMatchFinderTypeBT2 = 0;
      var EMatchFinderTypeBT4 = 1;
      var kInfinityPrice = 268435455;
      var kDefaultDictionaryLogSize = 22;
      var kNumFastBytesDefault = 32;
      var kNumOpts = 1 << 12;
      var kPropSize = 5;
      var g_FastPos = (function() {
        var g_FastPos2 = makeBuffer(1 << 11);
        var kFastSlots = 22;
        var c = 2;
        var slotFast;
        g_FastPos2[0] = 0;
        g_FastPos2[1] = 1;
        for (slotFast = 2; slotFast < kFastSlots; slotFast++) {
          var j, k = 1 << (slotFast >> 1) - 1;
          for (j = 0; j < k; j++, c++) {
            g_FastPos2[c] = slotFast;
          }
        }
        return g_FastPos2;
      })();
      var getPosSlot = function(pos) {
        if (pos < 1 << 11) {
          return g_FastPos[pos];
        }
        if (pos < 1 << 21) {
          return g_FastPos[pos >>> 10] + 20;
        }
        return g_FastPos[pos >>> 20] + 40;
      };
      var getPosSlot2 = function(pos) {
        if (pos < 1 << 17) {
          return g_FastPos[pos >>> 6] + 12;
        }
        if (pos < 1 << 27) {
          return g_FastPos[pos >>> 16] + 32;
        }
        return g_FastPos[pos >>> 26] + 52;
      };
      var Encoder = function() {
        var i;
        this._state = Base.stateInit();
        this._previousByte = 0;
        this._repDistances = [];
        this._repDistances.length = Base.kNumRepDistances;
        this._optimum = [];
        this._matchFinder = null;
        this._rangeEncoder = new RangeCoder.Encoder();
        this._isMatch = initBitModels(null, Base.kNumStates << Base.kNumPosStatesBitsMax);
        this._isRep = initBitModels(null, Base.kNumStates);
        this._isRepG0 = initBitModels(null, Base.kNumStates);
        this._isRepG1 = initBitModels(null, Base.kNumStates);
        this._isRepG2 = initBitModels(null, Base.kNumStates);
        this._isRep0Long = initBitModels(null, Base.kNumStates << Base.kNumPosStatesBitsMax);
        this._posSlotEncoder = [];
        this._posEncoders = initBitModels(null, Base.kNumFullDistances - Base.kEndPosModelIndex);
        this._posAlignEncoder = new RangeCoder.BitTreeEncoder(Base.kNumAlignBits);
        this._lenEncoder = new Encoder.LenPriceTableEncoder();
        this._repMatchLenEncoder = new Encoder.LenPriceTableEncoder();
        this._literalEncoder = new Encoder.LiteralEncoder();
        this._matchDistances = [];
        this._matchDistances.length = Base.kMatchMaxLen * 2 + 2;
        for (i = 0; i < this._matchDistances.length; i++) {
          this._matchDistances[i] = 0;
        }
        this._numFastBytes = kNumFastBytesDefault;
        this._longestMatchLength = 0;
        this._numDistancePairs = 0;
        this._additionalOffset = 0;
        this._optimumEndIndex = 0;
        this._optimumCurrentIndex = 0;
        this._longestMatchWasFound = false;
        this._posSlotPrices = [];
        this._distancesPrices = [];
        this._alignPrices = [];
        this._alignPriceCount = 0;
        this._distTableSize = kDefaultDictionaryLogSize * 2;
        this._posStateBits = 2;
        this._posStateMask = 4 - 1;
        this._numLiteralPosStateBits = 0;
        this._numLiteralContextBits = 3;
        this._dictionarySize = 1 << kDefaultDictionaryLogSize;
        this._dictionarySizePrev = 4294967295;
        this._numFastBytesPrev = 4294967295;
        this.nowPos64 = 0;
        this._finished = false;
        this._inStream = null;
        this._matchFinderType = EMatchFinderTypeBT4;
        this._writeEndMark = false;
        this._needReleaseMFStream = false;
        this.reps = [];
        this.repLens = [];
        this.backRes = 0;
        for (i = 0; i < kNumOpts; i++) {
          this._optimum[i] = new Encoder.Optimal();
        }
        for (i = 0; i < Base.kNumLenToPosStates; i++) {
          this._posSlotEncoder[i] = new RangeCoder.BitTreeEncoder(Base.kNumPosSlotBits);
        }
        this._matchPriceCount = 0;
        this.processedInSize = [0];
        this.processedOutSize = [0];
        this.finished = [false];
      };
      Encoder.prototype.baseInit = function() {
        var i;
        this._state = Base.stateInit();
        this._previousByte = 0;
        for (i = 0; i < Base.kNumRepDistances; i++) {
          this._repDistances[i] = 0;
        }
      };
      var LiteralEncoder = Encoder.LiteralEncoder = function() {
        this._coders = null;
        this._numPrevBits = -1;
        this._numPosBits = -1;
        this._posMask = 0;
      };
      LiteralEncoder.Encoder2 = function() {
        this._encoders = initBitModels(null, 768);
      };
      LiteralEncoder.Encoder2.prototype.init = function() {
        initBitModels(this._encoders);
      };
      LiteralEncoder.Encoder2.prototype.encode = function(rangeEncoder, symbol) {
        var context = 1, i;
        for (i = 7; i >= 0; i--) {
          var bit = symbol >>> i & 1;
          rangeEncoder.encode(this._encoders, context, bit);
          context = context << 1 | bit;
        }
      };
      LiteralEncoder.Encoder2.prototype.encodeMatched = function(rangeEncoder, matchByte, symbol) {
        var context = 1, same = true, i;
        for (i = 7; i >= 0; i--) {
          var bit = symbol >> i & 1;
          var state = context;
          if (same) {
            var matchBit = matchByte >>> i & 1;
            state += 1 + matchBit << 8;
            same = matchBit === bit;
          }
          rangeEncoder.encode(this._encoders, state, bit);
          context = context << 1 | bit;
        }
      };
      LiteralEncoder.Encoder2.prototype.getPrice = function(matchMode, matchByte, symbol) {
        var price = 0;
        var context = 1;
        var i = 7;
        var bit, matchBit;
        if (matchMode) {
          for (; i >= 0; i--) {
            matchBit = matchByte >>> i & 1;
            bit = symbol >>> i & 1;
            price += RangeCoder.Encoder.getPrice(this._encoders[(1 + matchBit << 8) + context], bit);
            context = context << 1 | bit;
            if (matchBit !== bit) {
              i--;
              break;
            }
          }
        }
        for (; i >= 0; i--) {
          bit = symbol >>> i & 1;
          price += RangeCoder.Encoder.getPrice(this._encoders[context], bit);
          context = context << 1 | bit;
        }
        return price;
      };
      LiteralEncoder.prototype.create = function(numPosBits, numPrevBits) {
        var i;
        if (this._coders && this._numPrevBits === numPrevBits && this._numPosBits === numPosBits) {
          return;
        }
        this._numPosBits = numPosBits;
        this._posMask = (1 << numPosBits) - 1;
        this._numPrevBits = numPrevBits;
        var numStates = 1 << this._numPrevBits + this._numPosBits;
        this._coders = [];
        for (i = 0; i < numStates; i++) {
          this._coders[i] = new LiteralEncoder.Encoder2();
        }
      };
      LiteralEncoder.prototype.init = function() {
        var numStates = 1 << this._numPrevBits + this._numPosBits, i;
        for (i = 0; i < numStates; i++) {
          this._coders[i].init();
        }
      };
      LiteralEncoder.prototype.getSubCoder = function(pos, prevByte) {
        return this._coders[((pos & this._posMask) << this._numPrevBits) + (prevByte >> 8 - this._numPrevBits)];
      };
      var LenEncoder = Encoder.LenEncoder = function() {
        var posState;
        this._choice = initBitModels(null, 2);
        this._lowCoder = [];
        this._midCoder = [];
        this._highCoder = new RangeCoder.BitTreeEncoder(Base.kNumHighLenBits);
        for (posState = 0; posState < Base.kNumPosStatesEncodingMax; posState++) {
          this._lowCoder[posState] = new RangeCoder.BitTreeEncoder(Base.kNumLowLenBits);
          this._midCoder[posState] = new RangeCoder.BitTreeEncoder(Base.kNumMidLenBits);
        }
      };
      LenEncoder.prototype.init = function(numPosStates) {
        var posState;
        initBitModels(this._choice);
        for (posState = 0; posState < numPosStates; posState++) {
          this._lowCoder[posState].init();
          this._midCoder[posState].init();
        }
        this._highCoder.init();
      };
      LenEncoder.prototype.encode = function(rangeEncoder, symbol, posState) {
        if (symbol < Base.kNumLowLenSymbols) {
          rangeEncoder.encode(this._choice, 0, 0);
          this._lowCoder[posState].encode(rangeEncoder, symbol);
        } else {
          symbol -= Base.kNumLowLenSymbols;
          rangeEncoder.encode(this._choice, 0, 1);
          if (symbol < Base.kNumMidLenSymbols) {
            rangeEncoder.encode(this._choice, 1, 0);
            this._midCoder[posState].encode(rangeEncoder, symbol);
          } else {
            rangeEncoder.encode(this._choice, 1, 1);
            this._highCoder.encode(rangeEncoder, symbol - Base.kNumMidLenSymbols);
          }
        }
      };
      LenEncoder.prototype.setPrices = function(posState, numSymbols, prices, st) {
        var a0 = RangeCoder.Encoder.getPrice0(this._choice[0]);
        var a1 = RangeCoder.Encoder.getPrice1(this._choice[0]);
        var b0 = a1 + RangeCoder.Encoder.getPrice0(this._choice[1]);
        var b1 = a1 + RangeCoder.Encoder.getPrice1(this._choice[1]);
        var i;
        for (i = 0; i < Base.kNumLowLenSymbols; i++) {
          if (i >= numSymbols) {
            return;
          }
          prices[st + i] = a0 + this._lowCoder[posState].getPrice(i);
        }
        for (; i < Base.kNumLowLenSymbols + Base.kNumMidLenSymbols; i++) {
          if (i >= numSymbols) {
            return;
          }
          prices[st + i] = b0 + this._midCoder[posState].getPrice(i - Base.kNumLowLenSymbols);
        }
        for (; i < numSymbols; i++) {
          prices[st + i] = b1 + this._highCoder.getPrice(i - Base.kNumLowLenSymbols - Base.kNumMidLenSymbols);
        }
      };
      var kNumLenSpecSymbols = Base.kNumLowLenSymbols + Base.kNumMidLenSymbols;
      var LenPriceTableEncoder = Encoder.LenPriceTableEncoder = function() {
        LenEncoder.call(this);
        this._prices = [];
        this._counters = [];
        this._tableSize = 0;
      };
      LenPriceTableEncoder.prototype = Object.create(LenEncoder.prototype);
      LenPriceTableEncoder.prototype.setTableSize = function(tableSize) {
        this._tableSize = tableSize;
      };
      LenPriceTableEncoder.prototype.getPrice = function(symbol, posState) {
        return this._prices[posState * Base.kNumLenSymbols + symbol];
      };
      LenPriceTableEncoder.prototype.updateTable = function(posState) {
        this.setPrices(
          posState,
          this._tableSize,
          this._prices,
          posState * Base.kNumLenSymbols
        );
        this._counters[posState] = this._tableSize;
      };
      LenPriceTableEncoder.prototype.updateTables = function(numPosStates) {
        var posState;
        for (posState = 0; posState < numPosStates; posState++) {
          this.updateTable(posState);
        }
      };
      LenPriceTableEncoder.prototype.encode = /* @__PURE__ */ (function(superEncode) {
        return function(rangeEncoder, symbol, posState) {
          superEncode.call(this, rangeEncoder, symbol, posState);
          if (--this._counters[posState] === 0) {
            this.updateTable(posState);
          }
        };
      })(LenPriceTableEncoder.prototype.encode);
      var Optimal = Encoder.Optimal = function() {
        this.state = 0;
        this.prev1IsChar = false;
        this.prev2 = false;
        this.posPrev2 = 0;
        this.backPrev2 = 0;
        this.price = 0;
        this.posPrev = 0;
        this.backPrev = 0;
        this.backs0 = 0;
        this.backs1 = 0;
        this.backs2 = 0;
        this.backs3 = 0;
      };
      Optimal.prototype.makeAsChar = function() {
        this.backPrev = -1;
        this.prev1IsChar = false;
      };
      Optimal.prototype.makeAsShortRep = function() {
        this.backPrev = 0;
        this.prev1IsChar = false;
      };
      Optimal.prototype.isShortRep = function() {
        return this.backPrev === 0;
      };
      Encoder.prototype.create = function() {
        var numHashBytes;
        if (!this._matchFinder) {
          var bt = new LZ.BinTree();
          numHashBytes = 4;
          if (this._matchFinderType === EMatchFinderTypeBT2) {
            numHashBytes = 2;
          }
          bt.setType(numHashBytes);
          this._matchFinder = bt;
        }
        this._literalEncoder.create(
          this._numLiteralPosStateBits,
          this._numLiteralContextBits
        );
        if (this._dictionarySize === this._dictionarySizePrev && this._numFastBytesPrev === this._numFastBytes) {
          return;
        }
        this._matchFinder.create(
          this._dictionarySize,
          kNumOpts,
          this._numFastBytes,
          Base.kMatchMaxLen + 1
        );
        this._dictionarySizePrev = this._dictionarySize;
        this._numFastBytesPrev = this._numFastBytes;
      };
      Encoder.prototype.setWriteEndMarkerMode = function(writeEndMarker) {
        this._writeEndMark = writeEndMarker;
      };
      Encoder.prototype.init = function() {
        var i;
        this.baseInit();
        this._rangeEncoder.init();
        initBitModels(this._isMatch);
        initBitModels(this._isRep0Long);
        initBitModels(this._isRep);
        initBitModels(this._isRepG0);
        initBitModels(this._isRepG1);
        initBitModels(this._isRepG2);
        initBitModels(this._posEncoders);
        this._literalEncoder.init();
        for (i = 0; i < Base.kNumLenToPosStates; i++) {
          this._posSlotEncoder[i].init();
        }
        this._lenEncoder.init(1 << this._posStateBits);
        this._repMatchLenEncoder.init(1 << this._posStateBits);
        this._posAlignEncoder.init();
        this._longestMatchWasFound = false;
        this._optimumEndIndex = 0;
        this._optimumCurrentIndex = 0;
        this._additionalOffset = 0;
      };
      Encoder.prototype.readMatchDistances = function() {
        var lenRes = 0;
        this._numDistancePairs = this._matchFinder.getMatches(this._matchDistances);
        if (this._numDistancePairs > 0) {
          lenRes = this._matchDistances[this._numDistancePairs - 2];
          if (lenRes === this._numFastBytes) {
            lenRes += this._matchFinder.getMatchLen(lenRes - 1, this._matchDistances[this._numDistancePairs - 1], Base.kMatchMaxLen - lenRes);
          }
        }
        this._additionalOffset++;
        return lenRes;
      };
      Encoder.prototype.movePos = function(num) {
        if (num > 0) {
          this._matchFinder.skip(num);
          this._additionalOffset += num;
        }
      };
      Encoder.prototype.getRepLen1Price = function(state, posState) {
        return RangeCoder.Encoder.getPrice0(this._isRepG0[state]) + RangeCoder.Encoder.getPrice0(this._isRep0Long[(state << Base.kNumPosStatesBitsMax) + posState]);
      };
      Encoder.prototype.getPureRepPrice = function(repIndex, state, posState) {
        var price;
        if (repIndex === 0) {
          price = RangeCoder.Encoder.getPrice0(this._isRepG0[state]);
          price += RangeCoder.Encoder.getPrice1(this._isRep0Long[(state << Base.kNumPosStatesBitsMax) + posState]);
        } else {
          price = RangeCoder.Encoder.getPrice1(this._isRepG0[state]);
          if (repIndex === 1) {
            price += RangeCoder.Encoder.getPrice0(this._isRepG1[state]);
          } else {
            price += RangeCoder.Encoder.getPrice1(this._isRepG1[state]);
            price += RangeCoder.Encoder.getPrice(this._isRepG2[state], repIndex - 2);
          }
        }
        return price;
      };
      Encoder.prototype.getRepPrice = function(repIndex, len, state, posState) {
        var price = this._repMatchLenEncoder.getPrice(len - Base.kMatchMinLen, posState);
        return price + this.getPureRepPrice(repIndex, state, posState);
      };
      Encoder.prototype.getPosLenPrice = function(pos, len, posState) {
        var price;
        var lenToPosState = Base.getLenToPosState(len);
        if (pos < Base.kNumFullDistances) {
          price = this._distancesPrices[lenToPosState * Base.kNumFullDistances + pos];
        } else {
          price = this._posSlotPrices[(lenToPosState << Base.kNumPosSlotBits) + getPosSlot2(pos)] + this._alignPrices[pos & Base.kAlignMask];
        }
        return price + this._lenEncoder.getPrice(len - Base.kMatchMinLen, posState);
      };
      Encoder.prototype.backward = function(cur) {
        this._optimumEndIndex = cur;
        var posMem = this._optimum[cur].posPrev;
        var backMem = this._optimum[cur].backPrev;
        do {
          if (this._optimum[cur].prev1IsChar) {
            this._optimum[posMem].makeAsChar();
            this._optimum[posMem].posPrev = posMem - 1;
            if (this._optimum[cur].prev2) {
              this._optimum[posMem - 1].prev1IsChar = false;
              this._optimum[posMem - 1].posPrev = this._optimum[cur].posPrev2;
              this._optimum[posMem - 1].backPrev = this._optimum[cur].backPrev2;
            }
          }
          var posPrev = posMem;
          var backCur = backMem;
          backMem = this._optimum[posPrev].backPrev;
          posMem = this._optimum[posPrev].posPrev;
          this._optimum[posPrev].backPrev = backCur;
          this._optimum[posPrev].posPrev = cur;
          cur = posPrev;
        } while (cur > 0);
        this.backRes = this._optimum[0].backPrev;
        this._optimumCurrentIndex = this._optimum[0].posPrev;
        return this._optimumCurrentIndex;
      };
      Encoder.prototype.getOptimum = function(position) {
        if (this._optimumEndIndex !== this._optimumCurrentIndex) {
          var lenRes = this._optimum[this._optimumCurrentIndex].posPrev - this._optimumCurrentIndex;
          this.backRes = this._optimum[this._optimumCurrentIndex].backPrev;
          this._optimumCurrentIndex = this._optimum[this._optimumCurrentIndex].posPrev;
          return lenRes;
        }
        this._optimumCurrentIndex = this._optimumEndIndex = 0;
        var lenMain;
        if (!this._longestMatchWasFound) {
          lenMain = this.readMatchDistances();
        } else {
          lenMain = this._longestMatchLength;
          this._longestMatchWasFound = false;
        }
        var numDistancePairs = this._numDistancePairs;
        var numAvailableBytes = this._matchFinder.getNumAvailableBytes() + 1;
        if (numAvailableBytes < 2) {
          this.backRes = -1;
          return 1;
        }
        if (numAvailableBytes > Base.kMatchMaxLen) {
          numAvailableBytes = Base.kMatchMaxLen;
        }
        var repMaxIndex = 0, i;
        for (i = 0; i < Base.kNumRepDistances; i++) {
          this.reps[i] = this._repDistances[i];
          this.repLens[i] = this._matchFinder.getMatchLen(-1, this.reps[i], Base.kMatchMaxLen);
          if (this.repLens[i] > this.repLens[repMaxIndex]) {
            repMaxIndex = i;
          }
        }
        if (this.repLens[repMaxIndex] >= this._numFastBytes) {
          this.backRes = repMaxIndex;
          var lenRes2 = this.repLens[repMaxIndex];
          this.movePos(lenRes2 - 1);
          return lenRes2;
        }
        if (lenMain >= this._numFastBytes) {
          this.backRes = this._matchDistances[numDistancePairs - 1] + Base.kNumRepDistances;
          this.movePos(lenMain - 1);
          return lenMain;
        }
        var currentByte = this._matchFinder.getIndexByte(-1);
        var matchByte = this._matchFinder.getIndexByte(-this._repDistances[0] - 2);
        if (lenMain < 2 && currentByte !== matchByte && this.repLens[repMaxIndex] < 2) {
          this.backRes = -1;
          return 1;
        }
        this._optimum[0].state = this._state;
        var posState = position & this._posStateMask;
        this._optimum[1].price = RangeCoder.Encoder.getPrice0(this._isMatch[(this._state << Base.kNumPosStatesBitsMax) + posState]) + this._literalEncoder.getSubCoder(position, this._previousByte).getPrice(!Base.stateIsCharState(this._state), matchByte, currentByte);
        this._optimum[1].makeAsChar();
        var matchPrice = RangeCoder.Encoder.getPrice1(this._isMatch[(this._state << Base.kNumPosStatesBitsMax) + posState]);
        var repMatchPrice = matchPrice + RangeCoder.Encoder.getPrice1(this._isRep[this._state]);
        if (matchByte === currentByte) {
          var shortRepPrice = repMatchPrice + this.getRepLen1Price(this._state, posState);
          if (shortRepPrice < this._optimum[1].price) {
            this._optimum[1].price = shortRepPrice;
            this._optimum[1].makeAsShortRep();
          }
        }
        var lenEnd = lenMain >= this.repLens[repMaxIndex] ? lenMain : this.repLens[repMaxIndex];
        if (lenEnd < 2) {
          this.backRes = this._optimum[1].backPrev;
          return 1;
        }
        this._optimum[1].posPrev = 0;
        this._optimum[0].backs0 = this.reps[0];
        this._optimum[0].backs1 = this.reps[1];
        this._optimum[0].backs2 = this.reps[2];
        this._optimum[0].backs3 = this.reps[3];
        var len = lenEnd;
        do {
          this._optimum[len--].price = kInfinityPrice;
        } while (len >= 2);
        for (i = 0; i < Base.kNumRepDistances; i++) {
          var repLen = this.repLens[i];
          if (repLen < 2) {
            continue;
          }
          var price = repMatchPrice + this.getPureRepPrice(i, this._state, posState);
          do {
            var curAndLenPrice = price + this._repMatchLenEncoder.getPrice(repLen - 2, posState);
            var optimum = this._optimum[repLen];
            if (curAndLenPrice < optimum.price) {
              optimum.price = curAndLenPrice;
              optimum.posPrev = 0;
              optimum.backPrev = i;
              optimum.prev1IsChar = false;
            }
          } while (--repLen >= 2);
        }
        var normalMatchPrice = matchPrice + RangeCoder.Encoder.getPrice0(this._isRep[this._state]);
        len = this.repLens[0] >= 2 ? this.repLens[0] + 1 : 2;
        if (len <= lenMain) {
          var offs = 0;
          while (len > this._matchDistances[offs]) {
            offs += 2;
          }
          for (; ; len++) {
            var distance = this._matchDistances[offs + 1];
            var curAndLenPrice2 = normalMatchPrice + this.getPosLenPrice(distance, len, posState);
            var optimum2 = this._optimum[len];
            if (curAndLenPrice2 < optimum2.price) {
              optimum2.price = curAndLenPrice2;
              optimum2.posPrev = 0;
              optimum2.backPrev = distance + Base.kNumRepDistances;
              optimum2.prev1IsChar = false;
            }
            if (len === this._matchDistances[offs]) {
              offs += 2;
              if (offs === numDistancePairs) {
                break;
              }
            }
          }
        }
        var cur = 0;
        while (true) {
          cur++;
          if (cur === lenEnd) {
            return this.backward(cur);
          }
          var newLen = this.readMatchDistances();
          numDistancePairs = this._numDistancePairs;
          if (newLen >= this._numFastBytes) {
            this._longestMatchLength = newLen;
            this._longestMatchWasFound = true;
            return this.backward(cur);
          }
          position++;
          var posPrev = this._optimum[cur].posPrev;
          var state;
          if (this._optimum[cur].prev1IsChar) {
            posPrev--;
            if (this._optimum[cur].prev2) {
              state = this._optimum[this._optimum[cur].posPrev2].state;
              if (this._optimum[cur].backPrev2 < Base.kNumRepDistances) {
                state = Base.stateUpdateRep(state);
              } else {
                state = Base.stateUpdateMatch(state);
              }
            } else {
              state = this._optimum[posPrev].state;
            }
            state = Base.stateUpdateChar(state);
          } else {
            state = this._optimum[posPrev].state;
          }
          if (posPrev === cur - 1) {
            if (this._optimum[cur].isShortRep()) {
              state = Base.stateUpdateShortRep(state);
            } else {
              state = Base.stateUpdateChar(state);
            }
          } else {
            var pos;
            if (this._optimum[cur].prev1IsChar && this._optimum[cur].prev2) {
              posPrev = this._optimum[cur].posPrev2;
              pos = this._optimum[cur].backPrev2;
              state = Base.stateUpdateRep(state);
            } else {
              pos = this._optimum[cur].backPrev;
              if (pos < Base.kNumRepDistances) {
                state = Base.stateUpdateRep(state);
              } else {
                state = Base.stateUpdateMatch(state);
              }
            }
            var opt = this._optimum[posPrev];
            if (pos < Base.kNumRepDistances) {
              if (pos === 0) {
                this.reps[0] = opt.backs0;
                this.reps[1] = opt.backs1;
                this.reps[2] = opt.backs2;
                this.reps[3] = opt.backs3;
              } else if (pos === 1) {
                this.reps[0] = opt.backs1;
                this.reps[1] = opt.backs0;
                this.reps[2] = opt.backs2;
                this.reps[3] = opt.backs3;
              } else if (pos === 2) {
                this.reps[0] = opt.backs2;
                this.reps[1] = opt.backs0;
                this.reps[2] = opt.backs1;
                this.reps[3] = opt.backs3;
              } else {
                this.reps[0] = opt.backs3;
                this.reps[1] = opt.backs0;
                this.reps[2] = opt.backs1;
                this.reps[3] = opt.backs2;
              }
            } else {
              this.reps[0] = pos - Base.kNumRepDistances;
              this.reps[1] = opt.backs0;
              this.reps[2] = opt.backs1;
              this.reps[3] = opt.backs2;
            }
          }
          this._optimum[cur].state = state;
          this._optimum[cur].backs0 = this.reps[0];
          this._optimum[cur].backs1 = this.reps[1];
          this._optimum[cur].backs2 = this.reps[2];
          this._optimum[cur].backs3 = this.reps[3];
          var curPrice = this._optimum[cur].price;
          currentByte = this._matchFinder.getIndexByte(-1);
          matchByte = this._matchFinder.getIndexByte(-this.reps[0] - 2);
          posState = position & this._posStateMask;
          var curAnd1Price = curPrice + RangeCoder.Encoder.getPrice0(this._isMatch[(state << Base.kNumPosStatesBitsMax) + posState]) + this._literalEncoder.getSubCoder(position, this._matchFinder.getIndexByte(-2)).getPrice(!Base.stateIsCharState(state), matchByte, currentByte);
          var nextOptimum = this._optimum[cur + 1];
          var nextIsChar = false;
          if (curAnd1Price < nextOptimum.price) {
            nextOptimum.price = curAnd1Price;
            nextOptimum.posPrev = cur;
            nextOptimum.makeAsChar();
            nextIsChar = true;
          }
          matchPrice = curPrice + RangeCoder.Encoder.getPrice1(this._isMatch[(state << Base.kNumPosStatesBitsMax) + posState]);
          repMatchPrice = matchPrice + RangeCoder.Encoder.getPrice1(this._isRep[state]);
          if (matchByte === currentByte && !(nextOptimum.posPrev < cur && nextOptimum.backPrev === 0)) {
            var shortRepPrice2 = repMatchPrice + this.getRepLen1Price(state, posState);
            if (shortRepPrice2 <= nextOptimum.price) {
              nextOptimum.price = shortRepPrice2;
              nextOptimum.posPrev = cur;
              nextOptimum.makeAsShortRep();
              nextIsChar = true;
            }
          }
          var numAvailableBytesFull = this._matchFinder.getNumAvailableBytes() + 1;
          numAvailableBytesFull = Math.min(kNumOpts - 1 - cur, numAvailableBytesFull);
          numAvailableBytes = numAvailableBytesFull;
          if (numAvailableBytes < 2) {
            continue;
          }
          if (numAvailableBytes > this._numFastBytes) {
            numAvailableBytes = this._numFastBytes;
          }
          if (!nextIsChar && matchByte !== currentByte) {
            var t = Math.min(numAvailableBytesFull - 1, this._numFastBytes);
            var lenTest2 = this._matchFinder.getMatchLen(0, this.reps[0], t);
            if (lenTest2 >= 2) {
              var state2 = Base.stateUpdateChar(state);
              var posStateNext = position + 1 & this._posStateMask;
              var nextRepMatchPrice = curAnd1Price + RangeCoder.Encoder.getPrice1(this._isMatch[(state2 << Base.kNumPosStatesBitsMax) + posStateNext]) + RangeCoder.Encoder.getPrice1(this._isRep[state2]);
              var offset = cur + 1 + lenTest2;
              while (lenEnd < offset) {
                this._optimum[++lenEnd].price = kInfinityPrice;
              }
              var curAndLenPrice3 = nextRepMatchPrice + this.getRepPrice(0, lenTest2, state2, posStateNext);
              var optimum3 = this._optimum[offset];
              if (curAndLenPrice3 < optimum3.price) {
                optimum3.price = curAndLenPrice3;
                optimum3.posPrev = cur + 1;
                optimum3.backPrev = 0;
                optimum3.prev1IsChar = true;
                optimum3.prev2 = false;
              }
            }
          }
          var startLen = 2;
          var repIndex;
          for (repIndex = 0; repIndex < Base.kNumRepDistances; repIndex++) {
            var lenTest = this._matchFinder.getMatchLen(-1, this.reps[repIndex], numAvailableBytes);
            if (lenTest < 2) {
              continue;
            }
            var lenTestTemp = lenTest;
            do {
              while (lenEnd < cur + lenTest) {
                this._optimum[++lenEnd].price = kInfinityPrice;
              }
              var curAndLenPrice4 = repMatchPrice + this.getRepPrice(repIndex, lenTest, state, posState);
              var optimum4 = this._optimum[cur + lenTest];
              if (curAndLenPrice4 < optimum4.price) {
                optimum4.price = curAndLenPrice4;
                optimum4.posPrev = cur;
                optimum4.backPrev = repIndex;
                optimum4.prev1IsChar = false;
              }
            } while (--lenTest >= 2);
            lenTest = lenTestTemp;
            if (repIndex === 0) {
              startLen = lenTest + 1;
            }
            if (lenTest < numAvailableBytesFull) {
              var t5 = Math.min(numAvailableBytesFull - 1 - lenTest, this._numFastBytes);
              var lenTest25 = this._matchFinder.getMatchLen(lenTest, this.reps[repIndex], t5);
              if (lenTest25 >= 2) {
                var state25 = Base.stateUpdateRep(state);
                var posStateNext5 = position + lenTest & this._posStateMask;
                var curAndLenCharPrice = repMatchPrice + this.getRepPrice(repIndex, lenTest, state, posState) + RangeCoder.Encoder.getPrice0(this._isMatch[(state25 << Base.kNumPosStatesBitsMax) + posStateNext5]) + this._literalEncoder.getSubCoder(
                  position + lenTest,
                  this._matchFinder.getIndexByte(lenTest - 2)
                ).getPrice(
                  true,
                  this._matchFinder.getIndexByte(lenTest - 1 - (this.reps[repIndex] + 1)),
                  this._matchFinder.getIndexByte(lenTest - 1)
                );
                state25 = Base.stateUpdateChar(state25);
                posStateNext5 = position + lenTest + 1 & this._posStateMask;
                var nextMatchPrice5 = curAndLenCharPrice + RangeCoder.Encoder.getPrice1(this._isMatch[(state25 << Base.kNumPosStatesBitsMax) + posStateNext5]);
                var nextRepMatchPrice5 = nextMatchPrice5 + RangeCoder.Encoder.getPrice1(this._isRep[state25]);
                var offset5 = lenTest + 1 + lenTest25;
                while (lenEnd < cur + offset5) {
                  this._optimum[++lenEnd].price = kInfinityPrice;
                }
                var curAndLenPrice5 = nextRepMatchPrice5 + this.getRepPrice(0, lenTest25, state25, posStateNext5);
                var optimum5 = this._optimum[cur + offset5];
                if (curAndLenPrice5 < optimum5.price) {
                  optimum5.price = curAndLenPrice5;
                  optimum5.posPrev = cur + lenTest + 1;
                  optimum5.backPrev = 0;
                  optimum5.prev1IsChar = true;
                  optimum5.prev2 = true;
                  optimum5.posPrev2 = cur;
                  optimum5.backPrev2 = repIndex;
                }
              }
            }
          }
          if (newLen > numAvailableBytes) {
            newLen = numAvailableBytes;
            numDistancePairs = 0;
            while (newLen > this._matchDistances[numDistancePairs]) {
              numDistancePairs += 2;
            }
            this._matchDistances[numDistancePairs] = newLen;
            numDistancePairs += 2;
          }
          if (newLen >= startLen) {
            normalMatchPrice = matchPrice + RangeCoder.Encoder.getPrice0(this._isRep[state]);
            while (lenEnd < cur + newLen) {
              this._optimum[++lenEnd].price = kInfinityPrice;
            }
            var offs6 = 0;
            while (startLen > this._matchDistances[offs6]) {
              offs6 += 2;
            }
            var lenTest6;
            for (lenTest6 = startLen; ; lenTest6++) {
              var curBack = this._matchDistances[offs6 + 1];
              var curAndLenPrice6 = normalMatchPrice + this.getPosLenPrice(curBack, lenTest6, posState);
              var optimum6 = this._optimum[cur + lenTest6];
              if (curAndLenPrice6 < optimum6.price) {
                optimum6.price = curAndLenPrice6;
                optimum6.posPrev = cur;
                optimum6.backPrev = curBack + Base.kNumRepDistances;
                optimum6.prev1IsChar = false;
              }
              if (lenTest6 === this._matchDistances[offs6]) {
                if (lenTest6 < numAvailableBytesFull) {
                  var t7 = Math.min(
                    numAvailableBytesFull - 1 - lenTest6,
                    this._numFastBytes
                  );
                  var lenTest27 = this._matchFinder.getMatchLen(lenTest6, curBack, t7);
                  if (lenTest27 >= 2) {
                    var state27 = Base.stateUpdateMatch(state);
                    var posStateNext7 = position + lenTest6 & this._posStateMask;
                    var curAndLenCharPrice7 = curAndLenPrice6 + RangeCoder.Encoder.getPrice0(this._isMatch[(state27 << Base.kNumPosStatesBitsMax) + posStateNext7]) + this._literalEncoder.getSubCoder(
                      position + lenTest6,
                      this._matchFinder.getIndexByte(lenTest6 - 2)
                    ).getPrice(
                      true,
                      this._matchFinder.getIndexByte(lenTest6 - (curBack + 1) - 1),
                      this._matchFinder.getIndexByte(lenTest6 - 1)
                    );
                    state27 = Base.stateUpdateChar(state27);
                    posStateNext7 = position + lenTest6 + 1 & this._posStateMask;
                    var nextMatchPrice7 = curAndLenCharPrice7 + RangeCoder.Encoder.getPrice1(this._isMatch[(state27 << Base.kNumPosStatesBitsMax) + posStateNext7]);
                    var nextRepMatchPrice7 = nextMatchPrice7 + RangeCoder.Encoder.getPrice1(this._isRep[state27]);
                    var offset7 = lenTest6 + 1 + lenTest27;
                    while (lenEnd < cur + offset7) {
                      this._optimum[++lenEnd].price = kInfinityPrice;
                    }
                    var curAndLenPrice7 = nextRepMatchPrice7 + this.getRepPrice(0, lenTest27, state27, posStateNext7);
                    var optimum7 = this._optimum[cur + offset7];
                    if (curAndLenPrice7 < optimum7.price) {
                      optimum7.price = curAndLenPrice7;
                      optimum7.posPrev = cur + lenTest6 + 1;
                      optimum7.backPrev = 0;
                      optimum7.prev1IsChar = true;
                      optimum7.prev2 = true;
                      optimum7.posPrev2 = cur;
                      optimum7.backPrev2 = curBack + Base.kNumRepDistances;
                    }
                  }
                }
                offs6 += 2;
                if (offs6 === numDistancePairs) {
                  break;
                }
              }
            }
          }
        }
      };
      Encoder.prototype.changePair = function(smallDist, bigDist) {
        var kDif = 7;
        return smallDist < 1 << 32 - kDif && bigDist >= smallDist << kDif;
      };
      Encoder.prototype.writeEndMarker = function(posState) {
        if (!this._writeEndMark) {
          return;
        }
        this._rangeEncoder.encode(this._isMatch, (this._state << Base.kNumPosStatesBitsMax) + posState, 1);
        this._rangeEncoder.encode(this._isRep, this._state, 0);
        this._state = Base.stateUpdateMatch(this._state);
        var len = Base.kMatchMinLen;
        this._lenEncoder.encode(this._rangeEncoder, len - Base.kMatchMinLen, posState);
        var posSlot = (1 << Base.kNumPosSlotBits) - 1;
        var lenToPosState = Base.getLenToPosState(len);
        this._posSlotEncoder[lenToPosState].encode(this._rangeEncoder, posSlot);
        var footerBits = 30;
        var posReduced = (1 << footerBits) - 1;
        this._rangeEncoder.encodeDirectBits(
          posReduced >> Base.kNumAlignBits,
          footerBits - Base.kNumAlignBits
        );
        this._posAlignEncoder.reverseEncode(
          this._rangeEncoder,
          posReduced & Base.kAlignMask
        );
      };
      Encoder.prototype.flush = function(nowPos) {
        this.releaseMFStream();
        this.writeEndMarker(nowPos & this._posStateMask);
        this._rangeEncoder.flushData();
        this._rangeEncoder.flushStream();
      };
      Encoder.prototype.codeOneBlock = function(inSize, outSize, finished) {
        inSize[0] = 0;
        outSize[0] = 0;
        finished[0] = true;
        if (this._inStream) {
          this._matchFinder.setStream(this._inStream);
          this._matchFinder.init();
          this._needReleaseMFStream = true;
          this._inStream = null;
        }
        if (this._finished) {
          return;
        }
        this._finished = true;
        var progressPosValuePrev = this.nowPos64;
        var posState, curByte, i;
        if (this.nowPos64 === 0) {
          if (this._matchFinder.getNumAvailableBytes() === 0) {
            this.flush(this.nowPos64);
            return;
          }
          this.readMatchDistances();
          posState = this.nowPos64 & this._posStateMask;
          this._rangeEncoder.encode(this._isMatch, (this._state << Base.kNumPosStatesBitsMax) + posState, 0);
          this._state = Base.stateUpdateChar(this._state);
          curByte = this._matchFinder.getIndexByte(0 - this._additionalOffset);
          this._literalEncoder.getSubCoder(this.nowPos64, this._previousByte).encode(this._rangeEncoder, curByte);
          this._previousByte = curByte;
          this._additionalOffset--;
          this.nowPos64++;
        }
        if (this._matchFinder.getNumAvailableBytes() === 0) {
          this.flush(this.nowPos64);
          return;
        }
        while (true) {
          var len = this.getOptimum(this.nowPos64);
          var pos = this.backRes;
          posState = this.nowPos64 & this._posStateMask;
          var complexState = (this._state << Base.kNumPosStatesBitsMax) + posState;
          if (len === 1 && pos === -1) {
            this._rangeEncoder.encode(this._isMatch, complexState, 0);
            curByte = this._matchFinder.getIndexByte(-this._additionalOffset);
            var subCoder = this._literalEncoder.getSubCoder(
              this.nowPos64,
              this._previousByte
            );
            if (!Base.stateIsCharState(this._state)) {
              var matchByte = this._matchFinder.getIndexByte(-this._repDistances[0] - 1 - this._additionalOffset);
              subCoder.encodeMatched(this._rangeEncoder, matchByte, curByte);
            } else {
              subCoder.encode(this._rangeEncoder, curByte);
            }
            this._previousByte = curByte;
            this._state = Base.stateUpdateChar(this._state);
          } else {
            this._rangeEncoder.encode(this._isMatch, complexState, 1);
            if (pos < Base.kNumRepDistances) {
              this._rangeEncoder.encode(this._isRep, this._state, 1);
              if (pos === 0) {
                this._rangeEncoder.encode(this._isRepG0, this._state, 0);
                if (len === 1) {
                  this._rangeEncoder.encode(this._isRep0Long, complexState, 0);
                } else {
                  this._rangeEncoder.encode(this._isRep0Long, complexState, 1);
                }
              } else {
                this._rangeEncoder.encode(this._isRepG0, this._state, 1);
                if (pos === 1) {
                  this._rangeEncoder.encode(this._isRepG1, this._state, 0);
                } else {
                  this._rangeEncoder.encode(this._isRepG1, this._state, 1);
                  this._rangeEncoder.encode(this._isRepG2, this._state, pos - 2);
                }
              }
              if (len === 1) {
                this._state = Base.stateUpdateShortRep(this._state);
              } else {
                this._repMatchLenEncoder.encode(
                  this._rangeEncoder,
                  len - Base.kMatchMinLen,
                  posState
                );
                this._state = Base.stateUpdateRep(this._state);
              }
              var distance = this._repDistances[pos];
              if (pos !== 0) {
                for (i = pos; i >= 1; i--) {
                  this._repDistances[i] = this._repDistances[i - 1];
                }
                this._repDistances[0] = distance;
              }
            } else {
              this._rangeEncoder.encode(this._isRep, this._state, 0);
              this._state = Base.stateUpdateMatch(this._state);
              this._lenEncoder.encode(
                this._rangeEncoder,
                len - Base.kMatchMinLen,
                posState
              );
              pos -= Base.kNumRepDistances;
              var posSlot = getPosSlot(pos);
              var lenToPosState = Base.getLenToPosState(len);
              this._posSlotEncoder[lenToPosState].encode(this._rangeEncoder, posSlot);
              if (posSlot >= Base.kStartPosModelIndex) {
                var footerBits = (posSlot >>> 1) - 1;
                var baseVal = (2 | posSlot & 1) << footerBits;
                var posReduced = pos - baseVal;
                if (posSlot < Base.kEndPosModelIndex) {
                  RangeCoder.BitTreeEncoder.reverseEncode(
                    this._posEncoders,
                    baseVal - posSlot - 1,
                    this._rangeEncoder,
                    footerBits,
                    posReduced
                  );
                } else {
                  this._rangeEncoder.encodeDirectBits(posReduced >> Base.kNumAlignBits, footerBits - Base.kNumAlignBits);
                  this._posAlignEncoder.reverseEncode(
                    this._rangeEncoder,
                    posReduced & Base.kAlignMask
                  );
                  this._alignPriceCount++;
                }
              }
              var distance2 = pos;
              for (i = Base.kNumRepDistances - 1; i >= 1; i--) {
                this._repDistances[i] = this._repDistances[i - 1];
              }
              this._repDistances[0] = distance2;
              this._matchPriceCount++;
            }
            this._previousByte = this._matchFinder.getIndexByte(len - 1 - this._additionalOffset);
          }
          this._additionalOffset -= len;
          this.nowPos64 += len;
          if (this._additionalOffset === 0) {
            if (this._matchPriceCount >= 1 << 7) {
              this.fillDistancesPrices();
            }
            if (this._alignPriceCount >= Base.kAlignTableSize) {
              this.fillAlignPrices();
            }
            inSize[0] = this.nowPos64;
            outSize[0] = this._rangeEncoder.getProcessedSizeAdd();
            if (this._matchFinder.getNumAvailableBytes() === 0) {
              this.flush(this.nowPos64);
              return;
            }
            if (this.nowPos64 - progressPosValuePrev >= 1 << 12) {
              this._finished = false;
              finished[0] = false;
              return;
            }
          }
        }
      };
      Encoder.prototype.releaseMFStream = function() {
        if (this._matchFinder && this._needReleaseMFStream) {
          this._matchFinder.releaseStream();
          this._needReleaseMFStream = false;
        }
      };
      Encoder.prototype.setOutStream = function(outStream) {
        this._rangeEncoder.setStream(outStream);
      };
      Encoder.prototype.releaseOutStream = function() {
        this._rangeEncoder.releaseStream();
      };
      Encoder.prototype.releaseStreams = function() {
        this.releaseMFStream();
        this.releaseOutStream();
      };
      Encoder.prototype.setStreams = function(inStream, outStream, inSize, outSize) {
        this._inStream = inStream;
        this._finished = false;
        this.create();
        this.setOutStream(outStream);
        this.init();
        if (true) {
          this.fillDistancesPrices();
          this.fillAlignPrices();
        }
        this._lenEncoder.setTableSize(this._numFastBytes + 1 - Base.kMatchMinLen);
        this._lenEncoder.updateTables(1 << this._posStateBits);
        this._repMatchLenEncoder.setTableSize(this._numFastBytes + 1 - Base.kMatchMinLen);
        this._repMatchLenEncoder.updateTables(1 << this._posStateBits);
        this.nowPos64 = 0;
      };
      Encoder.prototype.code = function(inStream, outStream, inSize, outSize, progress) {
        this._needReleaseMFStream = false;
        try {
          this.setStreams(inStream, outStream, inSize, outSize);
          while (true) {
            this.codeOneBlock(
              this.processedInSize,
              this.processedOutSize,
              this.finished
            );
            if (this.finished[0]) {
              return;
            }
            if (progress) {
              progress.setProgress(this.processedInSize[0], this.processedOutSize[0]);
            }
          }
        } finally {
          this.releaseStreams();
        }
      };
      Encoder.prototype.writeCoderProperties = function(outStream) {
        var properties = makeBuffer(kPropSize), i;
        properties[0] = (this._posStateBits * 5 + this._numLiteralPosStateBits) * 9 + this._numLiteralContextBits;
        for (i = 0; i < 4; i++) {
          properties[1 + i] = this._dictionarySize >>> 8 * i;
        }
        for (i = 0; i < kPropSize; i++) {
          outStream.writeByte(properties[i]);
        }
      };
      Encoder.prototype.fillDistancesPrices = function() {
        var tempPrices = [];
        tempPrices.length = Base.kNumFullDistances;
        var i, posSlot;
        for (i = Base.kStartPosModelIndex; i < Base.kNumFullDistances; i++) {
          posSlot = getPosSlot(i);
          var footerBits = (posSlot >>> 1) - 1;
          var baseVal = (2 | posSlot & 1) << footerBits;
          tempPrices[i] = RangeCoder.BitTreeEncoder.reverseGetPrice(
            this._posEncoders,
            baseVal - posSlot - 1,
            footerBits,
            i - baseVal
          );
        }
        var lenToPosState = 0;
        for (; lenToPosState < Base.kNumLenToPosStates; lenToPosState++) {
          var encoder = this._posSlotEncoder[lenToPosState];
          var st = lenToPosState << Base.kNumPosSlotBits;
          for (posSlot = 0; posSlot < this._distTableSize; posSlot++) {
            this._posSlotPrices[st + posSlot] = encoder.getPrice(posSlot);
          }
          for (posSlot = Base.kEndPosModelIndex; posSlot < this._distTableSize; posSlot++) {
            this._posSlotPrices[st + posSlot] += (posSlot >>> 1) - 1 - Base.kNumAlignBits << RangeCoder.Encoder.kNumBitPriceShiftBits;
          }
          var st2 = lenToPosState * Base.kNumFullDistances;
          for (i = 0; i < Base.kStartPosModelIndex; i++) {
            this._distancesPrices[st2 + i] = this._posSlotPrices[st + i];
          }
          for (; i < Base.kNumFullDistances; i++) {
            this._distancesPrices[st2 + i] = this._posSlotPrices[st + getPosSlot(i)] + tempPrices[i];
          }
        }
        this._matchPriceCount = 0;
      };
      Encoder.prototype.fillAlignPrices = function() {
        var i;
        for (i = 0; i < Base.kAlignTableSize; i++) {
          this._alignPrices[i] = this._posAlignEncoder.reverseGetPrice(i);
        }
        this._alignPriceCount = 0;
      };
      Encoder.prototype.setAlgorithm = function(algorithm) {
        return true;
      };
      Encoder.prototype.setDictionarySize = function(dictionarySize) {
        var kDicLogSizeMaxCompress = 29;
        if (dictionarySize < 1 << Base.kDicLogSizeMin || dictionarySize > 1 << kDicLogSizeMaxCompress) {
          return false;
        }
        this._dictionarySize = dictionarySize;
        var dicLogSize = 0;
        while (dictionarySize > 1 << dicLogSize) {
          dicLogSize++;
        }
        this._distTableSize = dicLogSize * 2;
        return true;
      };
      Encoder.prototype.setNumFastBytes = function(numFastBytes) {
        if (numFastBytes < 5 || numFastBytes > Base.kMatchMaxLen) {
          return false;
        }
        this._numFastBytes = numFastBytes;
        return true;
      };
      Encoder.prototype.setMatchFinder = function(matchFinderIndex) {
        if (matchFinderIndex < 0 || matchFinderIndex > 2) {
          return false;
        }
        var matchFinderIndexPrev = this._matchFinderType;
        this._matchFinderType = matchFinderIndex;
        if (this._matchFinder && matchFinderIndexPrev != this._matchFinderType) {
          this._dictionarySizePrev = -1;
          this._matchFinder = null;
        }
        return true;
      };
      Encoder.prototype.setLcLpPb = function(lc, lp, pb) {
        if (lp < 0 || lp > Base.kNumLitPosStatesBitsEncodingMax || lc < 0 || lc > Base.kNumLitContextBitsMax || pb < 0 || pb > Base.kNumPosStatesBitsEncodingMax) {
          return false;
        }
        this._numLiteralPosStateBits = lp;
        this._numLiteralContextBits = lc;
        this._posStateBits = pb;
        this._posStateMask = (1 << this._posStateBits) - 1;
        return true;
      };
      Encoder.prototype.setEndMarkerMode = function(endMarkerMode) {
        this._writeEndMark = endMarkerMode;
      };
      Encoder.EMatchFinderTypeBT2 = EMatchFinderTypeBT2;
      Encoder.EMatchFinderTypeBT4 = EMatchFinderTypeBT4;
      freeze(Encoder.prototype);
      return freeze(Encoder);
    })(require_Base(), require_RangeCoder(), require_LZ(), require_freeze(), require_makeBuffer());
  }
});

// node_modules/lzma-purejs/lib/LZMA.js
var require_LZMA = __commonJS({
  "node_modules/lzma-purejs/lib/LZMA.js"(exports, module) {
    module.exports = (function(freeze, Decoder, Encoder) {
      "use strict";
      return freeze({
        Decoder,
        Encoder
      });
    })(require_freeze(), require_Decoder2(), require_Encoder2());
  }
});

// node_modules/lzma-purejs/lib/Stream.js
var require_Stream = __commonJS({
  "node_modules/lzma-purejs/lib/Stream.js"(exports, module) {
    module.exports = (function(freeze) {
      "use strict";
      var Stream = function() {
      };
      Stream.prototype.readByte = function() {
        throw new Error("abstract method readByte() not implemented");
      };
      Stream.prototype.read = function(buffer, bufOffset, length) {
        var bytesRead = 0;
        while (bytesRead < length) {
          var c = this.readByte();
          if (c < 0) {
            return bytesRead === 0 ? -1 : bytesRead;
          }
          buffer[bufOffset++] = c;
          bytesRead++;
        }
        return bytesRead;
      };
      Stream.prototype.seek = function(new_pos) {
        throw new Error("abstract method seek() not implemented");
      };
      Stream.prototype.writeByte = function(_byte) {
        throw new Error("abstract method readByte() not implemented");
      };
      Stream.prototype.write = function(buffer, bufOffset, length) {
        var i;
        for (i = 0; i < length; i++) {
          this.writeByte(buffer[bufOffset++]);
        }
        return length;
      };
      Stream.prototype.flush = function() {
      };
      return freeze(Stream);
    })(require_freeze());
  }
});

// node_modules/lzma-purejs/lib/Util.js
var require_Util = __commonJS({
  "node_modules/lzma-purejs/lib/Util.js"(exports, module) {
    module.exports = (function(freeze, makeBuffer, LZMA, Stream) {
      "use strict";
      var coerceInputStream = function(input) {
        if ("readByte" in input) {
          return input;
        }
        var inputStream = new Stream();
        inputStream.pos = 0;
        inputStream.size = input.length;
        inputStream.readByte = function() {
          return this.eof() ? -1 : input[this.pos++];
        };
        inputStream.read = function(buffer, bufOffset, length) {
          var bytesRead = 0;
          while (bytesRead < length && this.pos < input.length) {
            buffer[bufOffset++] = input[this.pos++];
            bytesRead++;
          }
          return bytesRead;
        };
        inputStream.seek = function(pos) {
          this.pos = pos;
        };
        inputStream.eof = function() {
          return this.pos >= input.length;
        };
        return inputStream;
      };
      var coerceOutputStream = function(output) {
        var outputStream = new Stream();
        var resizeOk = true;
        if (output) {
          if (typeof output === "number") {
            outputStream.buffer = new Uint8Array(output);
            resizeOk = false;
          } else if ("writeByte" in output) {
            return output;
          } else {
            outputStream.buffer = output;
            resizeOk = false;
          }
        } else {
          outputStream.buffer = new Uint8Array(16384);
        }
        outputStream.pos = 0;
        outputStream.writeByte = function(_byte) {
          if (resizeOk && this.pos >= this.buffer.length) {
            var newBuffer = new Uint8Array(this.buffer.length * 2);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
          }
          this.buffer[this.pos++] = _byte;
        };
        outputStream.getBuffer = function() {
          if (this.pos !== this.buffer.length) {
            if (!resizeOk)
              throw new TypeError("outputsize does not match decoded input");
            var newBuffer = new Uint8Array(this.pos);
            newBuffer.set(this.buffer.subarray(0, this.pos));
            this.buffer = newBuffer;
          }
          return this.buffer;
        };
        outputStream._coerced = true;
        return outputStream;
      };
      var Util = /* @__PURE__ */ Object.create(null);
      Util.decompress = function(properties, inStream, outStream, outSize) {
        var decoder = new LZMA.Decoder();
        if (!decoder.setDecoderProperties(properties)) {
          throw "Incorrect stream properties";
        }
        if (!decoder.code(inStream, outStream, outSize)) {
          throw "Error in data stream";
        }
        return true;
      };
      Util.decompressFile = function(inStream, outStream) {
        var decoder = new LZMA.Decoder(), i, mult;
        inStream = coerceInputStream(inStream);
        if (!decoder.setDecoderPropertiesFromStream(inStream)) {
          throw "Incorrect stream properties";
        }
        var outSizeLo = 0;
        for (i = 0, mult = 1; i < 4; i++, mult *= 256) {
          outSizeLo += inStream.readByte() * mult;
        }
        var outSizeHi = 0;
        for (i = 0, mult = 1; i < 4; i++, mult *= 256) {
          outSizeHi += inStream.readByte() * mult;
        }
        var outSize = outSizeLo + outSizeHi * 4294967296;
        if (outSizeLo === 4294967295 && outSizeHi === 4294967295) {
          outSize = -1;
        } else if (outSizeHi >= 2097152) {
          outSize = -1;
        }
        if (outSize >= 0 && !outStream) {
          outStream = outSize;
        }
        outStream = coerceOutputStream(outStream);
        if (!decoder.code(inStream, outStream, outSize)) {
          throw "Error in data stream";
        }
        return "getBuffer" in outStream ? outStream.getBuffer() : true;
      };
      var option_mapping = [
        { a: 0, d: 0, fb: 0, mf: null, lc: 0, lp: 0, pb: 0 },
        // -0 (needed for indexing)
        { a: 0, d: 16, fb: 64, mf: "hc4", lc: 3, lp: 0, pb: 2 },
        // -1
        { a: 0, d: 20, fb: 64, mf: "hc4", lc: 3, lp: 0, pb: 2 },
        // -2
        { a: 1, d: 19, fb: 64, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -3
        { a: 2, d: 20, fb: 64, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -4
        { a: 2, d: 21, fb: 128, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -5
        { a: 2, d: 22, fb: 128, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -6
        { a: 2, d: 23, fb: 128, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -7
        { a: 2, d: 24, fb: 255, mf: "bt4", lc: 3, lp: 0, pb: 2 },
        // -8
        { a: 2, d: 25, fb: 255, mf: "bt4", lc: 3, lp: 0, pb: 2 }
        // -9
      ];
      var makeEncoder = function(props) {
        var encoder = new LZMA.Encoder();
        var params = {
          // defaults!
          a: 1,
          /* algorithm */
          d: 23,
          /* dictionary */
          fb: 128,
          /* fast bytes */
          lc: 3,
          /* literal context */
          lp: 0,
          /* literal position */
          pb: 2,
          /* position bits */
          mf: "bt4",
          /* match finder (bt2/bt4) */
          eos: false
          /* write end of stream */
        };
        if (props) {
          if (typeof props === "number") {
            props = option_mapping[props];
          }
          var p;
          for (p in props) {
            if (Object.prototype.hasOwnProperty.call(props, p)) {
              params[p] = props[p];
            }
          }
        }
        encoder.setAlgorithm(params.a);
        encoder.setDictionarySize(1 << +params.d);
        encoder.setNumFastBytes(+params.fb);
        encoder.setMatchFinder(params.mf === "bt4" ? LZMA.Encoder.EMatchFinderTypeBT4 : LZMA.Encoder.EMatchFinderTypeBT2);
        encoder.setLcLpPb(+params.lc, +params.lp, +params.pb);
        encoder.setEndMarkerMode(!!params.eos);
        return encoder;
      };
      Util.compress = function(inStream, outStream, props, progress) {
        var encoder = makeEncoder(props);
        encoder.writeCoderProperties(outStream);
        encoder.code(inStream, outStream, -1, -1, {
          setProgress: function(inSize, outSize) {
            if (progress) {
              progress(inSize, outSize);
            }
          }
        });
        return true;
      };
      Util.compressFile = function(inStream, outStream, props, progress) {
        var encoder = makeEncoder(props);
        var i;
        inStream = coerceInputStream(inStream);
        var fileSize;
        if ("size" in inStream && inStream.size >= 0) {
          fileSize = inStream.size;
        } else {
          fileSize = -1;
          encoder.setEndMarkerMode(true);
        }
        outStream = coerceOutputStream(outStream);
        encoder.writeCoderProperties(outStream);
        var out64 = function(s) {
          var i2;
          for (i2 = 0; i2 < 8; i2++) {
            outStream.writeByte(s & 255);
            s = Math.floor(s / 256);
          }
        };
        out64(fileSize);
        encoder.code(inStream, outStream, fileSize, -1, {
          setProgress: function(inSize, outSize) {
            if (progress) {
              progress(inSize, outSize);
            }
          }
        });
        return "getBuffer" in outStream ? outStream.getBuffer() : true;
      };
      return freeze(Util);
    })(require_freeze(), require_makeBuffer(), require_LZMA(), require_Stream());
  }
});

// node_modules/lzma-purejs/main.js
var require_main = __commonJS({
  "node_modules/lzma-purejs/main.js"(exports, module) {
    module.exports = (function(freeze, LZ, LZMA, RangeCoder, Stream, Util) {
      "use strict";
      return freeze({
        version: "0.9.0",
        LZ,
        LZMA,
        RangeCoder,
        Stream,
        Util,
        // utility methods
        compress: Util.compress,
        compressFile: Util.compressFile,
        decompress: Util.decompress,
        decompressFile: Util.decompressFile
      });
    })(require_freeze(), require_LZ(), require_LZMA(), require_RangeCoder(), require_Stream(), require_Util());
  }
});

// scripts/lzma-browser-entry.mjs
var import_lzma_purejs = __toESM(require_main(), 1);
function compressFile(input, properties) {
  return import_lzma_purejs.default.compressFile(input, void 0, properties);
}
export {
  compressFile
};
