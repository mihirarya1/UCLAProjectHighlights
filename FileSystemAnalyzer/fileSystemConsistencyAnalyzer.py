#!/usr/local/cs/bin/python3                                                                                                         

import csv
import sys
from collections import defaultdict

exitCode=0
def setExit(exitVal):
    global exitCode
    exitCode=exitVal

def getInodeBlocks(inodeNum, indirectLines, inodeLines, blockSize): # return all (indlucding data, indirection) blocks referred by inodeNumber

    inodeNumBlocks = []
    offset=0
    for inodeLine in inodeLines:
        if inodeLine[1]==inodeNum and len(inodeLine)>12:
            for i in range(15): # 0-14
                if i>11 and inodeLine[i+12]!=0:
                    if i==13: offset = int((blockSize/4) - 1) #255
                    if i==14: offset = int(blockSize/4 - 2 + (blockSize*blockSize)/16) #254 + 256*256
                    inodeNumBlocks.append( [ inodeLine[i+12], i+offset , i-10 ] ) # format is blocknum, offset, indirectionLevel
                elif inodeLine[i+12]!=0:
                    inodeNumBlocks.append( [ inodeLine[i+12], i , 1 ] )

    for indirectLine in indirectLines:
        if indirectLine[1]==inodeNum and indirectLine[5]!=0:
            inodeNumBlocks.append( [ indirectLine[5], indirectLine[3], indirectLine[2] ] ) # format is blocknum, offset ,indirectionLevel
    return inodeNumBlocks    

def printBlockErrors(block, inodeNum, offset, indirection): # prints out if error with a block, called in multiple different places
    setExit(2)
    if indirection==1:
        print("BLOCK", block, "IN INODE", inodeNum, "AT OFFSET",offset)
    elif indirection==2:
         print("INDIRECT BLOCK",block, "IN INODE",inodeNum, "AT OFFSET",offset)
    elif indirection==3:
         print("DOUBLE INDIRECT BLOCK",block, "IN INODE",inodeNum, "AT OFFSET",offset)
    elif indirection==4:
         print("TRIPLE INDIRECT BLOCK",block, "IN INODE",inodeNum, "AT OFFSET",offset)

def getInodeErrors(inodeLines, freeInodeNumbers, totalInodeCount): # find errors related to inodes (2nd portion in spec)
    allocatedInodeNumbers = []
    for inode in inodeLines:
        if inode[2]!=0:
            allocatedInodeNumbers.append(inode[1])

    for i in range(totalInodeCount): 
        if ((i+1)>10) and (i+1 not in allocatedInodeNumbers) and (i+1 not in freeInodeNumbers):
            print("UNALLOCATED INODE", i+1, "NOT ON FREELIST"); setExit(2)
        if (i+1 in allocatedInodeNumbers) and (i+1 in freeInodeNumbers):
            print("ALLOCATED INODE", i+1, "ON FREELIST"); setExit(2)

def getBlockErrors(inodeLines, freeInodeNumbers, indirectLines, totalBlockCount, lowerBlockBound, freeBlockNumbers, blockSize): 
# find errors related to blocks (1st portion of spec)
        trackDuplicates = defaultdict(list) # initialize all lists to empty
        blocksInFile = []
        for inodeLine in inodeLines:
            inodeBlocks = getInodeBlocks(inodeLine[1], indirectLines, inodeLines, blockSize)
            for block in inodeBlocks:
                if ( block[0]<0 or block[0]>totalBlockCount ):
                    print("INVALID",end=" "); 
                    printBlockErrors(block[0], inodeLine[1], block[1], block[2]) 
                if ( block[0] < lowerBlockBound and block[0] >= 0 ):
                    print("RESERVED",end=" ")
                    printBlockErrors(block[0], inodeLine[1], block[1], block[2])
                if ( block[0] in freeBlockNumbers ):
                    print("ALLOCATED BLOCK", block[0], "ON FREELIST"); setExit(2)
                trackDuplicates[block[0]].append( [block[0], inodeLine[1], block[1], block[2]] ) # key is blockNum, val is inodeNum, offset, indirection

        for block in trackDuplicates:
            if len(trackDuplicates[block])>1:
                for i in range(len(trackDuplicates[block])):
                    print("DUPLICATE",end=" ")
                    printBlockErrors(trackDuplicates[block][i][0], trackDuplicates[block][i][1], trackDuplicates[block][i][2], trackDuplicates[block][i][3])
        
        for i in range(lowerBlockBound,totalBlockCount): # total block count is 
           if i not in trackDuplicates and i not in freeBlockNumbers: # by default, dict name is a list of keys
               print("UNREFERENCED BLOCK", i); setExit(2)

def parentInodeOf(child, directoryLines): # obtain directory entry whose child reference is 'child'
    for dirent in directoryLines:
        if (dirent[3]==child) and (dirent[6]!="'.'") and (dirent[6]!="'..'"):
            return dirent[1]
    return 2 # special case where at root whose parent is itself...

def getDirErrors(inodeLines, directoryLines, totalInodeCount, freeInodeNumbers): # find errors related to dirents, (3rd portion spec)
    allocatedInodeNumbers = []
    for inodeLine in inodeLines:
        if inodeLine[2]!=0:
            allocatedInodeNumbers.append(inodeLine[1])
    
    for dirent in directoryLines:
        if (dirent[3]<1) or (dirent[3]>totalInodeCount):
            print("DIRECTORY INODE", dirent[1], "NAME", dirent[6], "INVALID INODE", dirent[3]); setExit(2)
        elif (dirent[3] not in allocatedInodeNumbers):
            print("DIRECTORY INODE", dirent[1], "NAME", dirent[6], "UNALLOCATED INODE", dirent[3]); setExit(2)
  
    for inodeLine in inodeLines: # allocated list is inode lines which are allocated.                                                               
        if inodeLine[1] not in allocatedInodeNumbers:
            continue
        count=0
        for dirent in directoryLines:
            if dirent[3]==inodeLine[1]:
                count+=1
                if (dirent[6]=="'.'" and dirent[3]!=dirent[1]):
                    print("DIRECTORY INODE", dirent[1], "NAME '.' LINK TO INODE", dirent[3], "SHOULD BE", dirent[1]); setExit(2)
                if (dirent[6]=="'..'"):
                    x = parentInodeOf(dirent[1], directoryLines)
                    if x!=dirent[3]:                                                      
                        print("DIRECTORY INODE", dirent[1], "NAME '..' LINK TO INODE", dirent[3], "SHOULD BE", x); setExit(2)
        if count!=inodeLine[6]:
            print("INODE", inodeLine[1], "HAS", count, "LINKS BUT LINKCOUNT IS", inodeLine[6]); setExit(2)


if __name__ == '__main__':

    if len(sys.argv) != 2:
        print("Incorrect number of input args", file=sys.stderr)
        exit(1)
    try:
        inpt = open(sys.argv[1],'r')
    except:
        print("File error", file=sys.stderr)
        exit(1)
    fileText = csv.reader(inpt)
    
    freeInodeNumbers, freeBlockNumbers, inodeLines, indirectLines, directoryLines = ( [] for j in range(5) ) # parse in all the different line type
    totalBlockCount = lowerBlockBound  = blockSize = inodeSize = groupInodeCount = groupInodeTable = totalInodeCount = 0
    for row in fileText:
        if row[0] == "IFREE": 
            freeInodeNumbers.append(int(row[1]))
        if row[0] == "INODE":
            for i in range(len(row)):
                if i not in [0,2,7,8,9]: 
                    row[i]=int(row[i])
            inodeLines.append(row)
        if row[0] == "SUPERBLOCK":
            totalInodeCount = int(row[2])
            totalBlockCount = int(row[1])
            blockSize = int(row[3])
            inodeSize = int(row[4])
        if row[0] == "GROUP":
            groupInodeCount = int(row[3])
            groupInodeTable = int(row[8])
        if row[0] == "BFREE":
            freeBlockNumbers.append(int(row[1]))
        if row[0] == "INDIRECT":
            for i in range(1, len(row)):
                row[i]=int(row[i])
            indirectLines.append(row)
        if row[0] == "DIRENT":
            for i in range(1,len(row)-1):
                row[i]=int(row[i])
            directoryLines.append(row)

    lowerBlockBound = int(groupInodeTable + ( (groupInodeCount*inodeSize) / blockSize ) )

    getInodeErrors(inodeLines, freeInodeNumbers, totalInodeCount) # INODE ERRORS
    getBlockErrors(inodeLines, freeInodeNumbers, indirectLines, totalBlockCount, lowerBlockBound, freeBlockNumbers, blockSize) # BLOCK ERRORS
    getDirErrors(inodeLines, directoryLines, totalInodeCount, freeInodeNumbers) # directory 

    exit(exitCode)
