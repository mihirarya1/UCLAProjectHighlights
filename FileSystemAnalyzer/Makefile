default: lab3a.c 
	gcc -Wall -Wextra -lm lab3a.c -o lab3a

dist: default
	tar -czvf lab3a-705126618.tar.gz lab3a.c Makefile README ext2_fs.h

clean:
	ls | egrep -v '^lab3a.c$$|^Makefile$$|^README$$|^ext2_fs.h$$' | xargs rm
