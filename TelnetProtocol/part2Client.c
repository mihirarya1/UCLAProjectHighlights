/*
NAME: Mihir Arya
*/

/* 

This aspect of the telnet project is a continuation of part 1. This file contains all client side acitivites 
needed to process user-input from stdin, send it to a specified port on a specified remote client using TCP 
socket programming, and then receive and process the input from that remote client. Logging options can be specified, 
to record all read/write transactions between the client and the server to stdout. Additionally, a compression option 
can be specified, which will compress any data being sent to the client, and also decompress any data being received 
from the same. 
The first few functions in this file are helper functions pertaining to tasks like safe reads, safe writes, safe 
exits, stream compression intialization, etc. These are followed by functions to process things like compressed reads
and writes, logging, polled I/O from stdin/server. Finally, the main method processes all necessary user inputs and 
options (such as port number, log file if logging specified, etc).

*/


#include <termios.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <getopt.h>
#include <poll.h>
#include <signal.h>
#include <sys/wait.h>
#include <errno.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <ulimit.h>
#include <fcntl.h>
#include <zlib.h>

char cr = 0x0D;
char lf = 0x0A;

struct termios terminalModes;
tcflag_t iFlagInit, oFlagInit, lFlagInit;
z_stream out_stream, in_stream;
int setCompress, fdLog = 0;

void setTerminalModes(tcflag_t iFlag, tcflag_t oFlag, tcflag_t lFlag)
{
  // set terminal nodes in the same fashion as in part 1
  if ( tcgetattr(0, &terminalModes) == -1 )
    { fprintf(stderr, "tcgetatr() failure at client with message %s\n", strerror(errno)); exit(1); }
  iFlagInit = terminalModes.c_iflag;
  oFlagInit = terminalModes.c_oflag;
  lFlagInit = terminalModes.c_lflag;
  terminalModes.c_iflag = iFlag;
  terminalModes.c_oflag = oFlag;
  terminalModes.c_lflag = lFlag;
  if ( tcsetattr(0,TCSANOW, &terminalModes) == -1 )
    { fprintf(stderr, "tcsetattr() failure at client with message %s\n", strerror(errno)); exit(1); }
}

void exitOut (int exitCode)
{
  if(setCompress) // if compression was enabled then close the compression streak ends 
    { 
      if ( deflateEnd(&out_stream) == Z_STREAM_ERROR )
        fprintf(stderr, "deflateEnd() failure at client \n");
      if ( inflateEnd(&in_stream) == Z_STREAM_ERROR )
	fprintf(stderr, "inflateEnd() failure at client \n");
    }
  setTerminalModes(iFlagInit,oFlagInit, lFlagInit); // restore terminal modes prior to exiting            
  exit(exitCode);
}

int mywrite(int fd, void *buf, size_t count)
{
  // write bytes from buffer to file descriptor, analogous to how this was done in part1
  int x = write(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "Write failure with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

int myread(int fd, void *buf, size_t count)
{
   // read bytes from file descriptor to buffer, analogous to how this was done in part1
  int x = read(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "Read failure with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

void initializeCompression() // initialize compression stream
{
  out_stream.zalloc=Z_NULL;
  in_stream.zalloc=Z_NULL;
  out_stream.zfree=Z_NULL;
  in_stream.zfree=Z_NULL;
  out_stream.opaque=Z_NULL;
  in_stream.opaque=Z_NULL;
  if ( deflateInit(&out_stream, Z_DEFAULT_COMPRESSION) != Z_OK ) // initialize compression stream, with default compression level
    { fprintf(stderr, "deflateInit() failure at client with message \n"); exitOut(1); }
  if ( inflateInit(&in_stream) != Z_OK ) // initialize decompression system
    { fprintf(stderr, "inflateInit() failure at client with message \n"); exitOut(1); } 
}


int connectToServer(char* port) // do socket programming to create a TCP level connection to specified port
{
  int sockfd;
  if ( (sockfd = socket(AF_INET, SOCK_STREAM, 0)) == -1 ) // create socket (with IPv4 address family for now)
    { fprintf(stderr, "socket() failure at client with message %s\n", strerror(errno)); exitOut(1); }
 
  struct hostent *hostInfo;
  if ( (hostInfo = gethostbyname("localhost")) == NULL ) // remote is actually just a different port on our same
	  						 // machine (localhost)
    { fprintf(stderr, "gethostbyname() failure at client with number %s\n", strerror(h_errno)); exitOut(1); }

  struct sockaddr_in connectServer = { AF_INET, htons(atoi(port)), {0}, {0} }; // convert port no. from host byte order
									       // to network byte order and read into struct
  bzero(&(connectServer.sin_zero), sizeof(connectServer.sin_zero) ); // copy relevent connection params from sockaddr_in to hostent data structure
  memcpy( (void*)(&connectServer.sin_addr.s_addr), (void*)(hostInfo->h_addr_list[0]), hostInfo->h_length );

  if ( connect(sockfd, (struct sockaddr *) &connectServer, sizeof(connectServer)) == -1 ) // create a connection with params dumped in earlier
    { fprintf(stderr, "connect() failure at client with message %s\n", strerror(errno)); exitOut(1); }
  return sockfd;
}

void logWrite(int received, char* buf, int size)
{ // write to log
  if (received) // bytes were received over TCP
    dprintf(fdLog, "RECEIVED %d bytes: ",size);
  else // bytes were sent over TCP 
    dprintf(fdLog, "SENT %d bytes: ", size);
  for (int i=0; i<size; i++) // write the actual bytes which were sent/received
    dprintf(fdLog, &buf[i]);
  dprintf(fdLog, "\n");
}

int write_compress(int file, char* buf, int writeSize)
{
   // perform write of buffer content to file (using compression if that option was specified)
  char out[128];
  *out=*buf;

  if (!setCompress) // if no compression speficied write normally
    writeSize = mywrite(file, out, 1);
  else // write using compression
    {
      out_stream.avail_in = (uInt)writeSize; // bytes to compress
      out_stream.next_in = (Bytef *)buf; // location of bytes to compress
      out_stream.next_out = (Bytef *)out; // product needs to be in buf!
      out_stream.avail_out = (uInt)128; // number of bytes available in output 'compressed' buffer

      while (out_stream.avail_in>0) // while there are still bytes to compress and output buffer is not full, do compression
        if ( deflate(&out_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR)
	   fprintf(stderr, "deflate() failure at client \n");

      writeSize = mywrite(file, out, 128-out_stream.avail_out); // write compressed buffer to server 
    }

  if (fdLog) // if logging option specified, take note of write content and amount
    logWrite(0,out, writeSize);
  
 return writeSize;
}

int read_uncompress(int file, char* buf, int readSize)
{
  // perform read of file content to buffer (using decompression if that option was specified earlier)
  readSize = myread(file, buf, readSize); // read bytes from server
  if (fdLog) // if logging on take note of read size
    logWrite(1,buf, readSize);
  if (setCompress) // if bytes read are actually compressed then uncompress them
    {
      in_stream.avail_in = (uInt)readSize; // bytes available from read
      in_stream.next_in = (Bytef *)buf; // location of said bytes
      in_stream.next_out = (Bytef *)buf;
      in_stream.avail_out = (uInt)1024; // max output buffer size on uncompression pipeline

      while(in_stream.avail_in>0) // while there are bytes to still uncompress and output buffer size is not exceeded, uncompress
        if ( inflate(&in_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR )
	   fprintf(stderr, "inflate() failure at client \n"); 

      readSize = 1024-in_stream.avail_out; // number of bytes which were uncompressed
    }
  return readSize;
}


void pollInputs(int file)
{
	
  // poll the server and stdin for inputs, analogous to how was done in part1
  struct pollfd fds[] = {
    { 0, POLLIN, 0 },
    { file, POLLIN, 0 }
  };

  char buf [1024];
  int readSize;
  int res;
  while(1==1)
    {

      if ( (res = poll(fds,2,-1)) < 0 )
	{ fprintf(stderr, "Poll failure with message %s\n", strerror(errno)); exitOut(1); }
      else if (res==0)
	continue;

      if (fds[0].revents & POLLIN) // stdin
	{
	  // read normally from stdin and then write (using compression if specified) to server, handling
	  // cr/lf to crlf mappings as necessary
	  readSize = myread(0, buf, 256); 
	  for (int i=0; i<readSize; i++)
	    { 
	      if (buf[i]==cr || buf[i]==lf)
		{ mywrite(1, &cr, 1); mywrite(1, &lf, 1); }
	      else
		mywrite(1, &buf[i], 1); 
	      write_compress(file, &buf[i], 1);
	    }
	}
      else if (fds[1].revents & POLLIN) // received server data
	{
	  readSize = read_uncompress(file, buf, 256); // read from server (using compression if specified)
	  if (readSize==0) // if server stops sending us data for some reason unexpectedly (ie without eof), begin exit process
	  { 
	    if ( close(file) == -1 )
	      { fprintf(stderr, "close() failure at client with message %s\n", strerror(errno)); exitOut(1); }
	      exitOut(0); 
	  };

	  for (int i=0; i<readSize; i++) // write data from server to stdout normally, character-at-a-time.
	    mywrite(1, &buf[i], 1);
	}
    }
}


int main ( int argc, char *argv[] )
{

  static struct option long_options[] = {
    {"port", required_argument, 0, 'p'}, // port number requisites an string destination port passed in
    {"log", required_argument, 0, 'l'}, // log requisites a filename to which TCP communication will be saved. 
    {"compress", no_argument, 0, 'c'}, // no argument for compress
    {0,0,0,0}
  };

  int in; char* port=NULL; char* logFile = NULL;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
    {
      if (in == 'p') // read in port
        port=optarg;
      else if (in == 'l') // read in log filename
	logFile=optarg;
      else if (in == 'c') // compression option on 
	setCompress=1;
      else if (in == '?') // unknown arg
	{
	  fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	  exit(1);
	}
    }
  if (port==NULL) // port needs to be specified
    { fprintf(stderr, "Need to specify a --port ' ' argument\n"); exit(1); }
  if (setCompress)
    initializeCompression(); // initialize compression paradigms
  if (logFile!=NULL) // if log file specified 
    { 
      if ( ulimit(UL_SETFSIZE, 10000) == -1 ) // sets an upper bound on the case of log file, in case we write to log file infinitely say
	{ fprintf(stderr, "ulimit() failure with message %s\n", strerror(errno)); exitOut(1); }
      fdLog = open(logFile, O_CREAT|O_RDWR|O_TRUNC, 0777); // open log file with given permissions 
    }


  setTerminalModes(ISTRIP,0,0); // set non-cannonical terminal modes

  int file = connectToServer(port); // open connection to specified port on server ('localhost') for now

  pollInputs(file); // poll inputs from stdin and server

  exitOut(0);
}
