### Overview:
	This project prints out the file structure of a provided ext2 file system 
	image, and then audits this metadata for any inconsistencies (which would
	insinuate the file system is corrupted). 

This is the README file for project 3b, CS111, UCLA, Fall 2020! Also contained
in the tarball for this project (lab3b-705126618.tar.gz), is a Python script
file titled lab3b.py. lab3b.py is the implementation for decoding the file 
system descriptor CSV file, generated as mentioned in the earlier part of this
project's (3) spec, for anomalies and corruption. This project's tarball finally
contains a Makefile, with a default command of producing a link to lab3b.py, a 
dist command of building the project tarball with the files described here, in 
addition to a clean command to restore directory to an untarred project state.

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
