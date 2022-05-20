import {defs, tiny} from './common.js';
import {Text_Line} from "./coin-spawner.js";

// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

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




export class Fish_Obj extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
    // Detailed model files can be used in place of simpler primitive-based
    // shapes to add complexity to a scene.  Simpler primitives in your scene
    // can just be thought of as placeholders until you find a model file
    // that fits well.  This demo shows the teapot model twice, with one
    // teapot showing off the Fake_Bump_Map effect while the other has a
    // regular texture and Phong lighting.
    constructor() {
        super();
        this.deadFish = [];
        this.submarineHealth=100;


        this.text_image = new Material(new defs.Textured_Phong(1), {
            ambient: 1, diffusivity: 0, specularity: 0,
            texture: new Texture("assets/text.png")
        })
        // Load the model file:
        this.wave_1_num_spawns = 0;
        this.wave_2_num_spawns = 0;
        this.wave_3_num_spawns = 0;
        this.wave_4_num_spawns = 0;
        this.spawn_time = 0;
        this.elapsed_time = 0;

        // fish_spawns contains the 5 (mutually exclusive within waves) spawn points that the fish randomly choose
        //each preset gets a set of spawns to help keep the fish from colliding due to differences in size and speed
        this.preset_1_spawns = {
            spawn_1 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   6.2, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_2 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30, 2.5, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_3 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   -1, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_4 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,-4.25, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_5 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   -7.2, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),
        };

        this.preset_2_spawns = {
            spawn_1 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   6.2, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_2 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30, 2.5, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_3 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   -1, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_4 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,-4.25, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_5 : Mat4.identity().times(Mat4.scale(1, 1, 1))
                .times(Mat4.translation(30,   -7.2, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),
        };

        this.preset_3_spawns = {
            spawn_1 : Mat4.identity().times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(20,   4, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_2 : Mat4.identity().times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(20, -5, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_3 : Mat4.identity().times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(20,   0, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_4 : Mat4.identity().times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(20,   4, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),

            spawn_5 : Mat4.identity().times(Mat4.scale(1.5, 1.5, 1.5))
                .times(Mat4.translation(20, -5, 0))
                .times(Mat4.rotation(Math.PI, 0, 1, 0)),
        };

        // fish_presets contains several fish prototypes that will be randomly selected by each fish.
        this.fish_presets = {
            preset_0 : {
                tag : 0,
                size : 0,
                speed : 0,
                spawn_array : this.preset_1_spawns,
            },
            preset_1 : {
                tag : 1,
                size : 1,
                speed : 0.036,
                spawn_array : this.preset_1_spawns,
            },
            preset_2 : {
                tag : 2,
                size : 1,
                speed : 0.036,
                spawn_array : this.preset_1_spawns,
            },
            preset_3 : {
                tag : 3,
                size : 1.5,
                speed : 0.036,
                spawn_array : this.preset_1_spawns,
            },
        };

        // each wave_X contains at most 3 fish
        // each fish in turn contains it's own data
        this.wave_1 = {
            fish_1 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_2 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_3 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            respawn_flag : 1,
        };

        this.wave_2 = {
            fish_1 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_2 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_3 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            respawn_flag : 1,
        };

        this.wave_3 = {
            fish_1 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_2 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_3 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            respawn_flag : 1,
        };

        this.wave_4 = {
            fish_1 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_2 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            fish_3 : {
                model_transform : Mat4.identity(),
                preset : this.fish_presets.preset_0,
                distance : 0,
                spawn : 0,
                respawn : 0,
                randomizer : 0,
            },
            respawn_flag : 1,
        };






        this.shapes = {
            fish_shape : new Shape_From_File("assets/fish.obj"),
            sphere : new defs.Subdivision_Sphere(4),
            text: new Text_Line(35),

        };
        // console.log(this.shapes.fish.arrays.texture_coord);
        // console.log(this.shapes.sphere.arrays.texture_coord);
        // this.shapes = {"sphere": new defs.Subdivision_Sphere(4)};
        // Don't create any DOM elements to control this scene:
        this.widget_options = {make_controls: false};
        // Non bump mapped:
        this.scales = new Material(new defs.Textured_Phong(1), {
            color: color(0, 0, 0, 1),
            ambient: 1, diffusivity: .1, specularity: .1, texture: new Texture("assets/scales_2.jfif")
        });
        // Bump mapped:
        this.bumps = new Material(new defs.Fake_Bump_Map(1), {
            color: color(0, 0, 0, 1),
            ambient: 1, diffusivity: .1, specularity: .1, texture: new Texture("assets/scales.jfif")
        });



    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.



    }



    spawn_wave_1()
    {
        //set fish spawn
        if(this.wave_1.respawn_flag == 1)
        {
            this.wave_1.fish_1.randomizer = 0;
            this.wave_1.fish_2.randomizer = 0;
            this.wave_1.fish_3.randomizer = 0;
            /***** fish_1 *****/
                //pick fish preset

            let offset = 0;
            if(this.wave_1_num_spawns >= 1)
            {
                offset = -25;
            }

            if(Math.random() >= 0.5)
            {
                 this.wave_1.fish_1.randomizer = 1;   
            }
            else
            {
                 this.wave_1.fish_1.randomizer = -1;
            }
            this.wave_1.fish_1.randomizer = this.wave_1.fish_1.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_1.fish_2.randomizer = 1;   
            }
            else
            {
                 this.wave_1.fish_2.randomizer = -1;
            }
            this.wave_1.fish_2.randomizer = this.wave_1.fish_2.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_1.fish_3.randomizer = 1;   
            }
            else
            {
                 this.wave_1.fish_3.randomizer = -1;
            }
            this.wave_1.fish_3.randomizer = this.wave_1.fish_3.randomizer * (Math.random() * 3.5);

            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_1.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_1.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_1.fish_1.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_1.fish_1.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_1.fish_1.preset = this.fish_presets.preset_1;
                    break;
            }

            //pick fish spawn point
            this.wave_1.fish_1.spawn = Math.ceil(Math.random() * 5.0);

            switch(this.wave_1.fish_1.spawn) {
                case 1 : this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
                case 2 : this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
                case 3 : this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
                case 4 : this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
                case 5 : this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
                default: this.wave_1.fish_1.model_transform = this.wave_1.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_1.randomizer, 0, 0));
                    break;
            }


            /***** fish_2 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_1.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_1.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_1.fish_2.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_1.fish_2.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_1.fish_2.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_1.fish_2.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive between waves
            while(this.wave_1.fish_2.spawn == this.wave_1.fish_1.spawn)
            {
                this.wave_1.fish_2.spawn = Math.ceil(Math.random() * 5.0);
            }

            switch(this.wave_1.fish_2.spawn) {
                case 1 : this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
                case 2 : this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
                case 3 : this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
                case 4 : this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
                case 5 : this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
                default: this.wave_1.fish_2.model_transform = this.wave_1.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_2.randomizer, 0, 0));
                    break;
            }
            /***** fish_3 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_1.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_1.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_1.fish_3.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_1.fish_3.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_1.fish_3.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_1.fish_3.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive
            //for fish_3 only, if it rolls the same spawn as another fish it has a 50/50 chance of not spawning or spawning somewhere else
            if(this.wave_1.fish_3.spawn == this.wave_1.fish_2.spawn || this.wave_1.fish_3.spawn == this.wave_1.fish_1.spawn)
            {
                let chance = Math.random();
                if(chance <= 0.5)
                {
                    while(this.wave_1.fish_3.spawn == this.wave_1.fish_2.spawn || this.wave_1.fish_3.spawn == this.wave_1.fish_1.spawn)
                    {
                        this.wave_1.fish_3.spawn = Math.ceil(Math.random() * 5.0);
                    }
                }
                else
                {
                    this.wave_1.fish_3.preset = this.fish_presets.preset_0;
                    this.wave_1.fish_3.respawn = 1;
                }


            }
            switch(this.wave_1.fish_3.spawn) {
                case 1 : this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
                case 2 : this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
                case 3 : this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
                case 4 : this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
                case 5 : this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
                default: this.wave_1.fish_3.model_transform = this.wave_1.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_1.fish_3.randomizer, 0, 0));
                    break;
            }

            //resets flag so fish don't repeadedly spawn
            this.wave_1.respawn_flag = 0;
        }


        //draw and move fish

        this.wave_1.fish_1.model_transform = this.wave_1.fish_1.model_transform.times(Mat4.translation(this.wave_1.fish_1.preset.speed, 0, 0));

        this.wave_1.fish_2.model_transform = this.wave_1.fish_2.model_transform.times(Mat4.translation(this.wave_1.fish_2.preset.speed, 0, 0));

        this.wave_1.fish_3.model_transform = this.wave_1.fish_3.model_transform.times(Mat4.translation(this.wave_1.fish_3.preset.speed, 0, 0));



        //logic to determine when it is time for a wave to respawn
        //variables to adjust for size/speed of fish so wave doesn't take too long to respawn
        let offset = 0;
        if(this.wave_1_num_spawns >= 1)
        {
            offset = 25;
        }

        let fish_1_distance = 60 + offset + this.wave_1.fish_1.randomizer;
        let fish_2_distance = 60 + offset + this.wave_1.fish_2.randomizer;
        let fish_3_distance = 60 + offset + this.wave_1.fish_3.randomizer;
        /*
        if(this.wave_1.fish_1.preset.tag == 3)
        {
              fish_1_distance = fish_1_distance - 15;
        }
        if(this.wave_1.fish_2.preset.tag == 3)
        {
              fish_2_distance = fish_2_distance - 15;
        }
        if(this.wave_1.fish_3.preset.tag == 3)
        {
              fish_3_distance = fish_3_distance - 15;
        }*/

        if(this.wave_1.fish_1.distance <= fish_1_distance)
        {
            this.wave_1.fish_1.distance = this.wave_1.fish_1.distance + this.wave_1.fish_1.preset.speed;
        }
        else
        {
            this.wave_1.fish_1.distance = 0;
            this.wave_1.fish_1.respawn = 1;
        }

        if(this.wave_1.fish_2.distance <= fish_2_distance)
        {
            this.wave_1.fish_2.distance = this.wave_1.fish_2.distance + this.wave_1.fish_2.preset.speed;
        }
        else
        {
            this.wave_1.fish_2.distance = 0;
            this.wave_1.fish_2.respawn = 1;
        }

        if(this.wave_1.fish_3.distance <= fish_3_distance)
        {
            this.wave_1.fish_3.distance = this.wave_1.fish_3.distance + this.wave_1.fish_3.preset.speed;
        }
        else
        {
            this.wave_1.fish_3.distance = 0;
            this.wave_1.fish_3.respawn = 1;
        }

        if(this.wave_1.fish_1.respawn == 1 && this.wave_1.fish_2.respawn == 1 && this.wave_1.fish_3.respawn == 1)
        {
            this.wave_1.respawn_flag = 1;
            this.wave_1.fish_1.respawn = 0;
            this.wave_1.fish_2.respawn = 0;
            this.wave_1.fish_3.respawn = 0;
            this.wave_1_num_spawns += 1;
            if(this.wave_1_num_spawns > 5)
            {
                this.wave_1_num_spawns = 5;
            }
        }
    }


    spawn_wave_2()
    {

        //set fish spawn
        if(this.wave_2.respawn_flag == 1)
        {
            this.wave_2.fish_1.randomizer = 0;
            this.wave_2.fish_2.randomizer = 0;
            this.wave_2.fish_3.randomizer = 0;

            if(Math.random() >= 0.5)
            {
                 this.wave_2.fish_1.randomizer = 1;   
            }
            else
            {
                 this.wave_2.fish_1.randomizer = -1;
            }
            this.wave_2.fish_1.randomizer = this.wave_2.fish_1.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_2.fish_2.randomizer = 1;   
            }
            else
            {
                 this.wave_2.fish_2.randomizer = -1;
            }
            this.wave_2.fish_2.randomizer = this.wave_2.fish_2.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_2.fish_3.randomizer = 1;   
            }
            else
            {
                 this.wave_2.fish_3.randomizer = -1;
            }
            this.wave_2.fish_3.randomizer = this.wave_2.fish_3.randomizer * (Math.random() * 3.5);
            /***** fish_1 *****/
            //pick fish preset

            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_2.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_2.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_2.fish_1.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_2.fish_1.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_2.fish_1.preset = this.fish_presets.preset_1;
                    break;
            }

            //pick fish spawn point
            this.wave_2.fish_1.spawn = Math.ceil(Math.random() * 5.0);
            let offset = -20; //-20
            if(this.wave_2_num_spawns >= 1)
            {
                offset = -25;
            }
            switch(this.wave_2.fish_1.spawn) {
                case 1 : this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
                case 2 : this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
                case 3 : this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
                case 4 : this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
                case 5 : this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
                default: this.wave_2.fish_1.model_transform = this.wave_2.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_1.randomizer, 0, 0));
                    break;
            }


            /***** fish_2 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_2.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_2.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_2.fish_2.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_2.fish_2.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_2.fish_2.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_2.fish_2.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive between waves
            while(this.wave_2.fish_2.spawn == this.wave_2.fish_1.spawn)
            {
                this.wave_2.fish_2.spawn = Math.ceil(Math.random() * 5.0);
            }

            switch(this.wave_2.fish_2.spawn) {
                case 1 : this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
                case 2 : this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
                case 3 : this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
                case 4 : this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
                case 5 : this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
                default: this.wave_2.fish_2.model_transform = this.wave_2.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_2.randomizer, 0, 0));
                    break;
            }
            /***** fish_3 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_2.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_2.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_2.fish_3.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_2.fish_3.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_2.fish_3.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_2.fish_3.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive
            //for fish_3 only, if it rolls the same spawn as another fish it has a 50/50 chance of not spawning or spawning somewhere else
            if(this.wave_2.fish_3.spawn == this.wave_2.fish_2.spawn || this.wave_2.fish_3.spawn == this.wave_2.fish_1.spawn)
            {
                let chance = Math.random();
                if(chance <= 0.5)
                {
                    while(this.wave_2.fish_3.spawn == this.wave_2.fish_2.spawn || this.wave_2.fish_3.spawn == this.wave_2.fish_1.spawn)
                    {
                        this.wave_2.fish_3.spawn = Math.ceil(Math.random() * 5.0);
                    }
                }
                else
                {
                    this.wave_2.fish_3.preset = this.fish_presets.preset_0;
                    this.wave_2.fish_3.respawn = 1;
                }


            }



            switch(this.wave_2.fish_3.spawn) {
                case 1 : this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
                case 2 : this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
                case 3 : this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
                case 4 : this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
                case 5 : this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
                default: this.wave_2.fish_3.model_transform = this.wave_2.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_2.fish_3.randomizer, 0, 0));
                    break;
            }





            //resets flag so fish don't repeadedly spawn
            this.wave_2.respawn_flag = 0;
        }


        //draw and move fish

        this.wave_2.fish_1.model_transform = this.wave_2.fish_1.model_transform.times(Mat4.translation(this.wave_2.fish_1.preset.speed, 0, 0));

        this.wave_2.fish_2.model_transform = this.wave_2.fish_2.model_transform.times(Mat4.translation(this.wave_2.fish_2.preset.speed, 0, 0));

        this.wave_2.fish_3.model_transform = this.wave_2.fish_3.model_transform.times(Mat4.translation(this.wave_2.fish_3.preset.speed, 0, 0));



        //logic to determine when it is time for a wave to respawn
        //variables to adjust for size/speed of fish so wave doesn't take too long to respawn

        let offset = 20; //20
        if(this.wave_2_num_spawns >= 1)
        {
            offset = 25;
        }

        let fish_1_distance = 60 + offset + this.wave_2.fish_1.randomizer;
        let fish_2_distance = 60 + offset + this.wave_2.fish_2.randomizer;
        let fish_3_distance = 60 + offset + this.wave_2.fish_3.randomizer;
        /*
        if(this.wave_2.fish_1.preset.tag == 3)
        {
              fish_1_distance = fish_1_distance - 15;
        }
        if(this.wave_2.fish_2.preset.tag == 3)
        {
              fish_2_distance = fish_2_distance - 15;
        }
        if(this.wave_2.fish_3.preset.tag == 3)
        {
              fish_3_distance = fish_3_distance - 15;
        }*/




        if(this.wave_2.fish_1.distance <= fish_1_distance)
        {
            this.wave_2.fish_1.distance = this.wave_2.fish_1.distance + this.wave_2.fish_1.preset.speed;
        }
        else
        {
            this.wave_2.fish_1.distance = 0;
            this.wave_2.fish_1.respawn = 1;
        }


        if(this.wave_2.fish_2.distance <= fish_2_distance)
        {
            this.wave_2.fish_2.distance = this.wave_2.fish_2.distance + this.wave_2.fish_2.preset.speed;
        }
        else
        {
            this.wave_2.fish_2.distance = 0;
            this.wave_2.fish_2.respawn = 1;
        }


        if(this.wave_2.fish_3.distance <= fish_3_distance)
        {
            this.wave_2.fish_3.distance = this.wave_2.fish_3.distance + this.wave_2.fish_3.preset.speed;
        }
        else
        {
            this.wave_2.fish_3.distance = 0;
            this.wave_2.fish_3.respawn = 1;
        }



        if(this.wave_2.fish_1.respawn == 1 && this.wave_2.fish_2.respawn == 1 && this.wave_2.fish_3.respawn == 1)
        {
            this.wave_2.respawn_flag = 1;
            this.wave_2.fish_1.respawn = 0;
            this.wave_2.fish_2.respawn = 0;
            this.wave_2.fish_3.respawn = 0;
            this.wave_2_num_spawns += 1;
            if(this.wave_2_num_spawns > 5)
            {
                this.wave_2_num_spawns = 5;
            }
        }
    }


    spawn_wave_3()
    {
        //set fish spawn
        if(this.wave_3.respawn_flag == 1)
        {

            this.wave_3.fish_1.randomizer = 0;
            this.wave_3.fish_2.randomizer = 0;
            this.wave_3.fish_3.randomizer = 0;

            let offset = -40; //-40
            if(this.wave_3_num_spawns >= 1)
            {
                offset = -25;
            }

            if(Math.random() >= 0.5)
            {
                 this.wave_3.fish_1.randomizer = 1;   
            }
            else
            {
                 this.wave_3.fish_1.randomizer = -1;
            }
            this.wave_3.fish_1.randomizer = this.wave_3.fish_1.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_3.fish_2.randomizer = 1;   
            }
            else
            {
                 this.wave_3.fish_2.randomizer = -1;
            }
            this.wave_3.fish_2.randomizer = this.wave_3.fish_2.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_3.fish_3.randomizer = 1;   
            }
            else
            {
                 this.wave_3.fish_3.randomizer = -1;
            }
            this.wave_3.fish_3.randomizer = this.wave_3.fish_3.randomizer * (Math.random() * 3.5);
            /***** fish_1 *****/
            //pick fish preset

            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_3.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_3.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_3.fish_1.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_3.fish_1.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_3.fish_1.preset = this.fish_presets.preset_1;
                    break;
            }

            //pick fish spawn point
            this.wave_3.fish_1.spawn = Math.ceil(Math.random() * 5.0);

            switch(this.wave_3.fish_1.spawn) {
                case 1 : this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
                case 2 : this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
                case 3 : this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
                case 4 : this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
                case 5 : this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
                default: this.wave_3.fish_1.model_transform = this.wave_3.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_1.randomizer, 0, 0));
                    break;
            }


            /***** fish_2 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_3.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_3.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_3.fish_2.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_3.fish_2.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_3.fish_2.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_3.fish_2.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive between waves
            while(this.wave_3.fish_2.spawn == this.wave_3.fish_1.spawn)
            {
                this.wave_3.fish_2.spawn = Math.ceil(Math.random() * 5.0);
            }

            switch(this.wave_3.fish_2.spawn) {
                case 1 : this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
                case 2 : this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
                case 3 : this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
                case 4 : this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
                case 5 : this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
                default: this.wave_3.fish_2.model_transform = this.wave_3.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_2.randomizer, 0, 0));
                    break;
            }
            /***** fish_3 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_3.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_3.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_3.fish_3.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_3.fish_3.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_3.fish_3.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_3.fish_3.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive
            //for fish_3 only, if it rolls the same spawn as another fish it has a 50/50 chance of not spawning or spawning somewhere else
            if(this.wave_3.fish_3.spawn == this.wave_3.fish_2.spawn || this.wave_3.fish_3.spawn == this.wave_3.fish_1.spawn)
            {
                let chance = Math.random();
                if(chance <= 0.5)
                {
                    while(this.wave_3.fish_3.spawn == this.wave_3.fish_2.spawn || this.wave_3.fish_3.spawn == this.wave_3.fish_1.spawn)
                    {
                        this.wave_3.fish_3.spawn = Math.ceil(Math.random() * 5.0);
                    }
                }
                else
                {
                    this.wave_3.fish_3.preset = this.fish_presets.preset_0;
                    this.wave_3.fish_3.respawn = 1;
                }


            }
            switch(this.wave_3.fish_3.spawn) {
                case 1 : this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
                case 2 : this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
                case 3 : this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
                case 4 : this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
                case 5 : this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
                default: this.wave_3.fish_3.model_transform = this.wave_3.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_3.fish_3.randomizer, 0, 0));
                    break;
            }

            //resets flag so fish don't repeadedly spawn
            this.wave_3.respawn_flag = 0;
        }


        //draw and move fish

        this.wave_3.fish_1.model_transform = this.wave_3.fish_1.model_transform.times(Mat4.translation(this.wave_3.fish_1.preset.speed, 0, 0));

        this.wave_3.fish_2.model_transform = this.wave_3.fish_2.model_transform.times(Mat4.translation(this.wave_3.fish_2.preset.speed, 0, 0));

        this.wave_3.fish_3.model_transform = this.wave_3.fish_3.model_transform.times(Mat4.translation(this.wave_3.fish_3.preset.speed, 0, 0));





        //logic to determine when it is time for a wave to respawn
        //variables to adjust for size/speed of fish so wave doesn't take too long to respawn
        let offset = 40; //40
        if(this.wave_3_num_spawns >= 1)
        {
            offset = 25;
        }

        let fish_1_distance = 60 + offset + this.wave_3.fish_1.randomizer;
        let fish_2_distance = 60 + offset + this.wave_3.fish_2.randomizer;
        let fish_3_distance = 60 + offset + this.wave_3.fish_3.randomizer;
        /*
        if(this.wave_3.fish_1.preset.tag == 3)
        {
              fish_1_distance = fish_1_distance - 15;
        }
        if(this.wave_3.fish_2.preset.tag == 3)
        {
              fish_2_distance = fish_2_distance - 15;
        }
        if(this.wave_3.fish_3.preset.tag == 3)
        {
              fish_3_distance = fish_3_distance - 15;
        }*/

        if(this.wave_3.fish_1.distance <= fish_1_distance)
        {
            this.wave_3.fish_1.distance = this.wave_3.fish_1.distance + this.wave_3.fish_1.preset.speed;
        }
        else
        {
            this.wave_3.fish_1.distance = 0;
            this.wave_3.fish_1.respawn = 1;
        }

        if(this.wave_3.fish_2.distance <= fish_2_distance)
        {
            this.wave_3.fish_2.distance = this.wave_3.fish_2.distance + this.wave_3.fish_2.preset.speed;
        }
        else
        {
            this.wave_3.fish_2.distance = 0;
            this.wave_3.fish_2.respawn = 1;
        }

        if(this.wave_3.fish_3.distance <= fish_3_distance)
        {
            this.wave_3.fish_3.distance = this.wave_3.fish_3.distance + this.wave_3.fish_3.preset.speed;
        }
        else
        {
            this.wave_3.fish_3.distance = 0;
            this.wave_3.fish_3.respawn = 1;
        }

        if(this.wave_3.fish_1.respawn == 1 && this.wave_3.fish_2.respawn == 1 && this.wave_3.fish_3.respawn == 1)
        {
            this.wave_3.respawn_flag = 1;
            this.wave_3.fish_1.respawn = 0;
            this.wave_3.fish_2.respawn = 0;
            this.wave_3.fish_3.respawn = 0;
            this.wave_3_num_spawns += 1;
            if(this.wave_3_num_spawns > 5)
            {
                this.wave_3_num_spawns = 5;
            }
        }
    }

    spawn_wave_4()
    {
        //set fish spawn
        if(this.wave_4.respawn_flag == 1)
        {

            this.wave_4.fish_1.randomizer = 0;
            this.wave_4.fish_2.randomizer = 0;
            this.wave_4.fish_3.randomizer = 0;

            let offset = -60; //-40
            if(this.wave_4_num_spawns >= 1)
            {
                offset = -25;
            }

            if(Math.random() >= 0.5)
            {
                 this.wave_4.fish_1.randomizer = 1;   
            }
            else
            {
                 this.wave_4.fish_1.randomizer = -1;
            }
            this.wave_4.fish_1.randomizer = this.wave_4.fish_1.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_4.fish_2.randomizer = 1;   
            }
            else
            {
                 this.wave_4.fish_2.randomizer = -1;
            }
            this.wave_4.fish_2.randomizer = this.wave_4.fish_2.randomizer * (Math.random() * 3.5);
            if(Math.random() >= 0.5)
            {
                 this.wave_4.fish_3.randomizer = 1;   
            }
            else
            {
                 this.wave_4.fish_3.randomizer = -1;
            }
            this.wave_4.fish_3.randomizer = this.wave_4.fish_3.randomizer * (Math.random() * 3.5);
            /***** fish_1 *****/
            //pick fish preset

            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_4.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_4.fish_1.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_4.fish_1.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_4.fish_1.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_4.fish_1.preset = this.fish_presets.preset_1;
                    break;
            }

            //pick fish spawn point
            this.wave_4.fish_1.spawn = Math.ceil(Math.random() * 5.0);

            switch(this.wave_4.fish_1.spawn) {
                case 1 : this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
                case 2 : this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
                case 3 : this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
                case 4 : this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
                case 5 : this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
                default: this.wave_4.fish_1.model_transform = this.wave_4.fish_1.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_1.randomizer, 0, 0));
                    break;
            }


            /***** fish_2 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_4.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_4.fish_2.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_4.fish_2.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_4.fish_2.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_4.fish_2.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_4.fish_2.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive between waves
            while(this.wave_4.fish_2.spawn == this.wave_4.fish_1.spawn)
            {
                this.wave_4.fish_2.spawn = Math.ceil(Math.random() * 5.0);
            }

            switch(this.wave_4.fish_2.spawn) {
                case 1 : this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
                case 2 : this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
                case 3 : this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
                case 4 : this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
                case 5 : this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
                default: this.wave_4.fish_2.model_transform = this.wave_4.fish_2.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_2.randomizer, 0, 0));
                    break;
            }
            /***** fish_3 *****/
            switch(Math.ceil(Math.random() * 3.0)) {
                case 0 : this.wave_4.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 1 : this.wave_4.fish_3.preset = this.fish_presets.preset_1;
                    break;
                case 2 : this.wave_4.fish_3.preset = this.fish_presets.preset_2;
                    break;
                case 3 : this.wave_4.fish_3.preset = this.fish_presets.preset_3;
                    break;
                default: this.wave_4.fish_3.preset = this.fish_presets.preset_1;
                    break;
            }

            this.wave_4.fish_3.spawn = Math.ceil(Math.random() * 5.0);

            //spawns are mutually exclusive
            //for fish_3 only, if it rolls the same spawn as another fish it has a 50/50 chance of not spawning or spawning somewhere else
            if(this.wave_4.fish_3.spawn == this.wave_4.fish_2.spawn || this.wave_4.fish_3.spawn == this.wave_4.fish_1.spawn)
            {
                let chance = Math.random();
                if(chance <= 0.5)
                {
                    while(this.wave_4.fish_3.spawn == this.wave_4.fish_2.spawn || this.wave_4.fish_3.spawn == this.wave_4.fish_1.spawn)
                    {
                        this.wave_4.fish_3.spawn = Math.ceil(Math.random() * 5.0);
                    }
                }
                else
                {
                    this.wave_4.fish_3.preset = this.fish_presets.preset_0;
                    this.wave_4.fish_3.respawn = 1;
                }


            }
            switch(this.wave_4.fish_3.spawn) {
                case 1 : this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_1.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break;
                case 2 : this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_2.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break;
                case 3 : this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break;
                case 4 : this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_4.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break;
                case 5 : this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_5.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break;
                default: this.wave_4.fish_3.model_transform = this.wave_4.fish_3.preset.spawn_array.spawn_3.times(Mat4.translation(offset - this.wave_4.fish_3.randomizer, 0, 0));
                    break; 
            }

            //resets flag so fish don't repeadedly spawn
            this.wave_4.respawn_flag = 0;
        }


        //draw and move fish

        this.wave_4.fish_1.model_transform = this.wave_4.fish_1.model_transform.times(Mat4.translation(this.wave_4.fish_1.preset.speed, 0, 0));

        this.wave_4.fish_2.model_transform = this.wave_4.fish_2.model_transform.times(Mat4.translation(this.wave_4.fish_2.preset.speed, 0, 0));

        this.wave_4.fish_3.model_transform = this.wave_4.fish_3.model_transform.times(Mat4.translation(this.wave_4.fish_3.preset.speed, 0, 0));





        //logic to determine when it is time for a wave to respawn
        //variables to adjust for size/speed of fish so wave doesn't take too long to respawn
        let offset = 60;
        if(this.wave_4_num_spawns >= 1)
        {
            offset = 25;
        }

        let fish_1_distance = 60 + offset + this.wave_4.fish_1.randomizer;
        let fish_2_distance = 60 + offset + this.wave_4.fish_2.randomizer;
        let fish_3_distance = 60 + offset + this.wave_4.fish_3.randomizer;
        /*
        if(this.wave_4.fish_1.preset.tag == 3)
        {
              fish_1_distance = fish_1_distance - 15;
        }
        if(this.wave_4.fish_2.preset.tag == 3)
        {
              fish_2_distance = fish_2_distance - 15;
        }
        if(this.wave_4.fish_3.preset.tag == 3)
        {
              fish_3_distance = fish_3_distance - 15;
        }*/

        if(this.wave_4.fish_1.distance <= fish_1_distance)
        {
            this.wave_4.fish_1.distance = this.wave_4.fish_1.distance + this.wave_4.fish_1.preset.speed;
        }
        else
        {
            this.wave_4.fish_1.distance = 0;
            this.wave_4.fish_1.respawn = 1;
        }

        if(this.wave_4.fish_2.distance <= fish_2_distance)
        {
            this.wave_4.fish_2.distance = this.wave_4.fish_2.distance + this.wave_4.fish_2.preset.speed;
        }
        else
        {
            this.wave_4.fish_2.distance = 0;
            this.wave_4.fish_2.respawn = 1;
        }

        if(this.wave_4.fish_3.distance <= fish_3_distance)
        {
            this.wave_4.fish_3.distance = this.wave_4.fish_3.distance + this.wave_4.fish_3.preset.speed;
        }
        else
        {
            this.wave_4.fish_3.distance = 0;
            this.wave_4.fish_3.respawn = 1;
        }

        if(this.wave_4.fish_1.respawn == 1 && this.wave_4.fish_2.respawn == 1 && this.wave_4.fish_3.respawn == 1)
        {
            this.wave_4.respawn_flag = 1;
            this.wave_4.fish_1.respawn = 0;
            this.wave_4.fish_2.respawn = 0;
            this.wave_4.fish_3.respawn = 0;
            this.wave_4_num_spawns += 1;
            if(this.wave_4_num_spawns > 5)
            {
                this.wave_4_num_spawns = 5;
            }
        }
    }

    getDistance(x1,y1,x2,y2) {
        return Math.sqrt( (x2-x1)**2 + (y2-y1)**2 );
    }

    checkSubmarineFishCollision(submarine_pos, fish_pos) {
                 
                let player_pos = [submarine_pos[0] - 3.5, submarine_pos[1] - 1];
                let player_width = 7;
                let player_height = 2;

                let fish_width = 2.5;
                let fish_height = 1.5;

                if (player_pos[0] > fish_width + fish_pos[0]
                    || fish_pos[0] > player_width + player_pos[0]
                    || player_pos[1] > fish_height + fish_pos[1]
                    || fish_pos[1] > player_height + player_pos[1])
                    {
                        return false; //no collision do nothing
                    }

                else                    //collision
                {
                    return true;
                }                               
    }


    checkCollision(missile_transform, fish_transform, submarine_transform) {
        let missile_pos = missile_transform.times(vec4(0,0,0,1));
        let fish_pos = fish_transform[0].times(vec4(0,0,0,1));
        let submarine_pos = submarine_transform.times(vec4(0,0,0,1));


        let missileCollision = (this.getDistance(missile_pos[0],missile_pos[1],fish_pos[0],fish_pos[1])<1); 
        let submarineCollision = this.checkSubmarineFishCollision(submarine_pos, fish_pos);
              
        if (!missileCollision && !submarineCollision)
            return false;
        this.deadFish.push(fish_transform[1]);
        if (submarineCollision)
            this.submarineHealth-=20;
        return true;
    }



    dead(i) {
        for (let j=0; j<this.deadFish.length; j++) {
            if (this.deadFish[j]==i)
                return true;
        }
        return false;
    }

    display(context, program_state, missile_transform, submarine_transform) {
        const t = program_state.animation_time, dt = program_state.animation_delta_time / 1000;

        this.spawn_wave_1();
        this.spawn_wave_2();
        this.spawn_wave_3();
        this.spawn_wave_4();

        let fishModelsToDisplay = [this.wave_1.fish_1.model_transform, this.wave_1.fish_2.model_transform, this.wave_1.fish_3.model_transform, this.wave_2.fish_1.model_transform, this.wave_2.fish_2.model_transform, this.wave_2.fish_3.model_transform, this.wave_3.fish_1.model_transform, this.wave_3.fish_2.model_transform, this.wave_3.fish_3.model_transform, this.wave_4.fish_1.model_transform, this.wave_4.fish_2.model_transform, this.wave_4.fish_3.model_transform];
        for (let j=0; j<fishModelsToDisplay.length;j++)
            fishModelsToDisplay[j] = [fishModelsToDisplay[j],j];


        for (let i=0; i<fishModelsToDisplay.length; i++) {
            if (!this.dead(i)&&!this.checkCollision(missile_transform,fishModelsToDisplay[i],submarine_transform))
                this.shapes.fish_shape.draw(context, program_state, fishModelsToDisplay[i][0].times(Mat4.rotation(.1*Math.sin(t/200),0,1,0)), this.scales);
        }

        if (this.submarineHealth>0) {
                let string = "Health: " + this.submarineHealth; 
                this.shapes.text.set_string(string, context.context);
                this.shapes.text.draw(context, program_state, Mat4.identity().times(Mat4.translation(-9,5,5)).times(Mat4.scale(0.5, 0.5, 0.5)), this.text_image);     

        }

        else {
                let string = "GAME OVER"; 
                this.shapes.text.set_string(string, context.context);
                this.shapes.text.draw(context, program_state, Mat4.identity().times(Mat4.translation(-6,-2,5)).times(Mat4.scale(1.5, 1.5, 1.5)), this.text_image);     
                throw new Error('Game Over'); 
        }
    }
   
}
