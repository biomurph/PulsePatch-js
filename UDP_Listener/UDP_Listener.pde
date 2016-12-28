/**
 * (./) udp.pde - how to use UDP library as unicast connection
 * (cc) 2006, Cousot stephane for The Atelier Hypermedia
 * (->) http://hypermedia.loeil.org/processing/
 *
 * Create a communication between Processing<->Pure Data @ http://puredata.info/
 * This program also requires to run a small program on Pd to exchange data
 * (hum!!! for a complete experimentation), you can find the related Pd patch
 * at http://hypermedia.loeil.org/processing/udp.pd
 *
 * -- note that all Pd input/output messages are completed with the characters
 * ";\n". Don't refer to this notation for a normal use. --
 
 
   Modified by Joel Murphy for Pulse Patch Winter 2016
 
 
 */

// import UDP library
import hypermedia.net.*;


UDP udp;  // define the UDP object

boolean queryConnection  = true;
int udpRxPort = 10997;
int udpTxPort = 10996;

//  PULSE PATCH STUFF
boolean streamingData = false;

// LOG FILE STUFF
PrintWriter dataWriter;
String logFileName;
boolean writingToOpenFile = false;

void setup() {

  // create a new datagram connection on port
  // and wait for incomming message
  udp = new UDP( this, udpRxPort );
   //udp.log( true ); 		// <-- printout the connection activity
  udp.listen( true );
}

//process events
void draw() {
  if(queryConnection){
    queryConnection  = false;
    println("udp port " + udp.port() + " listening = " + udp.isListening());
  }

}



/**
 * To perform any action on datagram reception, you need to implement this
 * handler in your code. This method will be automatically called by the UDP
 * object each time he receive a nonnull message.ç
 * By default, this method have just one argument (the received message as
 * byte[] array), but in addition, two arguments (representing in order the
 * sender IP address and his port) can be set like below.
 */
// void receive( byte[] data ) { 			// <-- default handler
void receive( byte[] data, String ip, int port ) {	// <-- extended handler

  if(streamingData){
    // get the "real" message =
    // forget the ";\n" at the end <-- !!! only for a communication with Pd !!!
    String message = new String(data);  // String(subset(data, 0, data.length-1));
    //message += "\n";
    dataWriter.print(message);  // save the Pulse Patch data to file 
    print(message);  // print the result for verbosity and confirmation
    // println( "receive: \""+message+"\" from "+ip+" on port "+port );
  }else{
    print(data);  // print out the message if we're not streaming to file
  }
}