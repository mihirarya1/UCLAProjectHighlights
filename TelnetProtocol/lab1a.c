/*
NAME: Mihir Arya
EMAIL: mihirarya@ucla.edu
ID: 705126618
*/

/* 
File contains the source code for the first part of this project; the first few functions generally 
pertain to an wrapper of system calls to check for errors more elegantly, the middle contains the 
code for case with no argument and with a shell argument, and the final section contains main.
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

char cr = 0x0D; // constants 
char lf = 0x0A; 
int eof = 0; // global vars
int childKilled=0;
pid_t ChildID;
tcflag_t initIflag;
tcflag_t initOflag;
tcflag_t initLflag;
struct termios terminalModes;


void setExitTerminalModes()
{
  // set final terminal modes to original at end                                                                                                                           
  terminalModes.c_iflag = initIflag;
  terminalModes.c_oflag = initOflag;
  terminalModes.c_lflag = initLflag;
  if ( tcsetattr(0,TCSANOW, &terminalModes) < 0 )
    { fprintf(stderr, "Failure while setting terminal attributes (tcsetattr), with message %s\n", strerror(errno)); exit(1); }
  // set final terminal modes to original at end
}

int myread(int fd, void *buf, size_t count) 
{
  // perform a read of count bytes from the start of the given file descriptor into buffer
  int x = read(fd,buf,count);
  if ( x==-1 )
    { setExitTerminalModes(); fprintf(stderr, "Read failure with message %s\n", strerror(errno)); exit(1); }
  return x;
  // perform a read of count bytes from the start of the given file descriptor into buffer
}

int mywrite(int fd, void *buf, size_t count)
{
  // perform a write of count bytes into the start of the given file descriptor from the buffer
  int x = write(fd,buf,count);
  if ( x==-1 )
    { setExitTerminalModes(); fprintf(stderr, "Write failure with message %s\n",strerror(errno)); exit(1); }
  return x;
   // perform a write of count bytes into the start of the given file descriptor from the buffer
}

void myclose(int fd)
{
  // close file descriptor
  int x = close(fd);
  if (x==-1)
    { setExitTerminalModes(); fprintf(stderr, "Close failure with message %s\n", strerror(errno)); exit(1); }
  // close file descriptor
}

void mydup(int fd)
{
  // create duplicate file descriptor (get lowest unused file descriptor and set that to refer to fd).
  int x = dup(fd);
  if (x==-1)
    { setExitTerminalModes(); fprintf(stderr, "Dup failure with message %s\n", strerror(errno)); exit(1); }
  // create duplicate file descriptor
}

void handleSig()
{
  eof=1; // indication that the shell has shut down, so exit while loop
}

void finishExit()
{
  // waits for change in state of child (shell) process and terminate the terminal once this is done.
  int state;
  if ( waitpid(ChildID, &state, 0) == -1 ) 
    { setExitTerminalModes(); fprintf(stderr, "Waitpid error with message %s\n", strerror(errno)); exit(1); }
  if (WIFEXITED(state)) // child (shell) process successfully exited 
    {
      fprintf(stderr, "SHELL EXIT SIGNAL=%d", (state)&0xff);
      fprintf(stderr, " STATUS=%d\n", (state>>8)&0xff); // could also find 0...01111111100000000 number?
    }
  setExitTerminalModes(); // set terminal exit procedure
  // waits for change in state of child (shell) process and terminate the terminal once this is done.
}


void generalCase()
{
	

  char buf [256];
  int x;
  int toExit=0;
  
  /* read in from stdin 256 bytes at a time until eof found, printing characters as is to stdout
     with the exception of mapping any <cr> or <lf> occurence to <cr><lf> */
  while (!toExit)
  {
    x = myread(0, buf, 256); // read 256 bytes from stdin into buf
    for (int i=0; i<x; i++)
      {
	if (buf[i]==0x04) // if received eof, then exit
	  toExit=1;
	else if (buf[i]==cr || buf[i]==lf) // if received <cr> or <lf>, then map said occurence to <cr><lf>
	  { mywrite(1, &cr, 1); mywrite(1, &lf, 1); }
	else
	  mywrite(1, &(buf[i]), 1); // otherwise write character exactly as is to stdout
      }
  }
  setExitTerminalModes(); // set exit terminal procedures
}

void shellArgCase(char* prog)
{
  // handles the case where we wish to pass input/output between a shell and terminal
	
  // create to/from pipe between terminal and shell
  int pipeEnteringChild [2];
  int pipeExitingChild [2];
  if ( pipe(pipeEnteringChild) < 0 ) 
    { setExitTerminalModes(); fprintf(stderr, "Pipe creation failure with message %s\n",strerror(errno)); exit(1); }
  if ( pipe(pipeExitingChild) < 0 )
    { setExitTerminalModes(); fprintf(stderr, "Pipe creation error %s\n",strerror(errno)); exit(1); }
  // create to/from pipe between terminal and shell
 
  ChildID = fork(); // create child process (shell)
  if (ChildID < 0)
    { setExitTerminalModes(); fprintf(stderr, "Fork failure with msg %s\n",strerror(errno)); exit(1); }
  else if (ChildID==0) // we are in child process 
    {
      // set two-way pipe between shell and terminal with the appropriate endpoints
      myclose( pipeEnteringChild[1] ); 
      myclose ( pipeExitingChild[0] );

      myclose(0);
      mydup( pipeEnteringChild[0] );

      myclose(1);
      mydup( pipeExitingChild[1] );
      myclose(2);
      mydup( pipeExitingChild[1] );
      // set two-way pipe between shell and terminal with the appropriate endpoints

      if ( execl(prog, prog, (char*)NULL )  == -1 ) // execute specified program
	{ setExitTerminalModes(); fprintf(stderr, "Error in executing specified program %s\n", strerror(errno)); exit(1); }
    }
  else if (ChildID>0) // then we in parent with true child id stored
    {
      myclose( pipeEnteringChild[0] );
      myclose( pipeExitingChild[1] );
      
      struct pollfd fds[] = { // in the parent we will poll both stdin and the child, since this is duplex communication
	{ 0, POLLIN, 0 },
	{ pipeExitingChild[0], POLLIN, 0 }
      };

      if ( signal(SIGPIPE,handleSig) == SIG_ERR )
	{ setExitTerminalModes(); fprintf(stderr, "Error setting up signal, with message %s\n", strerror(errno)); exit(1); }

      int res;
      char buf [256];
      int eof=0;
      while(!eof)
	{
	    if ( (res = poll(fds,2,-1)) < 0 ) // poll are two input streams for the parent
	      { setExitTerminalModes(); fprintf(stderr, "Poll failure with message %s\n", strerror(errno)); exit(1); }
	    else if (res==0) // neither stream is ready, keep waiting
	      continue;

	    if ( fds[0].revents & POLLIN ) // stdin has input ready 
	    {
	      int x = myread(0, buf, 256); // perform read from stdin
	      for (int i=0; i<x; i++)
	      { 
		if (buf[i]==0x04)
		  myclose(pipeEnteringChild[1]); // don't set eof here; only once eof from shell received
		else if (buf[i]==0x03) // ^C, or siginterrupt command to be given to the child
		  {
		    if ( kill(ChildID,SIGINT)<0 )
		      { setExitTerminalModes(); fprintf(stderr, "Kill to child failure, with message %s\n", strerror(errno)); exit(1); }
		    else
		      childKilled=1; // mark killed
		  }
		else if (buf[i]==cr || buf[i]==lf)
		  {
		    // map <cr> or <lf> to <cr><lf> as done earlier
		    mywrite(1, &cr, 1); mywrite(1, &lf, 1);
		    mywrite(pipeEnteringChild[1], &lf, 1);
		  }
		else
		  {
		    mywrite(1, &(buf[i]), 1); // if normal character, just write to child as is 
		    mywrite(pipeEnteringChild[1], &(buf[i]), 1);
		  }
	      }
	      fds[0].revents = 0;
	    }
          

	   else if ( fds[1].revents & POLLIN ) // if shell has input for the terminal
	   {	    
	     int y = myread(pipeExitingChild[0], buf, 256); // read from shell
	     for (int i=0; i<y; i++) 
	     {
	      if (buf[i]==0x04) // if shell sent us an eof, set eof
		{ eof=1; break; }
	      else if (buf[i]==lf) // if shell sent us an <lf> map to <cr><lf>
		{ mywrite(1, &cr, 1); mywrite(1, &lf, 1); }
	      else // otherwise map as is
		mywrite(1, &(buf[i]), 1);
	     }
	     fds[1].revents = 0;
	   }

	   // if we get any kind of poll interrupt or poll error, set exit condition. 
	   else if ( (fds[0].revents & POLLHUP) || (fds[0].revents & POLLERR) || (fds[1].revents & POLLHUP) || (fds[1].revents & POLLERR) ) 
	     eof=1;
       }
      // ensures that write fd to shell is closed if not already (case where shell exits due to ^C)
      if ( close(pipeEnteringChild[1])<0 )
	if ( errno != EBADF && errno!=0 ) // if file has already been closed error, then ok
	  { setExitTerminalModes(); fprintf(stderr, "Close failure with message %s\n", strerror(errno)); exit(1); }
      if (!childKilled) // if child was already killed then dont kill
	if ( kill(ChildID,SIGINT) < 0 )
	  { setExitTerminalModes(); fprintf(stderr, "Failure when killing child with message %s\n", strerror(errno)); exit(1); }
      finishExit(); // go obtain exit code and set terminal modes
    }
}


int main( int argc, char *argv[] )
{

  // obtain and set initial stdin terminal modes (these                                                          
  if ( tcgetattr(0, &terminalModes) < 0 ) // get terminal modes
    { fprintf(stderr, "Failure while obtaining terminal attributes (tcgetattr()) with message %s\n", strerror(errno)); exit(1); }
  initIflag = terminalModes.c_iflag;
  initOflag = terminalModes.c_oflag;
  initLflag = terminalModes.c_lflag;
  terminalModes.c_iflag = ISTRIP; // only lower 7 bits
  terminalModes.c_oflag = 0; // no processing
  terminalModes.c_lflag = 0; // no processing 
  if ( tcsetattr(0,TCSANOW, &terminalModes) < 0 ) // set terminal modes
    { setExitTerminalModes(); fprintf(stderr, "Failure while setting terminal attributes (tcsetattr()), with message %s\n", strerror(errno)); exit(1); }
  // obtain and set initial stdin modes

  // set/fill argument struct
  char* prog=NULL;
  static struct option long_options[] = {
    {"shell", required_argument, 0, 's'}, // shell is the only possible argument and determines whether we want output to a shell or to stdout (default)
    {0,0,0,0}
  };
  int in;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
  {
      if (in == 's')
	prog=optarg; // set argument 
      else if (in == '?') // if invalid argument passed in
      {
	setExitTerminalModes(); // restore terminal modes
	fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	exit(1); // and then exit
      }
  }
  // set/fill argument struct

  if (prog!=NULL) // if argument was inputted print to shell with name specified
    shellArgCase(prog);
  else
    generalCase();

  exit(0);
}
