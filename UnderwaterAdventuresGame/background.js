import {defs, tiny} from './common.js';
import {Shape_From_File} from "./submarine.js";


const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const {Textured_Phong} = defs

export class Background extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // These two callbacks will step along s and t of the first sheet:
        const initial_corner_point = vec3(-1, -1, 0);
        const row_operation = (s, p) => p ? Mat4.translation(0, .2, 0).times(p.to4(1)).to3()
            : initial_corner_point;
        const column_operation = (t, p) => Mat4.translation(.2, 0, 0).times(p.to4(1)).to3();

        // These two callbacks will step along s and t of the second sheet:
        const row_operation_2 = (s, p) => { 
            return vec3(40 *-1, 20 * (2 * s - 1), 1);

        }

        const column_operation_2 = (t, p, s) => {
            if (t == 1)
            {
                return vec3(40 * (2 * t - 1), 20 * (2 * s - 1), 1);

            }
            return vec3( 40 * (2 * t - 1), 20 * (2 * s - 1), Math.random() * 8);
        }

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            torus: new defs.Torus(15, 15),
            circle: new defs.Regular_2D_Polygon(1, 15),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new defs.Subdivision_Sphere(2),
            sphere3: new defs.Subdivision_Sphere(3),
            sphere4: new defs.Subdivision_Sphere(4),

            //flat
            sheet: new defs.Grid_Patch(10, 10, row_operation, column_operation),

            //3 different grid patches of random heights
            sheet2: new defs.Grid_Patch(10, 10, row_operation_2, column_operation_2), //hills and valleys
            sheet3: new defs.Grid_Patch(10, 10, row_operation_2, column_operation_2), //hills and valleys
            sheet4: new defs.Grid_Patch(10, 10, row_operation_2, column_operation_2), //hills and valleys

            seaweed: new Shape_From_File("assets/seaweed.obj")
        };

        // *** Materials
        const phong = new defs.Phong_Shader();
        this.materials = {
//             terrain: new Material(new Textured_Phong(),
//                 {ambient: 0.5, diffusivity: 1, specularity: 0, color: color(.9, .5, .9, 1), texture: new Texture("assets/water.jpg")}),
            terrain: new Material(phong,
                {ambient: 0.5, diffusivity: 1, specularity: 0, color: color(.9, .5, .9, 1)}),
            seaweed: new Material(phong,
                {ambient: 0.5, diffusivity: 1, specularity: 0.7, color: color(.9, .5, .9, 1)}),
            bubble: new Material(phong,
                {ambient: 0.8, diffusivity: 1, specularity: 1, color: color(1, 1, 1, 1)})
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        
        this.game_over = false;
        this.t = 0;        

        this.terrain_1_transform = Mat4.identity();
        this.number_loops_1 = 0; //number of  times a terrain piece exceeds distance limit and is moved to right

        this.terrain_2_transform = Mat4.identity();
        this.number_loops_2 = 0;

        this.terrain_3_transform = Mat4.identity();
        this.number_loops_3 = 0;

        this.seaweed_positions = {
            s1: [[-40 + 80*Math.random(), -6, -8], [-40 + 80*Math.random(), -6, -8], [-40 + 80*Math.random(), -4.5, -12], [-40 + 80*Math.random(), -2.7, -18], [-40 + 80*Math.random(), -2.5, -20]],
			s2: [[40 + 80*Math.random(), -6, -8], [40 + 80*Math.random(), -2.5, -20], [40 + 80*Math.random(), -4.5, -12], [40 + 80*Math.random(), -2.7, -18], [40 + 80*Math.random(), -6, -8]],
			s3: [[120 + 80*Math.random(), -2.5, -20], [120 + 80*Math.random(), -6, -8], [120 + 80*Math.random(), -4.5, -12], [120 + 80*Math.random(), -2.7, -18], [120 + 80*Math.random(), -6, -8]]
        }

        this.rock_positions = {
            r1: [[-40 + 80*Math.random(), -8, -10], [-40 + 80*Math.random(), -7.5, -15], [-40 + 80*Math.random(), -6, -24],  [-40 + 80*Math.random(), -6, -24]],
            r2: [[40 + 80*Math.random(), -8, -10], [40 + 80*Math.random(), -6, -24], [40 + 80*Math.random(), -6.5, -15]],
            r3: [[120 + 80*Math.random(), -8, -10], [120 + 80*Math.random(), -6, -24], [120 + 80*Math.random(), -6, -24], [120 + 80*Math.random(), -6.5, -15]]
		
        }
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.

    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls)
        {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(Mat4.translation(-5, 1, -25));

        }
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 100);

        const light_position = (vec4(50, -10, 10, 10));
        program_state.lights = [new Light(light_position, color(0.227,0.502,0.62, 1), 15000)];


        ///        
        this.t += program_state.animation_delta_time/1000;        


        if (this.game_over == false)
        {
            this.draw_terrain(context, program_state)
        }
        else
        {
            console.log("game over");
        }


//          game over test
//         if (this.t>4)
//         {
//             this.game_over=true;
//         }
    }


    draw_terrain(context, program_state){
            let scroll_rate = 10*this.t;
//             basic terrain loop test
//           let time = this.t * 2
//             if (time > 2)
//             {
//                 this.t = 0;
//             }

            this.terrain_1_transform = Mat4.identity()
            .times(Mat4.translation(-scroll_rate + this.number_loops_1 * 240, -3.2 -3, 4 -14))
            .times(Mat4.rotation(Math.PI*7/12, 1, 0, 0))
            if (this.terrain_1_transform[0][3] < -120)
            {
                this.number_loops_1 += 1;
            }

            this.terrain_2_transform = Mat4.identity()
            .times(Mat4.translation(-scroll_rate + 80 + this.number_loops_2 * 240, -3.2 -3, 4 -14))
            .times(Mat4.rotation(Math.PI*7/12, 1, 0, 0))
            if (this.terrain_2_transform[0][3] < -120)
            {
                this.number_loops_2 += 1;
            }

            this.terrain_3_transform = Mat4.identity()
            .times(Mat4.translation(-scroll_rate + 160 + this.number_loops_3 * 240, -3.2 -3, 4 -14))
            .times(Mat4.rotation(Math.PI*7/12, 1, 0, 0))
            if (this.terrain_3_transform[0][3] < -120)
            {
                this.number_loops_3 += 1;
            }
//             console.log(this.terrain_1_transform[0][3])
//             console.log(this.number_loops_1)

            //draw terrain piece 1, 2, 3
            this.shapes.sheet2.draw(context, program_state, this.terrain_1_transform, this.materials.terrain.override({color: hex_color("#3a809e")}));
            this.shapes.sheet3.draw(context, program_state, this.terrain_2_transform, this.materials.terrain.override({color: hex_color("#3a809e")}));
            this.shapes.sheet3.draw(context, program_state, this.terrain_3_transform, this.materials.terrain.override({color: hex_color("#3a809e")}));

            //draw background         
            this.shapes.sheet.draw(context, program_state, Mat4.identity().times(Mat4.translation(5, 5, -6 -24)).times(Mat4.scale(45, 20, 1)), this.materials.terrain.override({color: hex_color("#31738f")}));

            //draw seaweed
            this.draw_seaweed(context, program_state, this.seaweed_positions.s1, scroll_rate, this.number_loops_1);
            this.draw_seaweed(context, program_state, this.seaweed_positions.s2, scroll_rate, this.number_loops_2);
            this.draw_seaweed(context, program_state, this.seaweed_positions.s3, scroll_rate, this.number_loops_3);

            this.draw_rocks(context, program_state, this.rock_positions.r1, scroll_rate, this.number_loops_1);
            this.draw_rocks(context, program_state, this.rock_positions.r2, scroll_rate, this.number_loops_2);
            this.draw_rocks(context, program_state, this.rock_positions.r3, scroll_rate, this.number_loops_3);

    }

    draw_seaweed(context, program_state, positions_array, scroll_rate, terrain_number_loops){
            for(let i = 0; i < positions_array.length; i++)
            {
                let flip_factor = 1
                if (i % 2 == 0)
                {
                    flip_factor = -1
                }
                

                let seaweed_position = Mat4.identity()
                .times(Mat4.translation(-scroll_rate + positions_array[i][0] + terrain_number_loops * 240, positions_array[i][1], positions_array[i][2]))
                .times(Mat4.rotation(Math.PI/2, 0, 1 * flip_factor, 0))

                let swaying_motion = Mat4.identity()
                .times(Mat4.translation(0, -2, 0))
                .times(Mat4.rotation(Math.PI*1/10 * Math.sin(this.t * 2 + i), 1, 0, 1))
                .times(Mat4.translation(0, 2, 0))

                let seaweed_transform = Mat4.identity()
                .times(seaweed_position)
                .times(swaying_motion)
                .times(Mat4.scale(8, 4 + 4*i/4, 4));

                this.shapes.seaweed.draw(context, program_state, seaweed_transform, this.materials.seaweed.override({color: hex_color("#3a9485")}));
            }
    }

    draw_rocks(context, program_state, positions_array, scroll_rate, terrain_number_loops){

            for(let i = 0; i < positions_array.length; i++)
            {
//                 positions_array[i][1] -= 2
                let rock_position = Mat4.identity()
                .times(Mat4.translation(-scroll_rate + positions_array[i][0] + terrain_number_loops * 240, positions_array[i][1], positions_array[i][2] - 2))
                .times(Mat4.rotation(Math.PI * i/3, 0, 1, 0))

  
                let rock_transform = Mat4.identity()
                .times(rock_position)
                .times(Mat4.scale(4, 2*(i/4+2), 2));

                this.shapes.sphere2.draw(context, program_state, rock_transform, this.materials.terrain.override({color: hex_color("#3a809e")}));

            }
    }

}
