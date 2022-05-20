default: fileSystemInterpretation.c fileSystemConsistencyAnalyzer.py   
	gcc -Wall -Wextra -lm fileSystemInterpretation.c -o fileSystemInterpretation
	ln -s fileSystemConsistencyAnalyzer.py fileSystemConsistencyAnalyzer

fileSystemInterpretation: fileSystemInterpretation.c
	gcc -Wall -Wextra -lm fileSystemInterpretation.c -o fileSystemInterpretation

fileSystemConsistencyAnalyzer: fileSystemConsistencyAnalyzer.py
	ln -s fileSystemConsistencyAnalyzer.py fileSystemConsistencyAnalyzer

dist: default
	tar -czvf fileSystemProject.tar.gz fileSystemInterpretation.c fileSystemConsistencyAnalyzer.py Makefile README ext2_fs.h

clean:
	ls | egrep -v '^fileSystemConsistencyAnalyzer.py$$|^fileSystemInterpretation.c$$|^Makefile$$|^README$$|^ext2_fs.h$$' | xargs rm

