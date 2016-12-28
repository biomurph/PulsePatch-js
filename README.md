###Pulse Patch <> Processing 
###via Node.js and BLE

Quickstart Guide

First, update your Pulse Patch with the included Arduino firmware 'PulsePatch_01'

    https://github.com/biomurph/PulsePatch
  
The default setting is: 

OUTPUT_TYPE = OUTPUT_BLE;

After uploading, the red led will blink until BLE is connected. When it is connected, the LED will switch to green steady-on. The board will give you serial feedback at 9600 baud (BLE is limited to 9600). You can use OUTPUT_NORMAL and OUTPUT_PLOTTER to access the other output types according to the specifications that we have defined as PRINT_ONLY_FOR_PLOTTER (superseded). When you have the board powered up and blinking red, you can connect to it by running Terminal on a Mac and navigating to the containing folder, 'PulsePatch-js'. Then enter 'node decompress_UDP.js' You will get some terminal feedback about the BLE devices in the region, and you should see the board LED turn green. This is the feedback I get from node:

    Airplane:PulsePatch-js biomurph$ node decompress_UDP.js
    udpRx listening 0.0.0.0:10996
    Scan started
    Discovered Peripherial 77419dd7e0754508b0a74aa29b9f63a0
    Discovered Peripherial f56bcbd846ff44778675cbbbf67399b5
    Discovered Peripherial ca2b83a0c136426086ecd80af821362d
    Discovered Peripherial fe082cf14fff4e30a2f8ebbcad58da4c
    Discovered Peripherial 50cee8bc5939470bb974279de5f0a56c
    Discovered Peripherial 25784ba58ad7468b8ba60d0d91dd6025
    Discovered Peripherial ae79e12638dc4e94857cca5f0912a05b
    Device is advertising 'PulsePatch' service.
    serviceUUID: fe84
    Calling connect
    got connect event
    Scan stopped
    connected
    Found simblee Service
    Discovered 3 service characteristics
    2d30c082f39f4ce6923f3484ea480596
    2d30c083f39f4ce6923f3484ea480596
    Found sendCharacteristicUUID
    2d30c084f39f4ce6923f3484ea480596
    Subscribing for data notifications

Node is now connected to the Pulse Patch, and it has also opened up a UDP port. The next step is to run the Processing sketch 'UDP_Listener' located in:

    PulsePatch-js/UDP_Listener/UDP_Listener.pde

This will launch the default Processing window, and open a UDP connection to the ports node has opened:

    const udpRxPort = 10996;	// node side RX
    const udpTxPort = 10997;	// node side TX

The sketch will also allow keystrokes to pass thru to the Pulse Patch. Within the 'UDP_Listener', you can control the patch by sending the standard character commands listed by Pulse Patch over serial on startup, or any you wish to create. For your troubleshooting and hacking, serial verbosity can still be received, and transmitted to, via the FTDI VCP connection supplied (9600 baud) while connected to BLE. You will also see verbosity in the Processing terminal, as well as Terminal, where you launched Node.

The data is sampled at 200SPS (PulsePatch_01_BLE.ino, line 91). Samples are packed in groups of 4 for radio transmission, so the over-air data rate is 50 packets per second. The Arduino sketch collects 4 samples, and then stacks them into the BLE packet. The node receives that packet, unfolds it, and delivers 4 samples to the UDP port. Included with this document is a spreadsheet 'MAX30102 Data Format.xlsx' that graphically illustrates this packing scheme. The transmitted sample number starts at 1, and gets reset to 1 at 200. The die temperature is included in the data stream at a sample rate of 1Hz. You will see the die temperature at the end of sample 101. An example of >10 seconds of data is included, located at:

    /PulsePatch-js/UDP_Listener/Pulse Patch Data/Sample_Data.csv

The RED and IR samples are delivered in counts, and the temperature is in degrees C. There is example data contained in the folder Pulse Patch Data.

Enjoy!







