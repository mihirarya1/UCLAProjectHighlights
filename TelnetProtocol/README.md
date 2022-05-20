NAME: Mihir Arya

This project builds a multi-process telnet-like client and server. This project is cut up into two sections,
part1 and part2:
	-part1: Character-at-a-time, full duplex terminal I/O; Polled I/O and passing input and output between 
	        two processes via interprocess communication paradigms (forking, pipes).
	-part2: passing input and output between a client terminal and remote shell over a TCP socket, and 
	        compressing said inputs and outputs (socket programming).

part1.c contains the implementation for a character-at-a-time full duplex I/O which occurs during the general case, and 
the implementation to pass input in the following manner when --shell argument is passed: Keyboard Input -> Terminal -> 
Shell Process -> Terminal -> Terminal Out. 

part2 is in portions a continuation/adaptation of part1. part2Server.c contains the server side implementation of this 
project; at a high level, it forwards client output (under the rules of part1Client.c) to a child process, and then 
redirects the output of the child process back towards the client. The client (part2Client.c) sends/receives data from the server, posts
data to the screen as necessary, and also mantains a log file of all communication with the server.

The Makefile is capable of building all three of the source files, where the default case is to build all simultaneously. 
It also has a clean command which removes all files from the current working directory except source code, and a dist command 
which produces a tar file.  

References: 

	 https://zlib.net/zlib_how.html 
	 (information on zlib approach)

	 https://docs.microsoft.com/en-us/windows/win32/api/winsock/ns-winsock-hostent#:~:text=The%20hostent%20structure%20is%20used,free%20any%20of%20its%20components.
	 (hostent structure)

	https://www.tutorialspoint.com/inter_process_communication/inter_process_communication_pipes.htm#:~:text=Two%2Dway%
	20Communication%20Using%20Pipes&text=Step%201%20%E2%88%92%20Create%20two%20pipes,2%20%E2%88%92%20Create%20a%20child%20process.
	(The above source was used to gain a high level understanding of the dynamic between parent/child processes and pipes)
