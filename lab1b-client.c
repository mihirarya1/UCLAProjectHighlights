/*                                                                                                                                                                                                       
NAME: Mihir Arya                                                                                                                                                                                         
EMAIL: mihirarya@ucla.edu                                                                                                                                                                               
ID: 705126618                                                                                                                                                                                            
*/

/*                                                                                                                                                                                                      
File contains source code for project 1b client area...                                                                                                                                             
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
  if(setCompress)
    { 
      if ( deflateEnd(&out_stream) == Z_STREAM_ERROR )
        fprintf(stderr, "deflateEnd() failure at client \n");
      if ( inflateEnd(&in_stream) == Z_STREAM_ERROR )
	fprintf(stderr, "inflateEnd() failure at client \n");
    }
  setTerminalModes(iFlagInit,oFlagInit, lFlagInit);            
  exit(exitCode);
}

int mywrite(int fd, void *buf, size_t count)
{
  int x = write(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "Write failure with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

int myread(int fd, void *buf, size_t count)
{
  int x = read(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "Read failure with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

void initializeCompression()
{
  out_stream.zalloc=Z_NULL;
  in_stream.zalloc=Z_NULL;
  out_stream.zfree=Z_NULL;
  in_stream.zfree=Z_NULL;
  out_stream.opaque=Z_NULL;
  in_stream.opaque=Z_NULL;
  if ( deflateInit(&out_stream, Z_DEFAULT_COMPRESSION) != Z_OK )
    { fprintf(stderr, "deflateInit() failure at client with message \n"); exitOut(1); }
  if ( inflateInit(&in_stream) != Z_OK )
    { fprintf(stderr, "inflateInit() failure at client with message \n"); exitOut(1); }
}


int connectToServer(char* port)
{
  int sockfd;
  if ( (sockfd = socket(AF_INET, SOCK_STREAM, 0)) == -1 )
    { fprintf(stderr, "socket() failure at client with message %s\n", strerror(errno)); exitOut(1); }
 
  struct hostent *hostInfo;
  if ( (hostInfo = gethostbyname("localhost")) == NULL )
    { fprintf(stderr, "gethostbyname() failure at client with number %s\n", strerror(h_errno)); exitOut(1); }

  struct sockaddr_in connectServer = { AF_INET, htons(atoi(port)), {0}, {0} };
  bzero(&(connectServer.sin_zero), sizeof(connectServer.sin_zero) );
  memcpy( (void*)(&connectServer.sin_addr.s_addr), (void*)(hostInfo->h_addr_list[0]), hostInfo->h_length );

  if ( connect(sockfd, (struct sockaddr *) &connectServer, sizeof(connectServer)) == -1 )
    { fprintf(stderr, "connect() failure at client with message %s\n", strerror(errno)); exitOut(1); }
  return sockfd;
}

void logWrite(int received, char* buf, int size)
{
  if (received)
    dprintf(fdLog, "RECEIVED %d bytes: ",size);
  else
    dprintf(fdLog, "SENT %d bytes: ", size);
  for (int i=0; i<size; i++)
    dprintf(fdLog, &buf[i]);
  dprintf(fdLog, "\n");
}

int write_compress(int file, char* buf, int writeSize)
{
  char out[128];
  *out=*buf;

  if (!setCompress)
    writeSize = mywrite(file, out, 1);
  else
    {
      out_stream.avail_in = (uInt)writeSize;
      out_stream.next_in = (Bytef *)buf;
      out_stream.next_out = (Bytef *)out; // product needs to be in buf!
      out_stream.avail_out = (uInt)128;

      while (out_stream.avail_in>0)
        if ( deflate(&out_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR)
	   fprintf(stderr, "deflate() failure at client \n");

      writeSize = mywrite(file, out, 128-out_stream.avail_out);
    }

  if (fdLog)
    logWrite(0,out, writeSize);
  
 return writeSize;
}

int read_uncompress(int file, char* buf, int readSize)
{

  readSize = myread(file, buf, readSize);
  if (fdLog)
    logWrite(1,buf, readSize);
  if (setCompress)
    {
      in_stream.avail_in = (uInt)readSize;
      in_stream.next_in = (Bytef *)buf;
      in_stream.next_out = (Bytef *)buf;
      in_stream.avail_out = (uInt)1024;

      while(in_stream.avail_in>0)
        if ( inflate(&in_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR )
	   fprintf(stderr, "inflate() failure at client \n"); 

      readSize = 1024-in_stream.avail_out;
    }
  return readSize;
}


void pollInputs(int file)
{
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
      else if (fds[1].revents & POLLIN) // receive server
	{
	  readSize = read_uncompress(file, buf, 256);
	  if (readSize==0)
	  { 
	    if ( close(file) == -1 )
	      { fprintf(stderr, "close() failure at client with message %s\n", strerror(errno)); exitOut(1); }
	      exitOut(0); 
	  };

	  for (int i=0; i<readSize; i++)
	    mywrite(1, &buf[i], 1);
	}
    }
}


int main ( int argc, char *argv[] )
{

  static struct option long_options[] = {
    {"port", required_argument, 0, 'p'},
    {"log", required_argument, 0, 'l'},
    {"compress", no_argument, 0, 'c'},
    {0,0,0,0}
  };

  int in; char* port=NULL; char* logFile = NULL;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
    {
      if (in == 'p')
        port=optarg;
      else if (in == 'l')
	logFile=optarg;
      else if (in == 'c')
	setCompress=1;
      else if (in == '?')
	{
	  fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	  exit(1);
	}
    }
  if (port==NULL)
    { fprintf(stderr, "Need to specify a --port ' ' argument\n"); exit(1); }
  if (setCompress)
    initializeCompression();
  if (logFile!=NULL)
    { 
      if ( ulimit(UL_SETFSIZE, 10000) == -1 )
	{ fprintf(stderr, "ulimit() failure with message %s\n", strerror(errno)); exitOut(1); }
      fdLog = open(logFile, O_CREAT|O_RDWR|O_TRUNC, 0777); 
    }


  setTerminalModes(ISTRIP,0,0); // set non-cannonical terminal modes

  int file = connectToServer(port);

  pollInputs(file);

  exitOut(0);
}
