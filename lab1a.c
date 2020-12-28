/*
NAME: Mihir Arya
EMAIL: mihirarya@ucla.edu
ID: 705126618
*/

/* 
File contains the source code for project 1a; the first few functions generally pertain to 
an 'overwrite' of system calls to check for errors more elegantly, the middle contains the 
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
  int x = read(fd,buf,count);
  if ( x==-1 )
    { setExitTerminalModes(); fprintf(stderr, "Read failure with message %s\n", strerror(errno)); exit(1); }
  return x;
}

int mywrite(int fd, void *buf, size_t count)
{
  int x = write(fd,buf,count);
  if ( x==-1 )
    { setExitTerminalModes(); fprintf(stderr, "Write failure with message %s\n",strerror(errno)); exit(1); }
  return x;
}

void myclose(int fd)
{
  int x = close(fd);
  if (x==-1)
    { setExitTerminalModes(); fprintf(stderr, "Close failure with message %s\n", strerror(errno)); exit(1); }
}

void mydup(int fd)
{
  int x = dup(fd);
  if (x==-1)
    { setExitTerminalModes(); fprintf(stderr, "Dup failure with message %s\n", strerror(errno)); exit(1); }
}

void handleSig()
{
  eof=1; // indication that the shell has shut down, so exit while loop
}

void finishExit()
{
  int state;
  if ( waitpid(ChildID, &state, 0) == -1 )
    { setExitTerminalModes(); fprintf(stderr, "Waitpid error with message %s\n", strerror(errno)); exit(1); }
  if (WIFEXITED(state))
    {
      fprintf(stderr, "SHELL EXIT SIGNAL=%d", (state)&0xff);
      fprintf(stderr, " STATUS=%d\n", (state>>8)&0xff); // could also find 0...01111111100000000 number?
    }
  setExitTerminalModes();
}


void generalCase()
{
  char buf [256];
  int x;
  int toExit=0;

  while (!toExit)
  {
    x = myread(0, buf, 256);
    for (int i=0; i<x; i++)
      {
	if (buf[i]==0x04)
	  toExit=1;
	else if (buf[i]==cr || buf[i]==lf)
	  { mywrite(1, &cr, 1); mywrite(1, &lf, 1); }
	else
	  mywrite(1, &(buf[i]), 1);
      }
  }
  setExitTerminalModes();
}

void shellArgCase(char* prog)
{
  int pipeEnteringChild [2];
  int pipeExitingChild [2];
  if ( pipe(pipeEnteringChild) < 0 )
    { setExitTerminalModes(); fprintf(stderr, "Pipe creation failure with message %s\n",strerror(errno)); exit(1); }
  if ( pipe(pipeExitingChild) < 0 )
    { setExitTerminalModes(); fprintf(stderr, "Pipe creation error %s\n",strerror(errno)); exit(1); }
 
  ChildID = fork();
  if (ChildID < 0)
    { setExitTerminalModes(); fprintf(stderr, "Fork failure with msg %s\n",strerror(errno)); exit(1); }
  else if (ChildID==0) // child process 
    {
      myclose( pipeEnteringChild[1] );
      myclose ( pipeExitingChild[0] );

      myclose(0);
      mydup( pipeEnteringChild[0] );

      myclose(1);
      mydup( pipeExitingChild[1] );
      myclose(2);
      mydup( pipeExitingChild[1] );

      if ( execl(prog, prog, (char*)NULL )  == -1 )
	{ setExitTerminalModes(); fprintf(stderr, "Error in executing specified program %s\n", strerror(errno)); exit(1); }
    }
  else if (ChildID>0) // then we in parent with true child id stored
    {
      myclose( pipeEnteringChild[0] );
      myclose( pipeExitingChild[1] );
      
      struct pollfd fds[] = { 
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
	    if ( (res = poll(fds,2,-1)) < 0 )
	      { setExitTerminalModes(); fprintf(stderr, "Poll failure with message %s\n", strerror(errno)); exit(1); }
	    else if (res==0)
	      continue;

	    if ( fds[0].revents & POLLIN ) 
	    {
	      int x = myread(0, buf, 256);
	      for (int i=0; i<x; i++)
	      { 
		if (buf[i]==0x04)
		  myclose(pipeEnteringChild[1]); // don't set eof here; only once eof from shell received
		else if (buf[i]==0x03) // ^C
		  {
		    if ( kill(ChildID,SIGINT)<0 )
		      { setExitTerminalModes(); fprintf(stderr, "Kill to child failure, with message %s\n", strerror(errno)); exit(1); }
		    else
		      childKilled=1; // mark killed
		  }
		else if (buf[i]==cr || buf[i]==lf)
		  {
		    mywrite(1, &cr, 1); mywrite(1, &lf, 1);
		    mywrite(pipeEnteringChild[1], &lf, 1);
		  }
		else
		  {
		    mywrite(1, &(buf[i]), 1);
		    mywrite(pipeEnteringChild[1], &(buf[i]), 1);
		  }
	      }
	      fds[0].revents = 0;
	    }
          

	   else if ( fds[1].revents & POLLIN ) 
	   {	    
	     int y = myread(pipeExitingChild[0], buf, 256);
	     for (int i=0; i<y; i++) 
	     {
	      if (buf[i]==0x04)
		{ eof=1; break; }
	      else if (buf[i]==lf)
		{ mywrite(1, &cr, 1); mywrite(1, &lf, 1); }
	      else 
		mywrite(1, &(buf[i]), 1);
	     }
	     fds[1].revents = 0;
	   }

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

  // obtain and set initial stdin modes                                                              
  if ( tcgetattr(0, &terminalModes) < 0 )
    { fprintf(stderr, "Failure while obtaining terminal attributes (tcgetattr()) with message %s\n", strerror(errno)); exit(1); }
  initIflag = terminalModes.c_iflag;
  initOflag = terminalModes.c_oflag;
  initLflag = terminalModes.c_lflag;
  terminalModes.c_iflag = ISTRIP;
  terminalModes.c_oflag = 0;
  terminalModes.c_lflag = 0;
  if ( tcsetattr(0,TCSANOW, &terminalModes) < 0 )
    { setExitTerminalModes(); fprintf(stderr, "Failure while setting terminal attributes (tcsetattr()), with message %s\n", strerror(errno)); exit(1); }
  // obtain and set initial stdin modes

  // set/fill argument struct
  char* prog=NULL;
  static struct option long_options[] = {
    {"shell", required_argument, 0, 's'},
    {0,0,0,0}
  };
  int in;
  while ( ( in = getopt_long(argc,argv, "", long_options, NULL) ) != -1 )
  {
      if (in == 's')
	prog=optarg; 
      else if (in == '?')
      {
	setExitTerminalModes();
	fprintf(stderr,"Unrecognized argument with message %s\n", strerror(errno));
	exit(1);
      }
  }
  // set/fill argument struct

  if (prog!=NULL) 
    shellArgCase(prog);
  else
    generalCase();

  exit(0);
}
