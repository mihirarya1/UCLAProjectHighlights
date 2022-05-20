#ifndef STUDENTWORLD_H_
#define STUDENTWORLD_H_

#include "GameWorld.h"
#include <string>
#include "Actor.h"
class Actor;
using namespace std;

// Students:  Add code to this file, StudentWorld.cpp, Actor.h, and Actor.cpp

class StudentWorld : public GameWorld // StudentWorld is derived from GameWorld.
{
public:
    StudentWorld(std::string assetPath);
    
    StudentWorld* returnWorld ()
    {
        return m_world;
    }
    
    ~StudentWorld();
    
     virtual int init(); // constructs current level and populates with actors
    // called if game first starts, new level starts, player loses life but still has one left, causing restart at current level
    virtual int move(); // called 20 times per sec; meant for GUI. Moves each of the actors and performs their particular actions. Can also introduce brand new actors to game. Also, this deletes actors if they die during a tick.
    virtual void cleanUp(); // Removes all actors at end of a particular round, or when player loses a life.
    
    double euclideanDist(double x1, double y1, const double x2, const double y2);
    
    bool checkOverlap(int i, int x, int y);
    
    void removeDeadGameObjects();
    
    void addNewActors();
    
    void updateDisplayText();
private:
    vector <Actor*> actors;
    StudentWorld* m_world;
};

#endif // STUDENTWORLD_H_

