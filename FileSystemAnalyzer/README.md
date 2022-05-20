### Overview:

	This project prints out a file system summary of a provided ext2 file system image
	and then audits this metadata for any inconsistencies (which would insinuate the
	file system is corrupted). fileSystemConsistencyAnalyzer.py analyzes for corruption,
	the file system summary produced by fileSystemInterpretation.c. ext2_fs.h houses 
	structs/classes of data which are present in the ext2 file system, and is used by 
	fileSystemInterpretation.c. trivial.img is a sample image to be tested. 
	
	The Makefile builds both source files needed, where the default case is to build all 
	simultaneously. It also has a clean command which removes all files from the current 
	working directory except source code, and a dist command which produces a tar file.
	
### File System Interpretation
	
	The C code for this takes in the location of an ext2 file system image to be analyzed
	and produces summary information pertaining to the following parameters to stdout:
	super blocks, groups, free-lists, inodes, indirect blocks, and directories.
	
Output for each of the parameters will be in the format stipulated on the following page:
[http://web.cs.ucla.edu/~harryxu/courses/111/winter21/ProjectGuide/P3A.html](http://web.cs.ucla.edu/~harryxu/courses/111/winter21/ProjectGuide/P3A.html)

### File System Consistency Analyzer

	fileSystemConsistencyAnalyzer.py, takes in one argument, for the output file to be 
	analyzed which was produced during the file system interpretation stage. Errors to be 
	caught include block consistency audits, inode allocation audits (ex. checking that an
	inode which shows up in the list of inodes doesn't appear in the bitmap of free inodes),
	directory consistency audits, etc. 
	
	More information on the types of auditing performed can be found at:
[http://web.cs.ucla.edu/~harryxu/courses/111/winter21/ProjectGuide/P3B.html](http://web.cs.ucla.edu/~harryxu/courses/111/winter21/ProjectGuide/P3B.html)


	
### References:

[http://www.nongnu.org/ext2-doc/ext2.html](http://www.nongnu.org/ext2-doc/ext2.html)<br/>
(guide to ext2 file system structuring)

[https://www.geeksforgeeks.org/working-csv-files-python/](https://www.geeksforgeeks.org/working-csv-files-python/)<br/>
(guide to csv.reader function)

[https://www.geeksforgeeks.org/python-dictionary/](https://www.geeksforgeeks.org/python-dictionary/)<br/>
(guide to dict. dtype)

[https://www.w3schools.com/python/gloss_python_global_variables.asp](https://www.w3schools.com/python/gloss_python_global_variables.asp)<br/>
(guide to globals)

[https://www.geeksforgeeks.org/defaultdict-in-python/](https://www.geeksforgeeks.org/defaultdict-in-python/)<br/>
(defaultdict approach info)
