

/*

    WRITE THE INCOMING GANGLION DATA TO FILE
    NODE WILL SEND IT AS A csv STRING
    The temperature value is sampled once per second and written on the 104th sample
    "SAMPLENUMBER,RED_LED value,IR_LED value,Temp\n"

*/


void createFile(){
   logFileName = "Pulse Patch Data/"+month()+"-"+day()+"_"+hour()+"-"+minute()+".csv";
   dataWriter = createWriter(logFileName);
   dataWriter.println("%Pulse Patch Data Log " + month()+"/"+day()+" "+hour()+":"+minute());
   dataWriter.println("%RED and IR values in Counts, Temp values in degrees C");
   dataWriter.println("%\n%,,Sample,RED,IR,TEMP");
   writingToOpenFile = true;
}