import {defs, tiny} from './common.js';
import {Coin_Spawner} from "./coin-spawner.js";
import {Fish_Obj} from "./fish.js";


// Pull these names into this module's scope for convenience:
const {vec3, hex_color, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}



export class Submarine_Demo extends Scene {                       

    constructor() {
        super();
        // Load the model file:
        this.rAccerleration = this.lAccerleration = 0;
        this.uAccerleration = this.dAccerleration = 0;

        this.launchLMissile = this.launchRMissile = 0;
        this.missileAcceleration = [vec3(1.5,0,0),vec3(1.5,0,0)];
        this.missileVelocity = [vec3(0,0,0),vec3(0,0,0)];
        this.missileMatrix = [Mat4.identity(),Mat4.identity()];
        this.timeSinceLastMissile=-1;
        //this.missileAngle = [0,0];
        //this.missilePosition = [[-0.95,-3.43],[0.95,-3.43]]

        //this.enterTurnPhase = [false,false];

        //this.targetPosition = vec3(-20,13,0);

        this.model_transform = Mat4.identity();

        this.acceleration = vec3(0,0,0);
        this.velocity = vec3(0,0,0);
        this.propSpeed = 0.5;

        this.fast = this.slow = false;

        this.shapes = {
                        "submarine": new Shape_From_File("assets/submarine.obj"),
                        "propeller": new Shape_From_File("assets/propeller.obj"),
                        "sphere": new defs.Subdivision_Sphere(4),
                        "torpedoBarrel": new defs.Cylindrical_Tube(12, 24, [[0, 1], [0, 1]]),
                        "torpedoMount": new defs.Cube(),
                        "torpedo" : new Shape_From_File("assets/rgm-84-harpoon-missile.obj")
        };

        this.army = new Material(new defs.Textured_Phong(1), {
            color: color(.5, .5, .5, 1),
            ambient: .3, diffusivity: .5, specularity: .5, texture: new Texture("assets/armySkin.png")
        });

        this.materials = {
            bubble: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#e7feff")})
        };

        this.coin_spawner = new Coin_Spawner();
        this.fish_spawner = new Fish_Obj();
    }


    make_control_panel() {

        this.key_triggered_button("Increase CW propeller speed", ["o"], () => {
            this.propSpeed = this.propSpeed*0.99;
        });
        
        this.key_triggered_button("Increase CCW propeller speed", ["p"], () => {
            this.propSpeed = this.propSpeed*1.01;
        });

        this.key_triggered_button("Move right", ["l"], () => this.rAccerleration = 1, '#6E6460', () => this.rAccerleration = 0);

        this.key_triggered_button("Move left", ["j"], () => this.lAccerleration = 1, '#6E6460', () => this.lAccerleration = 0);

        this.key_triggered_button("Move up", ["i"], () => this.uAccerleration = 1, '#6E6460', () => this.uAccerleration = 0);

        this.key_triggered_button("Move down", ["k"], () => this.dAccerleration = 1, '#6E6460', () => this.dAccerleration = 0);

        this.key_triggered_button("Launch left missile", ["n"], () => this.launchLMissile = 1);

        this.key_triggered_button("Launch right missile", ["m"], () => this.launchRMissile = 1);


        // Up/Down and left/right
    }

    getDistance(x1,y1,x2,y2) {
        return Math.sqrt( (x2-x1)**2 + (y2-y1)**2 );
    }

    getAngle(x1,y1,x2,y2) { // in degrees
            let a = y2-y1;
            let b = x2-x1;
            return Math.atan2(a, b) * 180 / Math.PI;
    }

    launchMissile(isRightMissile, dt, context, program_state,t) { // submarine is effectively our origin at any time

        this.missileAcceleration[isRightMissile][0] *= 1.03;
        this.missileVelocity[isRightMissile] = this.missileVelocity[isRightMissile].plus(this.missileAcceleration[isRightMissile].times(dt)); // slight constant accleration
        let addPosition = this.missileVelocity[isRightMissile].times(0.00001*dt); 
        

        let col = this.model_transform.times(vec4(0,0,0,1));
        let submarinePosition = vec3(col[0],col[1],col[2]);


        let angleToMove=0;


        /*if (this.enterTurnPhase[isRightMissile]==false && Math.abs(this.missilePosition[isRightMissile][0]-submarinePosition[0])>5)
            this.enterTurnPhase[isRightMissile]=true; 
        if (this.enterTurnPhase[isRightMissile]==true) {

            this.missileAcceleration[isRightMissile][0] /= 1.02;
                      
            let neededAngleRelativeToNormal = this.getAngle( this.missilePosition[isRightMissile][0], this.missilePosition[isRightMissile][1], this.targetPosition[0],this.targetPosition[1]);  
            angleToMove = (neededAngleRelativeToNormal)*(Math.PI/180)*(1/1); // now angle in rads
            this.missileMatrix[isRightMissile] = this.missileMatrix[isRightMissile].times(Mat4.rotation(angleToMove,0,0,1));
            this.missileAngle[isRightMissile]+=angleToMove;
        }*/


        //this.missilePosition[isRightMissile][0] += (Math.cos(angleToMove)*addPosition[0]);
        //this.missilePosition[isRightMissile][1] += Math.sin(angleToMove)*addPosition[0];


        //this.missileMatrix[isRightMissile] = this.missileMatrix[isRightMissile].times(Mat4.rotation(0.2,0,0,1));
        let currMissileMatrix = this.missileMatrix[isRightMissile].times(Mat4.translation(addPosition[0],0,0)).times(Mat4.rotation(this.missileVelocity[isRightMissile][0]/10000,1,0,0));
        
        this.fish_spawner.display(context, program_state, currMissileMatrix, this.model_transform);

        this.shapes.torpedo.draw(context, program_state, currMissileMatrix, this.army);

   }


    display(context, program_state) {

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // Define the global camera and projection matrices, which are stored in program_state.  The camera
            // matrix follows the usual format for transforms, but with opposite values (cameras exist as
            // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
            // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() and
            // orthographic() automatically generate valid matrices for one.  The input arguments of
            // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.
            program_state.set_camera(Mat4.translation(0, 0, -10));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);


        const t = program_state.animation_time;
        const dt = program_state.animation_delta_time; // elapsed time since last frame, not always the same necessarily

        let waterForce = 13;
        let gravityForce = 2;

        let xAccerleration = this.rAccerleration - this.lAccerleration;
        let yAccerleration = this.uAccerleration - this.dAccerleration;

        this.acceleration = vec3(xAccerleration, yAccerleration, 0);

        this.velocity = this.velocity.plus(this.acceleration.times(dt)); // water resistance pulls velocity towards zero
        if (this.velocity[0]>0)
            this.velocity[0] = Math.max(0,this.velocity[0]-waterForce);
        else 
            this.velocity[0] = Math.min(0, this.velocity[0]+waterForce);
        if (this.velocity[1]>0)
            this.velocity[1] = Math.max(0, this.velocity[1]-waterForce-gravityForce);
        else
            this.velocity[1] = Math.min(0, this.velocity[1]+waterForce-gravityForce);


        let nextMove = this.velocity.times(0.0001*dt);

        this.model_transform = this.model_transform.times(Mat4.translation(nextMove[0], nextMove[1], 0)); // translate current position by nextMove   
        this.model_transform[0][3] = Math.max(-16, Math.min(27, this.model_transform[0][3]));          
        this.model_transform[1][3] = Math.max(-7, Math.min(11, this.model_transform[1][3]));          


        this.shapes.submarine.draw(context, program_state, this.model_transform.times(Mat4.rotation(.75*Math.PI,0,1,0)), this.army);
      
        program_state.lights = [new Light(vec4(3, 2, 10, 1),color(1, .7, .7, 1), 100000)];

        let bodyAlignedAxis = this.model_transform.times(Mat4.rotation(-1.5*Math.PI, 0, 1, 0 ));

        let propellerTransform = bodyAlignedAxis
                            .times(Mat4.scale(.5,.5,.5))
                            .times(Mat4.translation(.75,-1.85,-9.1))
                            .times(Mat4.rotation(Math.PI, 0, 1, 0))
                            .times(Mat4.rotation(t*this.propSpeed,0,0,1));
        this.shapes.propeller.draw(context, program_state, propellerTransform, this.army);

        let torpedoMountTransform = bodyAlignedAxis.times(Mat4.translation(0,-1.4,0)).times(Mat4.scale(.3,.25,1));
        this.shapes.torpedoMount.draw(context, program_state, torpedoMountTransform, this.army);

        let torpedoBarrelTransform = torpedoMountTransform.times(Mat4.scale(.6,.6,2)).times(Mat4.translation(-2.6,-2.03,0));
        this.shapes.torpedoBarrel.draw(context, program_state, torpedoBarrelTransform, this.army);
        torpedoBarrelTransform = torpedoBarrelTransform.times(Mat4.translation(5.22,0,0));
        this.shapes.torpedoBarrel.draw(context, program_state, torpedoBarrelTransform, this.army);
        
        this.missileMatrix[0] = bodyAlignedAxis.times(Mat4.scale(0.5,0.5,0.5)).times(Mat4.translation(-0.95,-3.43,1)).times(Mat4.rotation(-Math.PI/2, 0, 1, 0 ));
        this.missileMatrix[1] = bodyAlignedAxis.times(Mat4.scale(0.5,0.5,0.5)).times(Mat4.translation(0.95,-3.43,1)).times(Mat4.rotation(-Math.PI/2, 0, 1, 0 ));

        if (this.launchLMissile && this.launchRMissile && this.timeSinceLastMissile==-1)
            this.timeSinceLastMissile=t;
        else if (this.launchLMissile && this.launchRMissile && t-this.timeSinceLastMissile>5000) {
            this.launchLMissile = this.launchRMissile = 0;
            this.missileAcceleration = [vec3(1.5,0,0),vec3(1.5,0,0)];
            this.missileVelocity = [vec3(0,0,0),vec3(0,0,0)];
            //this.missileMatrix = [Mat4.identity(),Mat4.identity()];
            this.timeSinceLastMissile=-1; 
        }
        

        if (this.launchLMissile)               
            this.launchMissile(0, dt, context, program_state, t);
        else 
            this.shapes.torpedo.draw(context, program_state, this.missileMatrix[0], this.army);
        if (this.launchRMissile)
            this.launchMissile(1, dt, context, program_state, t);
        else
            this.shapes.torpedo.draw(context, program_state, this.missileMatrix[1], this.army);

        
        if (this.missileVelocity[0].equals(vec3(0,0,0)) && this.missileVelocity[1].equals(vec3(0,0,0)))
             this.fish_spawner.display(context, program_state, this.model_transform, this.model_transform);
        this.coin_spawner.display(context, program_state, this.model_transform);

    }
}








export class Bubbles extends Scene {
    constructor() {
        super();

        this.shapes = {
            "bubble": new defs.Subdivision_Sphere(5),
        };

        this.bubbleCenters = [];

        this.prevTime = 0;

        this.materials = {
            bubble: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#e7feff")})
        };
    }

    getDistance(x1,y1,x2,y2) {
        return Math.sqrt( (x2-x1)**2 + (y2-y1)**2 );
    }

    checkBubbleCollision(bubbleDiam, elemIndex, h, v) {
        for (let i=0; i<this.bubbleCenters.length; i++) {
            if ( elemIndex!=i && this.distance(this.bubbleCenters[elemIndex][0]+h,this.bubbleCenters[elemIndex][1]+v,this.bubbleCenters[i][0],this.bubbleCenters[i][1])<bubbleDiam ) {
                return true;    
             }
        }
        this.bubbleCenters[elemIndex][0]+=h;
        this.bubbleCenters[elemIndex][1]+=v;
        return false;
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(Mat4.translation(0, 0, -30));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        const t = program_state.animation_time; // IN MILLISECONDS
        const dt = program_state.animation_delta_time

        program_state.lights = [new Light(vec4(3, 2, 10, 1),color(1, .7, .7, 1), 100000)];

        // release 4-6 number of bubbles every 3-5 seconds. They must fall within a horizontal band and go vertically from bottom of screen to top

        let numBubbles = 1;//Math.floor(Math.random() * 3)+4;
        let bubbleDiam = 1;
        let model_transform = Mat4.identity().times(Mat4.scale(bubbleDiam/2, bubbleDiam/2, bubbleDiam/2));

        this.bubbleCenters.push([0*bubbleDiam,0.0]);

        let h = Math.random()*0.2;
        if (Math.random()>0.5)
            h=-h;
        let v = Math.random()*0.2;

        this.bubbleCenters[0][0]+=h;
        this.bubbleCenters[0][1]+=v;

        let tmp_model = model_transform.times(Mat4.translation(this.bubbleCenters[0][0], this.bubbleCenters[0][1],0));

        this.shapes.bubble.draw(context,program_state,tmp_model,this.materials.bubble);
            // randomly choose horizontal and vertical movement distances

        }
 }
