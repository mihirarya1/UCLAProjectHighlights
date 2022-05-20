//NAME: Mihir Arya


// Source file (lab3a.c) for project 3a, cs111!

#include <stdlib.h>
#include <stdio.h>
#include "ext2_fs.h"
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <time.h>
#include <math.h>
#define EXT2_SUPER_MAGIC 0xEF53

int fd, blockSize;
struct ext2_super_block sb;
struct ext2_group_desc groupInfoData;
struct ext2_inode* inodeSummaryData;
int groupBlockCount=0, groupInodeCount=0;

int computeOffset(int in)
{ // compute the byte offset from the start of the file image, of the inputted block number
  return 1024+blockSize*(in-1); // blockNumber of superblock is 1
}

void computeDirectory(int parentInode, int blockNum)
{
  struct ext2_dir_entry dEntry;
  int counter=0;

  do
    {
      if ( pread(fd, &dEntry, sizeof(dEntry), computeOffset(blockNum)+counter) == -1 )	// data on dir entry
	{ fprintf(stderr,"Error with pread in directory check\n"); exit(2); }
      if (dEntry.inode==0)
	break;
      printf("DIRENT,%d,%d,%d,%d,%d,'%s'\n", parentInode, counter, dEntry.inode, dEntry.rec_len, dEntry.name_len, dEntry.name);
      counter+=dEntry.rec_len;
    }
  while(counter<blockSize);

}

void computeIndirection(int parentInode, int blockNum,int indirectionLevel, int directoryCheck, int offset)
{
  //blocknum is the reference block number, parentInode is from original (non-recursive caller)...
  
  int arrlen = blockSize/4; // 4 is sizeof int 
  int readIn [arrlen]; // contains block numbers of children
  if ( pread(fd, &readIn, blockSize, computeOffset(blockNum)) == -1 )
    { fprintf(stderr,"Error in pread() while computing indirection!\n"); exit(2); }
    
  for (int i=0; i<arrlen; i++)
    {
      if (readIn[i]==0) continue;
      if (indirectionLevel>1) 
	{
	  printf("INDIRECT,%d,%d,%d,%d,%d\n",parentInode, indirectionLevel, offset + (int)(pow(256,indirectionLevel-1))*i, blockNum, readIn[i]); // look ahead based on lvl indirection
	  computeIndirection(parentInode, readIn[i], indirectionLevel-1, directoryCheck, offset + (int)(pow(256,indirectionLevel-1))*i ); // recurse
	}
      else if (indirectionLevel==1) // data block is child
	{
	  if (directoryCheck)
	      computeDirectory(parentInode,readIn[i]);
	  else
	      printf("INDIRECT,%d,%d,%d,%d,%d\n",parentInode, indirectionLevel, offset+i, blockNum, readIn[i]); 
	}
    }
}

void computeIndirectionWrapper(int parentInode, int blockNum, int indirectionLevel, int directoryCheck)
{
  int offset; // starting position of first data block for indirection type
  if (indirectionLevel==1)
    offset=12;
  else
    offset=12+256+(256*256*(indirectionLevel-2));
  computeIndirection(parentInode, blockNum, indirectionLevel, directoryCheck, offset);
}

char* convertTime(time_t inputTime, char returnTime [])
{
  // converts inputTime into (mm/dd/yy hh:mm:ss, GMT) time format
  struct tm result;
  gmtime_r(&inputTime, &result);
  sprintf(returnTime, "%02d/%02d/%02d %02d:%02d:%02d", result.tm_mon+1, result.tm_mday, (result.tm_year+1900)%100, result.tm_hour, result.tm_min, result.tm_sec);
  return returnTime;
}

void inodeSummary()
{
  inodeSummaryData = (struct ext2_inode*)malloc( sizeof(struct ext2_inode)*groupInodeCount );
  if (inodeSummaryData==NULL)
    { fprintf(stderr,"Memory allocation issue!\n"); exit(2); }
  int offset = computeOffset(groupInfoData.bg_inode_table);
  char ftype;
  int mask = 0xF000;
  
  for (int k=0; k<groupInodeCount; k++)
    {
      if ( pread(fd, &inodeSummaryData[k], sizeof(struct ext2_inode), offset+k*sb.s_inode_size) == -1 )
	{ fprintf(stderr,"Error reading inode from inode table!\n"); exit(2); }
      
      if ( inodeSummaryData[k].i_mode != 0 && inodeSummaryData[k].i_links_count != 0 )
	{
	  if ( (mask&inodeSummaryData[k].i_mode) == 0x8000 ) ftype = 'f';
	  else if ( (mask&inodeSummaryData[k].i_mode) == 0x4000 ) ftype = 'd';
	  else if ( (mask&inodeSummaryData[k].i_mode) == 0xA000 ) ftype = 's';
	  else ftype = '?';

	  char modTime [25]; char accessTime [25]; char creationTime [25];
	  convertTime(inodeSummaryData[k].i_mtime, modTime);
	  convertTime(inodeSummaryData[k].i_atime, accessTime);
	  convertTime(inodeSummaryData[k].i_ctime, creationTime);
	  
	  printf("INODE,%d,%c,%o,%d,%d,%d,%s,%s,%s,%d,%d", k+1, ftype, 0x0FFF&inodeSummaryData[k].i_mode, inodeSummaryData[k].i_uid, inodeSummaryData[k].i_gid, inodeSummaryData[k].i_links_count, creationTime, modTime, accessTime, inodeSummaryData[k].i_size, inodeSummaryData[k].i_blocks);
      
	  if ( (mask&inodeSummaryData[k].i_mode) != 0xA000 || inodeSummaryData[k].i_size > 60 )
	      for (int i=0; i<15; i++)
		printf(",%d",inodeSummaryData[k].i_block[i]);
	  printf("\n");

	  if (ftype=='d') // directory check sequence
	    {
	      for (int p=0; p<12; p++)
		computeDirectory(k+1, inodeSummaryData[k].i_block[p]);
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[12], 1, 1 );
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[13], 2, 1 );
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[14], 3, 1 );
	    }
	  if ( ftype=='f' || ftype=='d' )
	    {
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[12], 1, 0 );
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[13] , 2, 0 );
	      computeIndirectionWrapper( k+1, inodeSummaryData[k].i_block[14] , 3, 0 );
	    }
	}
    }
}

void freeEntries(int groupCount, unsigned int bitmap)
{
  // scans bitmap at hand and checks for all the free blocks 
	
  int numBytes = (groupCount/8) + !!(groupCount%8); // size of the bitmap is given by this formula
  char buf [numBytes];
  if ( pread(fd, &buf, numBytes, computeOffset(bitmap)) == -1 ) // read bitmap from file system image into buffer
    { fprintf(stderr,"Error in reading bitmap!\n"); exit(2); }

  for (int l=0; l<numBytes; l++) // go byte by byte for bitmap
    for (int m=0; m<8; m++) // and go bit by bit for each byte
	if ( (buf[l]&(1<<m))==0 && (l*8+m+1)<=groupBlockCount ) // if m'th bit in l'th byte is not set, and this bit is within the block at hand (groupBlockCount) 
	  {   							// then it must be free
	    if ( bitmap==groupInfoData.bg_block_bitmap ) // if we are referring to free block bitmap
	      printf("BFREE,%d\n", l*8+m+1);
	    else // otherwise we are referring to the inode block bitmap
	      printf("IFREE,%d\n", l*8+m+1);
	  }
}

void groupInfo()
{
  // function to obtain various group metadata for given group in the filesystem
  if ( pread(fd, &groupInfoData, sizeof(groupInfoData), computeOffset(2)) == -1 ) // read group info into groupInfoData struct
    { fprintf(stderr,"Error reading group summary!\n"); exit(2); }

  groupBlockCount= sb.s_blocks_count; // number of blocks in group
  groupInodeCount= sb.s_inodes_count; // number of inodes in group
  
  printf("GROUP,%d,%d,%d,%d,%d,%d,%d,%d\n", 0, groupBlockCount, groupInodeCount, groupInfoData.bg_free_blocks_count, groupInfoData.bg_free_inodes_count, groupInfoData.bg_block_bitmap, groupInfoData.bg_inode_bitmap, groupInfoData.bg_inode_table );
						// print all group metadata desired
}

void superblockInfo()
{ 
  // function to obtain superblock information from the file system image
  if ( pread(fd, &sb, sizeof(sb), computeOffset(1)) == -1 )
    { fprintf(stderr,"Error reading superblock!\n"); exit(2); }
  if ( sb.s_magic != EXT2_SUPER_MAGIC ) // expected value to be stored in suberblock.s_magic is EXT2_SUPER_MAGIC, else didn't read superblock correctly
    { fprintf(stderr,"Did not correctly read superblock!\n"); exit(2); }

  blockSize = EXT2_MIN_BLOCK_SIZE << sb.s_log_block_size;
  printf( "SUPERBLOCK,%d,%d,%d,%d,%d,%d,%d\n", sb.s_blocks_count, sb.s_inodes_count, blockSize, sb.s_inode_size, sb.s_blocks_per_group, sb.s_inodes_per_group, sb.s_first_ino  );
	                                      // above print statement contains all the superblock metadata desired
}

int main(int argc,  char *argv[] )
{
  if ( argc!=2 || argv[1]==NULL ) // we want exactly one input argument, and that should be the name of the file containing the file system image
    { fprintf(stderr,"Invalid input arguments!\n"); exit(1); }
  fd = open(argv[1], O_RDONLY); // open file descriptor for file system image
  if ( fd == -1 )
    { fprintf(stderr,"Unable to open specified file\n"); exit(1); }
  
  superblockInfo();
  groupInfo(); // call for each group
  freeEntries(groupBlockCount, groupInfoData.bg_block_bitmap); // scan free block bitmap for group at hand
  freeEntries(groupInodeCount, groupInfoData.bg_inode_bitmap); // scan free inode bitmap for group at hand
  inodeSummary();
  
  free(inodeSummaryData);
  exit(0); 
}
