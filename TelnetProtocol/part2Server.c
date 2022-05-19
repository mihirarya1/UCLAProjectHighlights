/*
NAME: Mihir Arya
*/

/* 

This aspect of the telnet project is a continuation of part 1. This file contains all server side acitivites 
needed to process user-input sent from the client on the specified port using TCP. We (the server) process 
(uncompress, map cr/lf to <cr><lf>) this data as necessary, and then send it to a child shell via interprocess 
communication methods (pipes, as was done in part 1). The child then does mappings of <lf> to <cr><lf> as necessary 
and sends this data back to the main server routing via pipes. The server finally performs compression on this data
as needed and sends it back to the client via TCP. Edge cases relating to ^C or EOF's from the client or child 
process are appropriately handled, bearing in mind proper close down procedures of open pipes or compression streams
if these commands are received. 

The first few functions in this file are helper methods relating to safe reads/writes/exits. The middle portion
pertains to appropriately initializing and using compression streams, creating a TCP connection to the client, and 
polling/sending input from the client, and the child process. Finally, the main function handles user arguments like 
port number, child process name, compression scheme, etc. 
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
  // code to safetly exit out 
  if (childKilled==0) // if child was already killed then dont kill                                                                              
    if ( kill(ChildID,SIGINT) < 0 )
      { fprintf(stderr, "Failure when killing child with message %s\n", strerror(errno)); exit(1); }

  if(setCompress) // close compression paradigms if they were opened
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
  // read bytes from file descriptor into buffer
  int x = read(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "read() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  return x;
}

int mywrite(int fd, void *buf, size_t count)
{
  // write bytes from buffer into file descriptor
  int x = write(fd,buf,count);
  if ( x==-1 )
    { fprintf(stderr, "write() failure in server with message %s\n",strerror(errno)); exitOut(1); }
  return x;
}

void myclose(int fd)
{
  // close the specified file descriptor
  int x = close(fd);
  if (x==-1)
    { fprintf(stderr, "close() failure in server with message %s\n", strerror(errno)); exitOut(1); }
}

void mydup(int fd)
{
  // duplicate the specified file descriptor
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
  // function to handle normal exists (unexpected exits are handled by exitOut())
  int state;
  if ( waitpid(ChildID, &state, 0) == -1 ) // wait for the child process terminate
    { fprintf(stderr, "waitpid() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  if (WIFEXITED(state)) // if the child has terminated notify the user 
    {
      fprintf(stderr, "SHELL EXIT SIGNAL=%d", (state)&0xff);
      fprintf(stderr, " STATUS=%d\n", (state>>8)&0xff); // could also find 0...01111111100000000 number?
    }
  if ( shutdown(file,SHUT_WR) == -1 ) // close server side of tcp connection on port
    { fprintf(stderr, "shutdown() failure at server with message %s\n", strerror(errno)); exitOut(1); }
  exitOut(0);
}

int establishConnection (int port)
{
  // open a TCP socket connection on the specified port. analogous to the function of the same name on client side
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
  // initialize uncompression stream (to get compressed data from client) and compression scheme (so that said data can be sent to client).
  // this is done without loss of generality from how compression/uncompression schemes are set up on the client.
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
  // write data from buffer to file (client, using compression if specified), analogous to the method of the same name on client.
  int writeSize=1; // character-at-a-time
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
  // read data from buffer to file (from client, using decompression if specified), analogous to the method of the same name on client. 
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

  // open unidirectional pipe to child process (shell) 
  int pipeEnteringChild [2];
  int pipeExitingChild [2];
  if ( pipe(pipeEnteringChild) < 0 )
    { fprintf(stderr, "Pipe creation failure with message %s\n",strerror(errno)); exitOut(1); }
  if ( pipe(pipeExitingChild) < 0 )
    { fprintf(stderr, "Pipe creation error %s\n",strerror(errno)); exitOut(1); }
 
  ChildID = fork(); // fork a child process (shell)
  if (ChildID < 0) // fork was unsuccessful
    { fprintf(stderr, "Fork failure with msg %s\n",strerror(errno)); exitOut(1); }
  else if (ChildID==0) // we are in the child process 
    { 
      childKilled=0; // child is alive
	  
      // rearrange pipes to be able to send and receive outputs from the parent process (terminal) (inter-process-communication)
      myclose( pipeEnteringChild[1] );
      myclose ( pipeExitingChild[0] );

      myclose(0);
      mydup( pipeEnteringChild[0] );

      myclose(1);
      mydup( pipeExitingChild[1] );
      myclose(2);
      mydup( pipeExitingChild[1] );

      if ( execl(prog, prog, (char*)NULL )  == -1 ) // runs the specified binary executable
	{ fprintf(stderr, "Error in executing specified program %s\n", strerror(errno)); exitOut(1); }
    }
  else if (ChildID>0) // then we in parent with child id stored
    {
      // child is alive, rearrange pipes to be able to send and receive data via IPC to the child shell. 
      childKilled=0;
      myclose( pipeEnteringChild[0] );
      myclose( pipeExitingChild[1] );
      
      struct pollfd fds[] = { // poll on input from the user via stdin (which has come from the client since we're 
	      		      // on the server technically) and from the shell process
	{ file, POLLIN, 0 },
	{ pipeExitingChild[0], POLLIN, 0 }
      };

      if ( signal(SIGPIPE,handleSig) == SIG_ERR )
	{ fprintf(stderr, "Error setting up signal, with message %s\n", strerror(errno)); exitOut(1); }
      
      int res;
      char buf [1024];
      int eof=0;
      while(!eof) // while no end of file char received
	{
	    if ( (res = poll(fds,2,-1)) < 0 )
	      { fprintf(stderr, "Poll failure with message %s\n", strerror(errno)); exitOut(1); }
	    else if (res==0) // keep waiting, no one is ready
	      continue;

	    if ( fds[0].revents & POLLIN ) // read from client 
	    {
	      int x = read_uncompress(file, buf, 256); // read_uncompress performing actual uncompression if that option specified on client end
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
		else if (buf[i]==cr || buf[i]==lf) // perform cr/lf mapping to <cr><lf>
		    mywrite(pipeEnteringChild[1], &lf, 1);
		else // if not cr/lf write character normally to child process
		    mywrite(pipeEnteringChild[1], &(buf[i]), 1);
	      }
	    }
          
	    else if ( fds[1].revents & POLLIN ) // read data from the shell since its ready, and write back to client
	   {	    
	     int y = myread(pipeExitingChild[0], buf, 256); // perform read of data from shell
	     for (int i=0; i<y; i++) 
	     {
	      if (buf[i]==0x04) // eof received
		{ eof=1; break; }
	      else if (buf[i]==lf) // lf received, map it to <cr><lf> and write to client (using compression if specified)
		{ write_compress(file, &cr); write_compress(file, &lf); }
	      else // normal character received write it normally to client (using compression if specified)
		write_compress(file, &(buf[i]));
	     }
	     fds[1].revents = 0;
	   }

	    else if ( (fds[0].revents & POLLERR) || (fds[0].revents & POLLHUP) ) //|| (fds[1].revents & POLLERR) )
	      myclose(pipeEnteringChild[1]); // if poll error from stdin 
	    else if ( (fds[1].revents & POLLERR) || (fds[1].revents & POLLHUP) ) // if eof received from shell set eof bit
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
    {"shell", required_argument, 0, 's'}, // shell option means we will send all data from ourselves to a shell (child)
    {"port", required_argument, 0, 'p' }, // port number which the server should listen on, and expect client to write data to
    {"compress", no_argument, 0, 'c' }, // specifies whether client sends/expects-to-receive compressed data from server (us)
    {0,0,0,0}
  };

  int in;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
  {
      if (in == 's') // if shell option
	prog=optarg; 
      else if (in == 'p') // port number
	port=optarg;
      else if (in == 'c') // compression specified
	setCompress=1;
      else if (in == '?') // unknown arg
      {
	fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	exit(1);
      }
  }
  if (port==NULL || prog==NULL) // if no port specified or shell option not (unlike in part 1, we wish to send data to shell process everytime)
    { fprintf(stderr, "Must enter arguments --port ' ' and --shell ' ' \n"); exit(1); }
  // set/fill argument struct
  
  if (setCompress) // initialize compression scheme if option specified
    initializeCompression();
  
  int file = establishConnection(atoi(port)); // create a tcp socket connection on specified port we are expecting to receive data on

  shellArgCase(prog,file); // create child process, write data to it from client, receive said data back from shell, and then forward it back to client
 
}
