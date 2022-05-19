#/*                                                                                                                                                                                                      
#NAME: Mihir Arya                                                                                                                                                                                                                                                                                                                                                                                  
#*/

#/*                                                                                                                                                                                                      
#File contains the overall Makefile                                                                                                                              
#*/



# Makefile

default: part2Client.c part2Server.c part1.c
	gcc part2Client.c -Wall -Wextra -lz -o part2Client
	gcc part2Server.c -Wall -Wextra -lz -o part2Server
	gcc lab1a.c -Wall -Wextra -o lab1a

lab1a: part1.c 
	gcc part1.c -Wall -Wextra -o part1

part2Client: part2Client.c
	gcc part2Client.c -Wall -Wextra -lz -o part2Client

part2Server: part2Server.c
	gcc part2Server.c -Wall -Wextra -lz -o part2Server

dist:
	 tar -czvf telnet.tar.gz README part2Client.c part2Server.c part1.c Makefile 

clean: 
	ls | egrep -v 'part1.c$$|^part2Server.c$$|^part2Client.c$$|^Makefile$$|^README$$' | xargs rm -r
