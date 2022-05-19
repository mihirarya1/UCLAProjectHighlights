/*
NAME: Mihir Arya
EMAIL: mihirarya@ucla.edu
ID: 705126618
*/

/* 
File contains the source code for project 1b, server area...
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
#include <netinet/in.h>
#include <netinet/ip.h>
#include <netdb.h>
#include <fcntl.h>
#include <zlib.h>

z_stream out_stream;
z_stream in_stream;
char cr = 0x0D; // constants 
char lf = 0x0A; 
int eof = 0; // global vars
int childKilled=2;
pid_t ChildID;
int setCompress=0;


void exitOut(int exitCode)
{
  if (childKilled==0) // if child was already killed then dont kill                                                                              
    if ( kill(ChildID,SIGINT) < 0 )
      { fprintf(stderr, "Failure when killing child with message %s\n", strerror(errno)); exit(1); }

  if(setCompress)
    {
      if ( deflateEnd(&out_stream) == Z_STREAM_ERROR ) // not technically a sys call
        fprintf(stderr, "deflateEnd() failure at server \n");
      if ( inflateEnd(&in_stream) == Z_STREAM_ERROR )
        fprintf(stderr, "inflateEnd() failure at server \n");
    }
  exit(exitCode);
}

int myread(int fd, void *buf, size_t count)
{
  int x = read(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "read() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  return x;
}

int mywrite(int fd, void *buf, size_t count)
{
  int x = write(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "write() failure in server with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

void myclose(int fd)
{
  int x = close(fd);
  if (x==-1)
    { fprintf(stderr, "close() failure in server with message %s\n", strerror(errno)); exitOut(1); }
}

void mydup(int fd)
{
  int x = dup(fd);
  if (x==-1)
    { fprintf(stderr, "dup() failure at server with message %s\n", strerror(errno)); exitOut(1); }
}

void handleSig()
{
  eof=1; // indication that the shell has shut down, so exit while loop
}

void finishExit(int file)
{
  int state;
  if ( waitpid(ChildID, &state, 0) == -1 )
    { fprintf(stderr, "waitpid() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  if (WIFEXITED(state))
    {
      fprintf(stderr, "SHELL EXIT SIGNAL=%d", (state)&0xff);
      fprintf(stderr, " STATUS=%d\n", (state>>8)&0xff); // could also find 0...01111111100000000 number?
    }
  if ( shutdown(file,SHUT_WR) == -1 )
    { fprintf(stderr, "shutdown() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  exitOut(0);
}

int establishConnection (int port)
{
  int sockfd;
  if ( (sockfd = socket(AF_INET, SOCK_STREAM, 0)) == -1 )
    { fprintf(stderr, "socket() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  struct sockaddr_in connectionDetails = { AF_INET, htons(port), {INADDR_ANY}, {0,0,0,0,0,0,0,0} };
  int length = sizeof(connectionDetails);
  bzero(&(connectionDetails.sin_zero), sizeof(connectionDetails.sin_zero) );

  if ( bind(sockfd, (struct sockaddr *) &connectionDetails, length ) == -1 )
    { fprintf(stderr, "bind() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  
  if ( listen(sockfd, 5) == -1 )
    { fprintf(stderr, "listen() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  
  int file;
  if ( (file = accept(sockfd, (struct sockaddr *) &connectionDetails, (socklen_t *) &length )) == -1 )
    { fprintf(stderr, "accept() failure at server with message %s\n", strerror(errno)); exitOut(1); }
    
  return file;
}

void initializeCompression()
{
  out_stream.zalloc=Z_NULL;
  in_stream.zalloc=Z_NULL;
  out_stream.zfree=Z_NULL;
  in_stream.zfree=Z_NULL;
  out_stream.opaque=Z_NULL;
  in_stream.opaque=Z_NULL;
  if ( deflateInit(&out_stream, Z_DEFAULT_COMPRESSION) != Z_OK ) // if this fails then doesn't make sense to continue execution
    { fprintf(stderr, "deflateInit() failure i n server with message \n"); exitOut(1); }
  if ( inflateInit(&in_stream) != Z_OK )
    { fprintf(stderr, "inflateInit() failure at server with message \n"); exitOut(1); }
}

int write_compress(int file, char* buf)
{
  int writeSize=1;
  char bufOut[128];
  if (!setCompress)
    writeSize = mywrite(file, buf, 1);
  else
    {
      out_stream.avail_in = (uInt)(writeSize);
      out_stream.next_in = (Bytef *)buf;
      out_stream.next_out = (Bytef *)bufOut;                            
      out_stream.avail_out = (uInt)128;

      while (out_stream.avail_in>0)
        if ( deflate(&out_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR)
	  fprintf(stderr, "deflate() failure at server \n");

      writeSize = mywrite(file, bufOut, 128-out_stream.avail_out);
    }
  return writeSize;
}


int read_uncompress(int file, char* buf, int readSize)
{                                                                                                                                                 
  readSize = myread(file, buf, readSize); // read of 256 is current def.
  if (setCompress)
    {
      in_stream.avail_in = (uInt)readSize;
      in_stream.next_in = (Bytef *)buf;
      in_stream.next_out = (Bytef *)buf;
      in_stream.avail_out = (uInt)1024;
      
      while(in_stream.avail_in>0)
	if ( inflate(&in_stream, Z_SYNC_FLUSH) == Z_STREAM_ERROR )
	  fprintf(stderr, "inflate() failure at client \n");

      readSize= 1024-in_stream.avail_out;
    }                                                                                                                    
  return readSize;
}


void shellArgCase(char* prog, int file)
{
  int pipeEnteringChild [2];
  int pipeExitingChild [2];
  if ( pipe(pipeEnteringChild) < 0 )
    { fprintf(stderr, "Pipe creation failure with message %s\n",strerror(errno)); exitOut(1); }
  if ( pipe(pipeExitingChild) < 0 )
    { fprintf(stderr, "Pipe creation error %s\n",strerror(errno)); exitOut(1); }
 
  ChildID = fork();
  if (ChildID < 0)
    { fprintf(stderr, "Fork failure with msg %s\n",strerror(errno)); exitOut(1); }
  else if (ChildID==0) // child process 
    { 
      childKilled=0;
      myclose( pipeEnteringChild[1] );
      myclose ( pipeExitingChild[0] );

      myclose(0);
      mydup( pipeEnteringChild[0] );

      myclose(1);
      mydup( pipeExitingChild[1] );
      myclose(2);
      mydup( pipeExitingChild[1] );

      if ( execl(prog, prog, (char*)NULL )  == -1 )
	{ fprintf(stderr, "Error in executing specified program %s\n", strerror(errno)); exitOut(1); }
    }
  else if (ChildID>0) // then we in parent with child id stored
    {
      childKilled=0;
      myclose( pipeEnteringChild[0] );
      myclose( pipeExitingChild[1] );
      
      struct pollfd fds[] = { 
	{ file, POLLIN, 0 },
	{ pipeExitingChild[0], POLLIN, 0 }
      };

      if ( signal(SIGPIPE,handleSig) == SIG_ERR )
	{ fprintf(stderr, "Error setting up signal, with message %s\n", strerror(errno)); exitOut(1); }
      
      int res;
      char buf [1024];
      int eof=0;
      while(!eof)
	{
	    if ( (res = poll(fds,2,-1)) < 0 )
	      { fprintf(stderr, "Poll failure with message %s\n", strerror(errno)); exitOut(1); }
	    else if (res==0)
	      continue;

	    if ( fds[0].revents & POLLIN ) // read from client 
	    {
	      int x = read_uncompress(file, buf, 256); // read_uncompress
	      for (int i=0; i<x; i++)
	      { 
		if (buf[i]==0x04)
		  myclose(pipeEnteringChild[1]); // don't set eof here; only once eof from shell received
		else if (buf[i]==0x03) // ^C
		  {
		    if ( kill(ChildID,SIGINT)<0 )
		      { fprintf(stderr, "Kill to child failure, with message %s\n", strerror(errno)); exitOut(1); }
		    else
		      childKilled=1; // mark killed
		  }
		else if (buf[i]==cr || buf[i]==lf)
		    mywrite(pipeEnteringChild[1], &lf, 1);
		else
		    mywrite(pipeEnteringChild[1], &(buf[i]), 1);
	      }
	    }
          
	    else if ( fds[1].revents & POLLIN ) // write to client
	   {	    
	     int y = myread(pipeExitingChild[0], buf, 256);
	     for (int i=0; i<y; i++) 
	     {
	      if (buf[i]==0x04)
		{ eof=1; break; }
	      else if (buf[i]==lf)
		{ write_compress(file, &cr); write_compress(file, &lf); }
	      else 
		write_compress(file, &(buf[i]));
	     }
	     fds[1].revents = 0;
	   }

	    else if ( (fds[0].revents & POLLERR) || (fds[0].revents & POLLHUP) ) //|| (fds[1].revents & POLLERR) )
	      myclose(pipeEnteringChild[1]);
	    else if ( (fds[1].revents & POLLERR) || (fds[1].revents & POLLHUP) ) 
	      eof=1;
       }
 
     // ensures that write fd to shell is closed if not already (case where shell exits due to ^C)
      if ( close(pipeEnteringChild[1])<0 )
	if ( errno != EBADF && errno!=0 ) // if file has already been closed error, then ok
	  { fprintf(stderr, "Close failure with message %s\n", strerror(errno)); exitOut(1); }

      if (!childKilled) // if child was already killed then dont kill
	{
	  if ( kill(ChildID,SIGINT) < 0 )
	    { fprintf(stderr, "Failure when killing child with message %s\n", strerror(errno)); exitOut(1); }
	  else
	    childKilled=1;
	}

      finishExit(file); // go obtain exit code and set terminal modes
    }
}


int main( int argc, char *argv[] )
{

  // set/fill argument struct
  char* prog=NULL;
  char* port=NULL;
  static struct option long_options[] = {
    {"shell", required_argument, 0, 's'},
    {"port", required_argument, 0, 'p' },
    {"compress", no_argument, 0, 'c' },
    {0,0,0,0}
  };

  int in;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
  {
      if (in == 's')
	prog=optarg; 
      else if (in == 'p')
	port=optarg;
      else if (in == 'c')
	setCompress=1;
      else if (in == '?')
      {
	fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	exit(1);
      }
  }
  if (port==NULL || prog==NULL)
    { fprintf(stderr, "Must enter arguments --port ' ' and --shell ' ' \n"); exit(1); }
  // set/fill argument struct
  
  if (setCompress)
    initializeCompression();
  
  int file = establishConnection(atoi(port));

  shellArgCase(prog,file);
 
}
