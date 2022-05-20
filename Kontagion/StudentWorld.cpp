#include "StudentWorld.h"
#include "GameConstants.h"
#include "Actor.h"
#include <algorithm>
#include <string>
#include <cmath>
#include <iostream>
#include <vector>
using namespace std;

GameWorld* createStudentWorld(string assetPath)
{
	return new StudentWorld(assetPath);
}

StudentWorld::StudentWorld(string assetPath)
: GameWorld(assetPath)
{}

StudentWorld::~StudentWorld()
{
    cleanUp();
}

double StudentWorld::euclideanDist(double x1, double y1,  const double x2, const double y2) // ROUNDS DOWN
{
    return round ( sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) ) );
}

bool StudentWorld::checkOverlap(int i, int x, int y)
{
    int k;
    for (k=1; k<i;k++) // k=1 since socrates overlap doesn't matter
    {
        if (euclideanDist(x, y, actors[k]->getX(),  actors[k]->getY()) < 2*SPRITE_RADIUS)
            break;
    }
    if (k==i)
        return false;
    return true;
}

void StudentWorld::removeDeadGameObjects()
{
    for ( vector<Actor*>::iterator p = actors.begin(); p != actors.end() ; p++ )
    {
        if ( ! ((*p)->isAlive()) )
        {
            delete (*p);
            actors.erase(p);
        }
    }
}

/*void StudentWorld::addNewActors()
{
    int chanceFungus = max(510-getLevel()*10,200);
    if(randInt(0,chanceFungus-1)==0)
    {
        fungus* f = new fungus(VIEW_RADIUS+VIEW_WIDTH/2,VIEW_HEIGHT/2, getLevel(), this);
        actors.push_back(f);
    }
    
    int chanceGoodie = max(510-getLevel()*10,250);
    if(randInt(0, chanceGoodie-1))
    {
        int chance = randInt(0, 99);
        if (chance>=0&&chance<=59)
        {
            healthGoodie* hg = new healthGoodie(VIEW_WIDTH/2,VIEW_HEIGHT/2+VIEW_RADIUS, getLevel(), this);
            actors.push_back(hg);
        }
        if (chance>59&&chance<=89)
        {
            flameGoodie* fg = new flameGoodie(VIEW_RADIUS+VIEW_WIDTH/2,VIEW_HEIGHT/2, getLevel(), this);
            actors.push_back(fg);
        }
        if (chance>89)
        {
            extraLifeGoodie* eg = new extraLifeGoodie(VIEW_WIDTH/2,VIEW_HEIGHT/2+VIEW_RADIUS, getLevel(), this);
            actors.push_back(eg);
        }
    }
}

void StudentWorld::updateDisplayText()
{
    string x="HELLO";
    setGameStatText(x);
}*/


int StudentWorld::init()
{
    // add Socrates
    Socrates* hero = new Socrates(this); // Socrates always created at (0, 128) by default.
    actors.push_back(hero);
    
    /*int i;
    for (i=0; i<getLevel(); i++) // i, j, k
    {
        int x = randInt(VIEW_WIDTH/2-120, VIEW_WIDTH/2+120);
        int y = randInt(VIEW_HEIGHT/2-120, VIEW_HEIGHT/2+120);
        if ( euclideanDist(x, y, VIEW_WIDTH/2, VIEW_HEIGHT/2) <= 120 && !checkOverlap(i,x,y) )
        {
            pit* p = new pit(x,y, this);
            actors.push_back(p);
        }

        else
            i--;
    }
    
    // add all Food
    int j;
    for (j=i; j<i+min(5*getLevel(),25); j++)
    {
        int x = randInt(VIEW_WIDTH/2-120, VIEW_WIDTH/2+120);
        int y = randInt(VIEW_HEIGHT/2-120, VIEW_HEIGHT/2+120);
        if ( euclideanDist(x, y, VIEW_WIDTH/2, VIEW_HEIGHT/2) <= 120 && !checkOverlap(j,x,y) )
        {
            food* f = new food(x,y, this);
            actors.push_back(f);
        }
        else
            j--;
    }
    */
    
    // add all the Dirt
    
    for (int k=0; k<max(180-20*getLevel(),20); k++)
    {
        int x = randInt(VIEW_WIDTH/2-120, VIEW_WIDTH/2+120);
        int y = randInt(VIEW_HEIGHT/2-120, VIEW_HEIGHT/2+120);
        if ( euclideanDist(x, y, VIEW_WIDTH/2, VIEW_HEIGHT/2) <= 120 ) 
        {
            dirt* d = new dirt(x,y, this);
            actors.push_back(d);
        }
        else
            k--;
    }
    // try and write a template function for this.
    return GWSTATUS_CONTINUE_GAME;
}



int StudentWorld::move()
{
    // The term "actors" refers to all bacteria, Socrates, goodies,
    // pits, flames, spray, foods, etc.
    // Give each actor a chance to do something, incl. Socrates
    for (int i=0; i<actors.size(); i++)
    {
        if (actors[i]->isAlive())
        {
            actors[i]->doSomething();
            if (!(actors[0]->isAlive()))
                return GWSTATUS_PLAYER_DIED;
            if (actors.size()==1)
                return GWSTATUS_FINISHED_LEVEL;
        }
    }
    // Remove newly-dead actors after each tick
    removeDeadGameObjects(); // delete dead game objects
    
    // Potentially add new actors to the game (e.g., goodies or fungi)
    //addNewActors();
    
    // Update the Game Status Line
    //updateDisplayText(); // update the score/lives/level text at screen top
    // the player hasn’t completed the current level and hasn’t died, so
    // continue playing the current level
    return GWSTATUS_CONTINUE_GAME;
}

void StudentWorld::cleanUp()
{
    for ( vector<Actor*>::iterator p = actors.begin(); p != actors.end() ; p++ )
    {
        delete *p;
    }
    actors.clear();
}
