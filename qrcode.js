/**
 * QRCode.js - Minimal QR Code generator
 * Based on qrcode-generator by kazuhikoarase
 */
var QRCode = (function() {
  function QRCode(typeNumber, errorCorrectionLevel) {
    var PAD0 = 0xEC, PAD1 = 0x11;
    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};
    _this.addData = function(data) {
      var newData = QR8BitByte(data);
      _dataList.push(newData);
      _dataCache = null;
    };
    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;
        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = QRBitBuffer();
          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
            data.write(buffer);
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) break;
        }
        _typeNumber = typeNumber;
      }
      makeImpl(false, getBestMaskPattern());
    };
    _this.getModuleCount = function() { return _moduleCount; };
    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) throw row + ',' + col;
      return _modules[row][col];
    };

    var makeImpl = function(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = new Array(_moduleCount);
      for (var row = 0; row < _moduleCount; row++) {
        _modules[row] = new Array(_moduleCount);
        for (var col = 0; col < _moduleCount; col++) {
          _modules[row][col] = null;
        }
      }
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) setupTypeNumber(test);
      if (_dataCache == null) {
        _dataCache = QRUtil.createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {
      var minLostPoint = 0;
      var pattern = 0;
      for (var i = 0; i < 8; i++) {
        makeImpl(true, i);
        var lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    };

    var setupTimingPattern = function() {
      for (var r = 8; r < _moduleCount - 8; r++) {
        if (_modules[r][6] != null) continue;
        _modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < _moduleCount - 8; c++) {
        if (_modules[6][c] != null) continue;
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {
      var pos = QRUtil.getPatternPosition(_typeNumber);
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i], col = pos[j];
          if (_modules[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {
      var bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {
      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) { _modules[i][8] = mod; }
        else if (i < 8) { _modules[i + 1][8] = mod; }
        else { _modules[_moduleCount - 15 + i][8] = mod; }
      }
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 8) { _modules[8][_moduleCount - i - 1] = mod; }
        else if (i < 9) { _modules[8][15 - i - 1 + 1] = mod; }
        else { _modules[8][15 - i - 1] = mod; }
      }
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {
      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (var col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (_modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) { dark = (((data[byteIndex] >>> bitIndex) & 1) == 1); }
              var mask = maskFunc(row, col - c);
              if (mask) { dark = !dark; }
              _modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    };

    var getPenaltyScore = function(data) { return 0; };

    return _this;
  }

  var QRUtil = (function() {
    var PATTERN_POSITION_TABLE = [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
      [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
      [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
      [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};
    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) { d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15))); }
      return ((data << 10) | d) ^ G15_MASK;
    };
    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) { d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18))); }
      return (data << 12) | d;
    };
    _this.getPatternPosition = function(typeNumber) { return PATTERN_POSITION_TABLE[typeNumber - 1]; };
    _this.getMaskFunction = function(maskPattern) {
      switch (maskPattern) {
        case 0: return function(i, j) { return (i + j) % 2 == 0; };
        case 1: return function(i, j) { return i % 2 == 0; };
        case 2: return function(i, j) { return j % 3 == 0; };
        case 3: return function(i, j) { return (i + j) % 3 == 0; };
        case 4: return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0; };
        case 5: return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
        case 6: return function(i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 == 0; };
        case 7: return function(i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 == 0; };
        default: throw 'bad maskPattern:' + maskPattern;
      }
    };
    _this.getErrorCorrectionPolynomial = function(errorCorrectLength) {
      var a = QRPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i++) { a = a.multiply(QRPolynomial([1, QRMath.gexp(i)], 0)); }
      return a;
    };
    _this.getLengthInBits = function(mode, type) {
      if (1 <= type && type < 10) return { 'Numeric': 10, 'Alphanumeric': 9, 'Byte': 8, 'Kanji': 8 }[mode] || 8;
      else if (type < 27) return { 'Numeric': 12, 'Alphanumeric': 11, 'Byte': 16, 'Kanji': 10 }[mode] || 8;
      else if (type < 41) return { 'Numeric': 14, 'Alphanumeric': 13, 'Byte': 16, 'Kanji': 12 }[mode] || 8;
      else throw 'type:' + type;
    };
    _this.createData = function(typeNumber, errorCorrectionLevel, dataList) {
      var PAD0 = 0xEC, PAD1 = 0x11;
      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
      var buffer = QRBitBuffer();
      for (var i = 0; i < dataList.length; i++) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
        data.write(buffer);
      }
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ' + buffer.getLengthInBits() + ' > ' + totalDataCount * 8;
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD1, 8);
      }
      return QRUtil.createBytes(buffer, rsBlocks);
    };
    _this.createBytes = function(buffer, rsBlocks) {
      var offset = 0;
      var maxDcCount = 0;
      var maxEcCount = 0;
      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);
      for (var r = 0; r < rsBlocks.length; r++) {
        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (var i = 0; i < dcdata[r].length; i++) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        var rsPoly = QRUtil.getErrorCorrectionPolynomial(ecCount);
        var rawPoly = QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i++) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.getAt(modIndex) : 0;
        }
      }
      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      var data = new Array(totalCodeCount);
      var index = 0;
      for (var i = 0; i < maxDcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index++;
          }
        }
      }
      for (var i = 0; i < maxEcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index++;
          }
        }
      }
      return data;
    };
    _this.getLostPoint = function(qrcode) {
      var moduleCount = qrcode.getModuleCount();
      var lostPoint = 0;
      // LEVEL1
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0;
          var dark = qrcode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrcode.isDark(row + r, col + c)) { sameCount++; }
            }
          }
          if (sameCount > 5) { lostPoint += (3 + sameCount - 5); }
        }
      }
      // LEVEL2
      for (var row = 0; row < moduleCount - 1; row++) {
        for (var col = 0; col < moduleCount - 1; col++) {
          var count = 0;
          if (qrcode.isDark(row, col)) count++;
          if (qrcode.isDark(row + 1, col)) count++;
          if (qrcode.isDark(row, col + 1)) count++;
          if (qrcode.isDark(row + 1, col + 1)) count++;
          if (count == 0 || count == 4) { lostPoint += 3; }
        }
      }
      return lostPoint;
    };

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) { digit++; data >>>= 1; }
      return digit;
    };

    return _this;
  })();

  var QRMath = (function() {
    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);
    for (var i = 0; i < 8; i++) { EXP_TABLE[i] = 1 << i; }
    for (var i = 8; i < 256; i++) { EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8]; }
    for (var i = 0; i < 255; i++) { LOG_TABLE[EXP_TABLE[i]] = i; }
    var _this = {};
    _this.glog = function(n) {
      if (n < 1) throw 'glog(' + n + ')';
      return LOG_TABLE[n];
    };
    _this.gexp = function(n) {
      while (n < 0) { n += 255; }
      while (n >= 256) { n -= 255; }
      return EXP_TABLE[n];
    };
    return _this;
  })();

  var QRPolynomial = function(num, shift) {
    if (typeof num.length == 'undefined') throw num.length + '/' + shift;
    var _num = (function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) { offset++; }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i++) { _num[i] = num[i + offset]; }
      return _num;
    })();
    var _this = {};
    _this.getAt = function(index) { return _num[index]; };
    _this.getLength = function() { return _num.length; };
    _this.multiply = function(e) {
      var num = new Array(_this.getLength() + e.getLength() - 1);
      for (var i = 0; i < _this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return QRPolynomial(num, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) return _this;
      var ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      var num = new Array(_this.getLength());
      for (var i = 0; i < _this.getLength(); i++) { num[i] = _this.getAt(i); }
      for (var i = 0; i < e.getLength(); i++) { num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio); }
      return QRPolynomial(num, 0).mod(e);
    };
    return _this;
  };

  var QRRSBlock = (function() {
    var RS_BLOCK_TABLE = [
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
      [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
      [4, 116, 92], [2, 58, 36, 2, 59, 37], [6, 46, 20, 2, 47, 21], [7, 42, 14, 4, 43, 15],
      [2, 68, 42, 4, 69, 43], [4, 67, 41, 1, 68, 42], [8, 43, 19, 4, 44, 20], [12, 33, 15, 4, 34, 16],
      [3, 133, 107], [4, 59, 37, 5, 60, 38], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
      [5, 87, 68, 1, 88, 69], [5, 69, 43, 1, 70, 44], [5, 43, 19, 7, 44, 20], [11, 36, 15, 7, 37, 16],
      [5, 98, 74, 1, 99, 75], [7, 78, 48, 1, 79, 49], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
      [1, 107, 81, 5, 108, 82], [10, 74, 46, 1, 75, 47], [1, 43, 19, 15, 44, 20], [2, 42, 14, 17, 43, 15],
      [5, 120, 92, 1, 121, 93], [9, 69, 43, 4, 70, 44], [17, 42, 19, 1, 43, 20], [2, 42, 14, 19, 43, 15],
      [3, 113, 87, 4, 114, 88], [3, 69, 44, 11, 70, 45], [17, 42, 21, 4, 43, 22], [9, 39, 14, 16, 40, 15],
      [3, 107, 83, 5, 108, 84], [3, 69, 43, 13, 70, 44], [15, 42, 24, 5, 43, 25], [15, 45, 15, 10, 46, 16],
      [4, 116, 92, 4, 117, 93], [17, 68, 42], [17, 42, 22, 6, 43, 23], [19, 46, 16, 6, 47, 17],
      [2, 111, 87, 7, 112, 88], [17, 68, 42, 1, 69, 43], [7, 42, 22, 16, 43, 23], [34, 37, 16],
      [4, 121, 97, 5, 122, 98], [4, 75, 47, 14, 76, 48], [11, 42, 24, 14, 43, 25], [16, 45, 15, 14, 46, 16],
      [6, 117, 93, 4, 118, 94], [6, 73, 45, 14, 74, 46], [11, 42, 24, 16, 43, 25], [30, 46, 16, 2, 47, 17],
      [8, 106, 82, 4, 107, 83], [8, 75, 47, 13, 76, 48], [7, 42, 24, 22, 43, 25], [22, 45, 15, 13, 46, 16],
      [10, 114, 86, 2, 115, 87], [19, 74, 46, 4, 75, 47], [28, 42, 22, 6, 43, 23], [33, 46, 16, 4, 47, 17],
      [8, 122, 98, 4, 123, 99], [22, 73, 45, 3, 74, 46], [8, 42, 23, 26, 43, 24], [12, 45, 15, 28, 46, 16],
      [3, 117, 93, 10, 118, 94], [3, 73, 45, 23, 74, 46], [4, 42, 24, 31, 43, 25], [11, 45, 15, 31, 46, 16],
      [7, 116, 92, 7, 117, 93], [21, 73, 45, 7, 74, 46], [1, 42, 23, 37, 43, 24], [19, 45, 15, 26, 46, 16],
      [5, 115, 91, 10, 116, 92], [19, 75, 47, 10, 76, 48], [15, 42, 24, 25, 43, 25], [23, 45, 15, 25, 46, 16],
      [13, 115, 91, 3, 116, 92], [2, 74, 46, 29, 75, 47], [42, 42, 24, 1, 43, 25], [23, 45, 15, 28, 46, 16],
      [17, 115, 91], [10, 74, 46, 23, 75, 47], [10, 42, 24, 35, 43, 25], [19, 45, 15, 35, 46, 16],
      [17, 115, 91, 1, 116, 92], [14, 74, 46, 21, 75, 47], [29, 42, 24, 19, 43, 25], [11, 45, 15, 46, 46, 16],
      [13, 115, 91, 6, 116, 92], [14, 74, 46, 23, 75, 47], [44, 42, 24, 7, 43, 25], [59, 46, 16, 1, 47, 17],
      [12, 121, 97, 7, 122, 98], [12, 75, 47, 26, 76, 48], [39, 42, 24, 14, 43, 25], [22, 45, 15, 41, 46, 16]
    ];

    var _this = {};
    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == 'undefined') throw 'bad rs block @ typeNumber:' + typeNumber + '/errorCorrectionLevel:' + errorCorrectionLevel;
      var length = rsBlock.length / 3;
      var list = [];
      for (var i = 0; i < length; i++) {
        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];
        for (var j = 0; j < count; j++) { list.push({ totalCount: totalCount, dataCount: dataCount }); }
      }
      return list;
    };

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case 1: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case 0: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case 3: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case 2: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default: return undefined;
      }
    };

    return _this;
  })();

  var QRBitBuffer = function() {
    var _buffer = [];
    var _length = 0;
    var _this = {};
    _this.getBuffer = function() { return _buffer; };
    _this.getAt = function(index) { return ((_buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) == 1; };
    _this.put = function(num, length) { for (var i = 0; i < length; i++) { _this.putBit(((num >>> (length - i - 1)) & 1) == 1); } };
    _this.getLengthInBits = function() { return _length; };
    _this.putBit = function(bit) {
      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) { _buffer.push(0); }
      if (bit) { _buffer[bufIndex] |= (0x80 >>> (_length % 8)); }
      _length++;
    };
    return _this;
  };

  var QR8BitByte = function(data) {
    var _mode = 4;
    var _bytes = toUTF8(data);
    var _this = {};
    _this.getMode = function() { return _mode; };
    _this.getLength = function() { return _bytes.length; };
    _this.write = function(buffer) {
      var bytes = _bytes;
      for (var i = 0; i < bytes.length; i++) { buffer.put(bytes[i], 8); }
    };
    return _this;
  };

  var QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };

  var toUTF8 = function(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) { bytes.push(c); }
      else if (c < 2048) { bytes.push(0xC0 | (c >> 6)); bytes.push(0x80 | (c & 0x3F)); }
      else { bytes.push(0xE0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3F)); bytes.push(0x80 | (c & 0x3F)); }
    }
    return bytes;
  };

  var _createCanvas = function(typeNumber, errorCorrectionLevel) {
    return QRCode(typeNumber, errorCorrectionLevel || 'M');
  };

  var _createImgTag = function(typeNumber, cellSize, margin) {
    var size = (typeNumber * 4 + 17) * cellSize + margin * 2;
    var qrcode = _createCanvas(typeNumber, 'M');
    return { qrcode: qrcode, size: size, cellSize: cellSize, margin: margin };
  };

  var create = function(typeNumber, errorCorrectionLevel) {
    return _createCanvas(typeNumber, errorCorrectionLevel);
  };

  var renderToCanvas = function(canvas, typeNumber, errorCorrectionLevel, text, cellSize, margin, darkColor, lightColor) {
    cellSize = cellSize || 4;
    margin = margin || 4;
    darkColor = darkColor || '#000000';
    lightColor = lightColor || '#ffffff';

    var qrcode = _createCanvas(typeNumber || 0, errorCorrectionLevel || 'M');
    qrcode.addData(text);
    qrcode.make();

    var moduleCount = qrcode.getModuleCount();
    var size = moduleCount * cellSize + margin * 2;

    canvas.width = size;
    canvas.height = size;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = darkColor;
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (qrcode.isDark(row, col)) {
          ctx.fillRect(col * cellSize + margin, row * cellSize + margin, cellSize, cellSize);
        }
      }
    }

    return canvas;
  };

  return {
    create: create,
    renderToCanvas: renderToCanvas
  };
})();
