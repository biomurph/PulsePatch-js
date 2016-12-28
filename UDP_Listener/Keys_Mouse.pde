

/**
 * on key pressed event:
 * send the current key value over the network
 */
void keyPressed() {
  
  char token = key;
  switch(token){
     case 'b': case 't':
       streamingData = true;
       createFile();
       break;
     case 's': case 'y':
       streamingData = false;
       if(writingToOpenFile){
         dataWriter.flush();
         dataWriter.close();
         writingToOpenFile = false;
         println("closed file " + logFileName);
       }
    
     default:
       break;
  }
  
  if(key == CODED){ return; }
  
    String message  = "k," + str(key) + ",;\n";  // the message to send
    String ip       = "localhost";  // the remote IP address
    //int port        = 6100;    // the destination port

    // formats the message for Pd
    //message = message+";\n";
    // send the message
    udp.send( message, ip, udpTxPort );

}