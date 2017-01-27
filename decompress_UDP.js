// RFduino Node Example
// Discover and read temperature from RFduinos running the Temperature Sketch
// https://github.com/RFduino/RFduino/blob/master/libraries/RFduinoBLE/examples/Temperature/Temperature.ino
//
// (c) 2014 Don Coleman

// The above example code was modified by AJ Keller (Push The World), Joel Murphy, and Leif Percifield
// for OpenBCI, and further modified by Joel Murphy for the Pulse Patch project.

var noble = require('noble'),
    rfduino = require('./simblee'),
    _ = require('underscore');

var sampleCounter = 1;
var connectedPeripheral;
// var dataPacket = "";
// var packetComplete = false;
var lastPacket = null;
var dataObject;
var _peripheral;
var _sendCharacteristic;
var _bleAvailable = false;
var manualDisconnect = false;
var REDvalues = new Array();
var IRvalues = new Array();
var tempInteger;
var tempFraction;
var dieTemp = 0.0;
var lastCounter = 0;
// var thatTime = 0;
// var theOtherTime = 0;
// var failCounter = 0;
var packetCounter = 0;
var droppedPacketCounter = 0;
var goodPacket = 0;
var lastDroppedPacket;
// var packetArray = new Array(127);
// var droppedPacketArray = new Array(127);
// var droppedPacketCounters = [];
var udpOpen = false;

const udpRxPort = 10996;
const udpTxPort = 10997;

const PULSE_PATCH_CMD_STREAM_START = "b";
const PULSE_PATCH_CMD_STREAM_STOP = "s";
const UDP_CMD_CONNECT = "c";
const UDP_CMD_COMMAND = "k";
const UDP_CMD_DISCONNECT  = "d";
const UDP_CMD_ERROR = "e";
const UDP_CMD_SCAN = "s";
const UDP_CMD_STATUS = "q";
const UDP_DATA = "t";
const UDP_STOP = ",;\n";

// Packet types:
const PKT_TYPE_MAX = 0;
const PKT_TYPE_ADS = 1;

let udpRxOpen = false;
let stream;
let streaming = false;

var connected = true;

const dgram = require('dgram');
const udpRx = dgram.createSocket('udp4');
const udpTx = dgram.createSocket('udp4');

///////////////////////////////////////////////////////////////
// UDP Rx "Server"                                           //
///////////////////////////////////////////////////////////////

udpRx.on('error', (err) => {
  console.log(`udpRx error:\n${err.stack}`);
  udpRx.close();
});

udpRx.on('message', (msg, rinfo) => {
  console.log(`udpRx got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  parseMessage(msg);
});

udpRx.on('listening', () => {
  var address = udpRx.address();
  console.log(`udpRx listening ${address.address}:${address.port}`);
  udpOpen = true;
});

udpRx.bind(udpRxPort);

///////////////////////////////////////////////////////////////
// UDP Tx "Server"                                           //
///////////////////////////////////////////////////////////////

var parseMessage = function(msg) {
  let msgElements = msg.toString().split(',');
  switch (msgElements[0]) {
    case UDP_CMD_CONNECT:
      if(connected){
        var buf = new Buffer(`${UDP_CMD_CONNECT},200,${rfduino.getAdvertisedServiceName(_peripheral)},${UDP_STOP}`);
      }else{
        var buf = new Buffer(`${UDP_CMD_CONNECT},402,${UDP_STOP}`);
      }
      udpTx.send(buf,udpTxPort);
      break;
    case UDP_CMD_COMMAND:
      if (connected) {
        parseCommand(msgElements[1]);
        if(_sendCharacteristic!== null){
          var out = new Buffer(msgElements[1]);
          _sendCharacteristic.write(out);
          console.log(`sending ${out} to Pulse Patch`);
        }
      } else {
        error400();
      }
      break;
    case UDP_CMD_DISCONNECT:
      if (connected) {
        var buf = new Buffer(`${UDP_CMD_DISCONNECT},200${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
        connected = false;
      } else {
        error400();
      }
      break;
    case UDP_CMD_SCAN:
      var buf = new Buffer(`${UDP_CMD_SCAN},200,${rfduino.getAdvertisedServiceName(_peripheral)}${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      break;
    case UDP_CMD_STATUS:
      if (connected) {
        var buf = new Buffer(`${UDP_CMD_STATUS},200,true${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
      } else {
        var buf = new Buffer(`${UDP_CMD_STATUS},200,false${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
      }
      break;
    case UDP_CMD_ERROR:
    default:
      var buf = new Buffer(`${UDP_CMD_ERROR},500,Error: command not recognized${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      break;
  }
}

var parseCommand = cmd => {
  console.log(`parsing ${cmd}`);
  switch (cmd) {
    case PULSE_PATCH_CMD_STREAM_START:
      console.log("start stream");
      streaming = true;
      droppedPacketCounter = 0;
      break;
    case PULSE_PATCH_CMD_STREAM_STOP:
      console.log("stop stream");
      streaming = false;
      break;
    default:
      // Send message to tell driver command not recognized
      udpTx.send(new Buffer(`${UDP_CMD_COMMAND},406${UDP_STOP}`), udpTxPort);
      break;
  }
}

function error400() {
  var buf = new Buffer(`${UDP_CMD_ERROR},400,Error: No open BLE device${UDP_STOP}`);
  udpTx.send(buf,udpTxPort);
}

var stop = function() {
    noble.stopScanning();
};

noble.on('scanStart', function() {
    console.log('Scan started');
    //setTimeout(stop, 60000);
});

noble.on('scanStop', function() {
    console.log('Scan stopped');
});

var onDeviceDiscoveredCallback = function(peripheral) {
    _peripheral = peripheral;
    console.log('\nDiscovered Peripherial ' + peripheral.uuid);

    if (_.contains(_peripheral.advertisement.serviceUuids, rfduino.serviceUUID)) {
        // here is where we can capture the advertisement data from the rfduino and check to make sure its ours
        console.log('Device is advertising \'' + rfduino.getAdvertisedServiceName(_peripheral) + '\' service.');
        console.log("serviceUUID: " + _peripheral.advertisement.serviceUuids);

        _peripheral.on('connect', function() {
            console.log("got connect event");
            peripheral.discoverServices();
            noble.stopScanning();
            //connectedPeripheral = peripheral;
        });

        _peripheral.on('disconnect', function() {
            noble.removeListener('discover', onDeviceDiscoveredCallback);
            _peripheral.removeAllListeners('servicesDiscover');
            _peripheral.removeAllListeners('connect');
            _peripheral.removeAllListeners('disconnect');
            //_peripheral = null;
            console.log('Disconnected');
            if (!manualDisconnect) {
                autoReconnect();
            }

        });

        _peripheral.on('servicesDiscover', function(services) {

            var rfduinoService;

            for (var i = 0; i < services.length; i++) {
                if (services[i].uuid === rfduino.serviceUUID) {
                    rfduinoService = services[i];
                    console.log("Found simblee Service");
                    break;
                }
            }

            if (!rfduinoService) {
                console.log('Couldn\'t find the simblee service.');
                return;
            }

            rfduinoService.on('characteristicsDiscover', function(characteristics) {
                console.log('Discovered ' + characteristics.length + ' service characteristics');


                var receiveCharacteristic;

                for (var i = 0; i < characteristics.length; i++) {
                    console.log(characteristics[i].uuid);
                    if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
                        receiveCharacteristic = characteristics[i];
                        //break;
                    }
                    if (characteristics[i].uuid === rfduino.sendCharacteristicUUID) {
                        console.log("Found sendCharacteristicUUID");
                        _sendCharacteristic = characteristics[i];
                        //break;
                    }
                }


                if (receiveCharacteristic) {
                    receiveCharacteristic.on('read', function(data, isNotification) {
                      if(streaming){
                        processCompressedData(data);
                      }else{

                      }
                    });

                    console.log('Subscribing for data notifications');
                    receiveCharacteristic.notify(true);
                }

            });

            rfduinoService.discoverCharacteristics();

        });
        console.log("Calling connect");
        _peripheral.connect(function(err) {
            console.log("connected");
            // connected = true;
        });

    }
};

// noble.on('stateChange', function(state) {
//     if (state === 'poweredOn') {
//         noble.startScanning([rfduino.serviceUUID], false);
//     }
// });
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        //noble.startScanning([rfduino.serviceUUID], false);
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

noble.on('discover', onDeviceDiscoveredCallback);

function exitHandler(options, err) {
    if (options.cleanup) {
        console.log('clean');
        //console.log(connectedPeripheral);
        manualDisconnect = true;
        _peripheral.disconnect();
        //   if(connectedPeripheral){
        //     noble.disconnect(connectedPeripheral.uuid);
        //   }
        //connectedPeripheral.disconnect();
    }
    if (err) console.log(err.stack);
    if (options.exit) {
        console.log("exit");
        _peripheral.disconnect();
        process.exit();
    }
}

var autoReconnect = function() {
    if (_bleAvailable || noble.state === "poweredOn") {
        noble.on('discover', onDeviceDiscoveredCallback);
        noble.startScanning([rfduino.serviceUUID], false);
    } else {
        this.warn("BLE not AVAILABLE");
    }
}

var interpret18bitAsInt32 = function(sample) {
    if ((sample & 0x00020000) > 0) {
        sample |= 0xFFFC0000;
    } else {
        sample &= 0x0003FFFF;
    }
    return sample;
}

var MAX_unpackSamples = function(buffer) {
  var D = new Array(2);

  D[0] = [0, 0, 0, 0];
  D[1] = [0, 0, 0, 0];

  var bufferPos = 0; // note this starts at 0 because the buffer is the middle 18 bytes of the MAX data packet
  D[0][0] = ((buffer[bufferPos] & 0xFF) << 10);   //111111110000000000
  bufferPos++; //1
  D[0][0] |= ((buffer[bufferPos] & 0xFF) << 2);   //000000001111111100
  bufferPos++; //2
  D[0][0] |= ((buffer[bufferPos] & 0xC0) >> 6);   //000000000000000011
  D[1][0] = ((buffer[bufferPos] & 0x3F) << 12);   //111111000000000000
  bufferPos++; //3
  D[1][0] |= ((buffer[bufferPos] & 0xFF) << 4);   //000000111111110000
  bufferPos++; //4
  D[1][0] |= ((buffer[bufferPos] & 0xF0) >> 4);   //000000000000011111
  D[0][1] = ((buffer[bufferPos] & 0x0F) << 14);   //111100000000000000
  bufferPos++; //5
  D[0][1] |= ((buffer[bufferPos] & 0xFF) << 6);   //000011111111000000
  bufferPos++; //6
  D[0][1] |= ((buffer[bufferPos] & 0xFC) >> 2);   //000000000000111111
  D[1][1] = ((buffer[bufferPos] & 0x03) << 16);   //110000000000000000
  bufferPos++; //7
  D[1][1] |= ((buffer[bufferPos] & 0xFF) << 8);   //001111111100000000
  bufferPos++; //8
  D[1][1] |= (buffer[bufferPos] & 0xFF);          //000000000011111111
  bufferPos++; //9
  D[0][2] = ((buffer[bufferPos] & 0xFF) << 10);   //111111110000000000
  bufferPos++; //10
  D[0][2] |= ((buffer[bufferPos] & 0xFF) << 2);   //000000001111111100
  bufferPos++; //11
  D[0][2] |= ((buffer[bufferPos] & 0xC0) >> 6);   //000000000000000011
  D[1][2] = ((buffer[bufferPos] & 0x3F) << 12);   //111111000000000000
  bufferPos++; //12
  D[1][2] |= ((buffer[bufferPos] & 0xFF) << 4);   //000000111111110000
  bufferPos++; //13
  D[1][2] |= ((buffer[bufferPos] & 0xF0) >> 4);   //000000000000011111
  D[0][3] = ((buffer[bufferPos] & 0x0F) << 14);   //111100000000000000
  bufferPos++; //14
  D[0][3] |= ((buffer[bufferPos] & 0xFF) << 6);   //000011111111000000
  bufferPos++; //15
  D[0][3] |= ((buffer[bufferPos] & 0xFC) >> 2);   //000000000000111111
  D[1][3] = ((buffer[bufferPos] & 0x03) << 16);   //110000000000000000
  bufferPos++; //16
  D[1][3] |= ((buffer[bufferPos] & 0xFF) << 8);   //001111111100000000
  bufferPos++; //17
  D[1][3] |= (buffer[bufferPos] & 0xFF);          //000000000011111111


  // var values = ""; // verbose
  for (var j = 0; j < 4; j++) {
    REDvalues[j] = interpret18bitAsInt32(D[0][j]);
    // values += REDvalues[j]; values += "\t" // verbose
    IRvalues[j] = interpret18bitAsInt32(D[1][j]);
    // values += IRvalues[j]; values += "\n" // verbose
  }
  // console.log(values);  // verbose
}

var processCompressedData = function(data) {
  var packetType = parseInt(data[0] >> 6);
  switch (packetType) {
    case PKT_TYPE_MAX:
      MAX_processCompressedData(data);
      break;
    case PKT_TYPE_ADS:
      ADS_processCompressedData(data);
      break;
    default:
      console.error("Unknown Packet Type");
  }
}

var MAX_processCompressedData = function(data) {
    if (lastPacket !== null) {
    } else {
        console.log("First Packet");
    }
    lastPacket = data;
    var packetIndex = parseInt(data[0] & 0x3F); // packetIndex, a.k.a. MAX_packetNumber
    var tempAvailable = false;
    switch (packetIndex) {
        case 1:
            //console.log(data.length);
            var buffer = new Buffer(18);
            for (var i = 0; i < 18; i++) {
                buffer[i] = data[i + 1];
            }
            MAX_unpackSamples(buffer);

            for (var p = 1; p <= 4; p++) {
                var packet = "";
                packet = `${UDP_DATA},200,`;
                packet += (4*packetIndex - (4-p));
                packet += ",";
                packet += REDvalues[p-1];
                packet += ",";
                packet += IRvalues[p-1];
                packet += `${UDP_STOP}`;
                if(udpOpen){
                  var outBuff = new Buffer(packet);
                  udpTx.send(outBuff,0,outBuff.length, udpTxPort);
                }
                // console.log(packet);
            }
            packetCounter = packetIndex;  // used to find dropped packets
            break;

        default:
            if(packetIndex - packetCounter != 1){ // check for dropped packet
                lastDroppedPacket = packetIndex;
                //var retryString = "&"+dropped;
                //var reset = Buffer.from(retryString);
                //_sendCharacteristic.write(reset);
                droppedPacketCounter++;
                console.error("\t>>>PACKET DROP<<<  " + packetCounter + "  " + lastDroppedPacket + " " + droppedPacketCounter);
            }else{
                // goodPacket++;
                // console.log(goodPacket)
            }
            if(packetIndex === 25){
              tempInteger = data[19];
            }
            if(packetIndex === 26){
              tempFraction = data[19];
              dieTemp = tempInteger;
              dieTemp += (tempFraction/16);
              tempAvailable = true;
              console.log(dieTemp);
            }
            var buffer = new Buffer(18);
            for (var i = 0; i < 18; i++) {
                buffer[i] = data[i + 1];
            }

            MAX_unpackSamples(buffer);

            for (var p = 1; p <= 4; p++) {
                var packet = "";
                packet = `${UDP_DATA},200,`;
                packet += (4*packetIndex - (4-p));
                packet += ",";
                packet += REDvalues[p-1];
                packet += ",";
                packet += IRvalues[p-1];
                if(tempAvailable){
                  packet += ","; packet += dieTemp;
                  tempAvailable = false;
                }
                packet += `${UDP_STOP}`;
                if(udpOpen){
                  var outBuff = new Buffer(packet);
                  udpTx.send(outBuff,0,outBuff.length, udpTxPort);
                }
                // console.log(packet);
            }
            packetCounter = packetIndex; // packetCounter is the last successful packet # (packetIndex) we've received

    }
    //console.log(data.toString());
}

var ADS_processCompressedData = function(data) {
  // Do some stuff here...
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
    cleanup: true
}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
    exit: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
    exit: true
}));
