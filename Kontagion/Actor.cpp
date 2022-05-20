#include "Actor.h"
#include "StudentWorld.h"
#include <math.h>
#include <iostream>

// Students:  Add code to this file, Actor.h, StudentWorld.h, and StudentWorld.cpp

void Socrates::myMoveAngle(int angle)
{
    const int r = 128;
    double angleRad = angle*(atan(1)/45);
    moveTo(r*cos(angleRad)+128, r*sin(angleRad)+128);
}

void Socrates::doSomething()
{
    //if (this->isAlive()==0)
     //   return;
    
    int value=0;
    if( getWorld()->getKey(value) )
    {
        /*if (value==KEY_PRESS_SPACE)
        {
            double x = this->getX();
            double y = this->getY();
            getPositionInThisDirection(this->getDirection(), 2*SPRITE_RADIUS, x, y);
            new spray (x,y, this->getDirection(), getWorld());
            m_sprayCharges--;
            getWorld()->playSound(SOUND_PLAYER_SPRAY);
        }
        
        if (value==KEY_PRESS_ENTER&&m_flameCharges>0)
        {
            for (int i=0; i<16; i++)
            {
                double x = this->getX();
                double y = this->getY();
                Direction dir = this->getDirection()+22*i;
                if (dir>359)
                    dir-=dir;
                getPositionInThisDirection(dir, 2*SPRITE_RADIUS, x, y);
                moveTo(x, y);
                new flame (x,y,dir,getWorld());
            }
           
            m_flameCharges--;
            getWorld()->playSound(SOUND_PLAYER_FIRE);
        }*/
        if (value==KEY_PRESS_RIGHT||value==KEY_PRESS_LEFT)
        {
            if (value==KEY_PRESS_LEFT) // clockwise
                 modPosAngle(-5);
            else
                 modPosAngle(5);
                //
            myMoveAngle(getPosAngle());
            setDirection((getPosAngle()+180)%360);
        }
        
    }
    /* else
    {
        if (m_sprayCharges<20)
            m_sprayCharges++;
    }
    */
}

/*void Socrates::takeDamage(int damageAmt)
{
    addHP(damageAmt);
    if(getHP()>0)
        getWorld()->playSound(SOUND_PLAYER_HURT);
    else
    {
        setAlive();
        getWorld()->playSound(SOUND_PLAYER_DIE);
        // tell student world to detect his death...
    }
}*/

void dirt::doSomething()
{
    return; // actual implementation
}

void dirt::takeDamage()
{
    setAlive();
}

/*void flameOrSpray::doSomething()
{
    return;
}

void goodieOrFungus::doSomething()
{
    return;
}

void bacteria::doSomething()
{
    return;
}

void pit::doSomething()
{
    return;
}

void food::doSomething()
{
    return;
}*/




