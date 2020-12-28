#Makefile for project 1a
#NAME: Mihir Arya
#EMAIL: mihirarya@ucla.edu
#ID: 705126618

lab1a: lab1a.c
	gcc lab1a.c -Wall -Wextra -o lab1a

dist: README lab1a.c Makefile
	tar -czvf lab1a-705126618.tar.gz README lab1a.c Makefile

clean:
	ls | egrep -v '^lab1a.c$$|^Makefile$$|^README$$' | xargs rm -r
