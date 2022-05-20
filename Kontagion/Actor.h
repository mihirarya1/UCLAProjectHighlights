#ifndef ACTOR_H_
#define ACTOR_H_

#include "GraphObject.h"
#include "StudentWorld.h"
class StudentWorld;

#include <algorithm> // for max function
using namespace std;

// Students:  Add code to this file, Actor.cpp, StudentWorld.h, and StudentWorld.cpp
class Actor : public GraphObject
{
public:
    Actor(int imageID, int startX, int startY, Direction startDirection, int depth, StudentWorld* world) : GraphObject(imageID, startX, startY, startDirection, depth)
    {
        m_world = world;
        this->depth = depth;
        this->alive = true; // all actors start out alive by default
    }
    
    virtual bool isAlive() {return alive;}
    virtual void setAlive() {alive=!alive;}
    
    virtual void doSomething() = 0; //  not pure virtual for now!
    
    virtual StudentWorld* getWorld() {return m_world;}
    
private:
    // all actors have the following attributes:
    // remember that we are not allowed to store imageID, or startX, or startY!
    Direction startDirection;
    int depth;
    bool alive;
    StudentWorld* m_world; // needs to be initialized to the student world we in.
    
};

class Socrates : public Actor
{
public:
    Socrates(StudentWorld* world) : Actor (IID_PLAYER,0,128,0,0, world)
    {
        m_sprayCharges = 20;
        m_flameCharges = 5;
        m_hp = 100;
        posAngle=180;
    }
    
    void modPosAngle (int n) {posAngle+=n;}
    int getPosAngle() {return posAngle;}
    
    int getHP() {return m_hp;}
    void addHP(int add) { m_hp += add;}

    void doSomething();
    void myMoveAngle(int angle);
    void takeDamage(int damageAmt);

private:
    int m_sprayCharges;
    int m_flameCharges;
    int m_hp;
    int posAngle;
};


class dirt : public Actor
{
public:
    dirt(int x, int y, StudentWorld* world) : Actor (IID_DIRT, x , y , 0, 1, world)
    {}
    void doSomething();
    void takeDamage();
};

/*class food : public Actor
{
public:
    food (int x, int y, StudentWorld* world) : Actor (IID_FOOD, x , y , 90, 1, world)
    {}
    void doSomething();
};

class flameOrSpray : public Actor // should be abstract
{

public:
    flameOrSpray (int x, int y, Direction direction, const int itemID, StudentWorld* world) : Actor (itemID, x, y, direction, 1, world)
    {
        m_maxTravelDist=0;
    }
    
    void addMaxTravelDist(int mod) { m_maxTravelDist += mod; } // can lower as well if negative passed in
    int getMaxTravelDist() const { return m_maxTravelDist; }
    virtual void doSomething();
private:
    int m_maxTravelDist;

};

class flame : public flameOrSpray
{
public:
    flame (int x, int y, Direction direction, StudentWorld* world) : flameOrSpray ( x, y, direction, IID_FLAME, world)
    {
        addMaxTravelDist(32); // 32 pixels
    }
};


class spray : public flameOrSpray
{
public:
    spray (int x, int y, Direction direction, StudentWorld* world) : flameOrSpray ( x, y, direction, IID_SPRAY, world )
    {
        addMaxTravelDist(112); // 112 pixels
    }
};


class goodieOrFungus : public Actor // shld be abstract data type
{
public:
    goodieOrFungus(int x, int y, const int itemID, int L, StudentWorld* world) : Actor(itemID, x, y, 0, 1, world)
    {
        m_maxLife = max ( rand() % (300 - 10 * L ), 50 ); // L is passed in to be the level number.
    }
    virtual void doSomething();

private:
    int m_maxLife;
};

class healthGoodie : public goodieOrFungus
{
public:
    healthGoodie (int x, int y, int L, StudentWorld* world) : goodieOrFungus(x,y,IID_RESTORE_HEALTH_GOODIE,L, world)
    {}
};

class flameGoodie : public goodieOrFungus
{
public:
    flameGoodie (int x, int y, int L, StudentWorld* world) : goodieOrFungus(x,y,IID_FLAME_THROWER_GOODIE, L, world)
    {}
};

class extraLifeGoodie : public goodieOrFungus
{
public:
    extraLifeGoodie (int x, int y, int L, StudentWorld* world) : goodieOrFungus(x,y,IID_EXTRA_LIFE_GOODIE, L, world)
    {}
};

class fungus : public goodieOrFungus
{
public:
    fungus (int x, int y, int L, StudentWorld* world) : goodieOrFungus(x,y,IID_FUNGUS, L, world)
    {}
};

class bacteria : public Actor
{
public:
    bacteria (int x, int y, const int bacteriaID, StudentWorld* world) : Actor(bacteriaID, x, y, 90, 0, world)
    {
        m_movePlanDist = 0;
        m_HP=0;
    }
    
    virtual void doSomething();
    
    virtual void addHP(int modHP) { m_HP += modHP; } // if modHP negative then can lower HP too
    virtual int getHP() const { return m_HP; }
    
    virtual void addMovePlanDist(int modMovePlanDist) { m_movePlanDist += modMovePlanDist; }
    virtual int getMovePlanDist() const { return m_movePlanDist; }
    
private:
    int m_HP;
    int m_movePlanDist;
};

class regSalm : public bacteria
{
public:
    regSalm (int x, int y, StudentWorld* world) : bacteria(x,y,IID_SALMONELLA, world)
    {
        addHP(4);
    }
};

class aggSalm : public bacteria
{
public:
    aggSalm (int x, int y, StudentWorld* world) : bacteria(x,y,IID_SALMONELLA, world)
    {
        addHP(10);
    }
};

class ecoli : public bacteria
{
public:
    ecoli (int x, int y, StudentWorld* world) : bacteria(x,y,IID_ECOLI, world)
    {
        addHP(5);
    }
    
};


class pit : public Actor
{

public:
    pit (int x, int y, StudentWorld* world) : Actor(IID_PIT, x , y , 0, 1, world)
    {
        for (int i=0; i<5; i++)
        {
            pitRegSalm[i] = new regSalm(x,y, world);
            if (i<3)
                pitAggSalm[i] = new aggSalm(x,y, world);
            if (i<2)
                pitEcoli[i] = new ecoli(x,y, world);
        }
    }
    void doSomething();
    
private:
    regSalm* pitRegSalm[5];
    aggSalm* pitAggSalm[3];
    ecoli* pitEcoli[2];
    
};*/

#endif // ACTOR_H_

