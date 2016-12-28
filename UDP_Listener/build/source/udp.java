import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import hypermedia.net.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class udp extends PApplet {

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
 */

// import UDP library



UDP udp;  // define the UDP object

boolean queryConnection  = true;
/**
 * init
 */
public void setup() {

  // create a new datagram connection on port 6000
  // and wait for incomming message
  udp = new UDP( this, 6000 );
  // udp.log( true ); 		// <-- printout the connection activity
  udp.listen( true );
}

//process events
public void draw() {
  if(queryConnection){
    queryConnection  = false;
    println("udp port " + udp.port() + " listening = " + udp.isListening());
  }

}

/**
 * on key pressed event:
 * send the current key value over the network
 */
public void keyPressed() {

    String message  = str( key );	// the message to send
    String ip       = "localhost";	// the remote IP address
    int port        = 6100;		// the destination port

    // formats the message for Pd
    message = message+";\n";
    // send the message
    udp.send( message, ip, port );

}

/**
 * To perform any action on datagram reception, you need to implement this
 * handler in your code. This method will be automatically called by the UDP
 * object each time he receive a nonnull message.\u00e7
 * By default, this method have just one argument (the received message as
 * byte[] array), but in addition, two arguments (representing in order the
 * sender IP address and his port) can be set like below.
 */
// void receive( byte[] data ) { 			// <-- default handler
public void receive( byte[] data, String ip, int port ) {	// <-- extended handler


  // get the "real" message =
  // forget the ";\n" at the end <-- !!! only for a communication with Pd !!!
  // data = subset(data, 0, data.length-1); //2) // JM attempt to connect to GUI
  String message = new String( data );

  // print the result
  print(message);
  // println( "receive: \""+message+"\" from "+ip+" on port "+port );
}
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "udp" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
