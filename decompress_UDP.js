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
const PULSE_PATCH_CMD_STREAM_START_ECG = "a";
const UDP_CMD_CONNECT = "c";
const UDP_CMD_COMMAND = "k";
const UDP_CMD_DISCONNECT  = "d";
const UDP_CMD_ERROR = "e";
const UDP_CMD_SCAN = "s";
const UDP_CMD_STATUS = "q";
const UDP_DATA = "t";
const UDP_STOP = "\n";

// Packet types:
const PKT_TYPE_MAX_WFM = 0;
const PKT_TYPE_MAX_AUX = 1;
const PKT_TYPE_ADS_WFM = 2;
const PKT_TYPE_ADS_AUX = 3;

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
	case PULSE_PATCH_CMD_STREAM_START_ECG:
	  console.log("start ECG stream");
	  streaming = true;
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
	console.log('\nDiscovered Peripheral ' + peripheral.uuid);

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
	/*
	if ((sample & 0x00020000) > 0) {
		sample |= 0xFFFC0000;
	} else {
		sample &= 0x0003FFFF;
	}
	*/
	sample &= 0x0003FFFF;
	
	return sample;
}

var MAX_unpackWFMsamples = function(buffer) {
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
  console.log(`Got packet type ${packetType}`);
  switch (packetType) {
	case PKT_TYPE_MAX_WFM:
	  MAX_processCompressedWaveformData(data);
	  break;
	case PKT_TYPE_MAX_AUX:
	  MAX_processCompressedAuxiliaryData(data);
	  break;
	case PKT_TYPE_ADS_WFM:
	  ADS_processCompressedWaveformData(data);
	  break;
	case PKT_TYPE_ADS_AUX:
	  //ADS_processCompressedAuxiliaryData(data);
	  break;
	default:
	  console.error("Unknown Packet Type");
	  break;
  }
}

var MAX_processCompressedWaveformData = function(data) {
	if (lastPacket == 0) {
	  console.log("First Packet");
	}

	var tmp = ((data[0] & 0x3F) << 8) | ((data[1] & 0xFF) );
	var packetIndex = parseInt(tmp); // packetIndex, a.k.a. MAX_packetNumber
	if(packetIndex - lastPacket != 1){ // check for dropped packet
		droppedPacketCounter++;
		console.error("\t>>>PACKET DROP<<<  " + lastPacket + " -> " + packetIndex + "; " + droppedPacketCounter);
	}
	
	var buffer = new Buffer(18);
	for (var i = 0; i < 18; i++) {
		buffer[i] = data[i+2];
	}
	
	MAX_unpackWFMsamples(buffer);

	var packet = "";
	packet = `${UDP_DATA},MAXWFM,`;
	packet += `200,`;
	packet += packetIndex;
	for (var p = 0; p < 4; p++) {
	  packet += ",";
	  packet += REDvalues[p];
	  packet += ",";
	  packet += IRvalues[p];
	}
	packet += `${UDP_STOP}`;
	if(udpOpen){
	  var outBuff = new Buffer(packet);
	  udpTx.send(outBuff,0,outBuff.length, udpTxPort);
	}
	
	console.log(packet);
	lastPacket = packetIndex; // packetCounter is the last successful packet # (packetIndex) we've received
}

var MAX_processCompressedAuxiliaryData = function(data) {
	var tmp;

	var repeat;
	var samples;
	var referencePacket;

	var packetnum;
	var sampnum;
	var instHR;

	var validHR;
	var validSpO2;
	var avgHR;
	var avgSpO2;
	var temperature;

	/*
	for (var i = 0; i<20; i++) {
		printByte(data[i]);
	}
	*/

	repeat =  parseInt((data[0] & 0x20) >> 1);
	samples = parseInt((data[0] & 0x1C) >> 2);
	tmp =    ((data[0] & 0x03) << 16) | ((data[1] & 0xFF) >> 8 ) | ((data[2] & 0xFF) );
	referencePacket = parseInt(tmp << 6);
	
	var buffer = new Buffer(20);
	for (var i = 0; i < 20; i++) {
		buffer[i] = data[i];
	}
	
	var packet = "";
	packet = `${UDP_DATA},MAXAUX,`;
	packet += repeat;
	packet += ",";
	packet += samples;
	packet += ",";
	packet += referencePacket;

	for (var p = 0; p < samples; p++) {
		packetnum = referencePacket + ((buffer[3+2*p] & 0xFC) >> 2);
		sampnum = (buffer[3+2*p] & 0x03);
		instHR = buffer[4+2*p];
		packet += ",";
		packet += packetnum;
		packet += ",";
		packet += sampnum;
		packet += ",";
		packet += instHR;
	}

	if(repeat==0) {
		validHR = (buffer[15] & 0x02) >> 1;
		validSpO2 = (buffer[15] & 0x01);
		avgHR = buffer[16];
		avgSpO2 = buffer[17];
		temperature = buffer[18] + buffer[19]/16;
		packet += ",";
		packet += validHR;
		packet += ",";
		packet += validSpO2;
		packet += ",";
		packet += avgHR;
		packet += ",";
		packet += avgSpO2;
		packet += ",";
		packet += temperature;
		packet += ",";
	}


	packet += `${UDP_STOP}`;
	if(udpOpen){
	  var outBuff = new Buffer(packet);
	  udpTx.send(outBuff,0,outBuff.length, udpTxPort);
	}
	
	console.log(packet);
}

var ADS_processCompressedWaveformData = function(data) {
  var i;
  var sample;
  var packet = "";
  var tmp = ((data[0] & 0x3F) << 8) | ((data[1] & 0xFF) );
  var packetIndex = parseInt(tmp); //

  for (i = 0; i < 6; i++) {
	packet = `${UDP_DATA},ADS,64,`;
	packet += packetIndex;
	packet += ",";
	packet += i;
	packet += ",";
	sample  = ( data[i*3+2] & 0xFF ) <<16;
	sample |= ( data[i*3+3] & 0xFF ) << 8;
	sample |= ( data[i*3+4] & 0xFF ) ;
	packet += sample;    
	packet += `${UDP_STOP}`;
	// console.log(packet);
	if(udpOpen){
	  var outBuff = new Buffer(packet);
	  udpTx.send(outBuff,0,outBuff.length, udpTxPort);
	}
  }
}

var ADS_processCompressedAuxiliaryData = function(data) {
}

var printByte = function(b) {
	var sss = '';
	for (var i=7; i>=0; i--) {
		if ( ((b >> i) & 0x01) == 0x01) {
			sss += '1';
		} else {
			sss += '0';
		}
	}
	console.log(sss);
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
