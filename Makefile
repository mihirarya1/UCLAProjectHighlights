#/*                                                                                                                                                                                                      
#NAME: Mihir Arya                                                                                                                                                                                        
#EMAIL: mihirarya@ucla.edu                                                                                                                                                                               
#ID: 705126618                                                                                                                                                                                           
#*/

#/*                                                                                                                                                                                                      
#File contains the project-1b Makefile                                                                                                                              
#*/



# Makefile

default: lab1b-client.c lab1b-server.c
	gcc lab1b-client.c -Wall -Wextra -lz -o lab1b-client
	gcc lab1b-server.c -Wall -Wextra -lz -o lab1b-server

lab1b-client: lab1b-client.c
	gcc lab1b-client.c -Wall -Wextra -lz -o lab1b-client

lab1b-server: lab1b-server.c
	gcc lab1b-server.c -Wall -Wextra -lz -o lab1b-server

dist:
	 tar -czvf lab1b-705126618.tar.gz README lab1b-client.c lab1b-server.c Makefile 

clean: 
	ls | egrep -v '^lab1b-server.c$$|^lab1b-client.c$$|^Makefile$$|^README$$' | xargs rm
