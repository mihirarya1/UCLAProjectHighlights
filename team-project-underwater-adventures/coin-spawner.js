import {defs, tiny} from './common.js';
const {Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture} = tiny;
const {Textured_Phong} = defs

//from sample code
export class Text_Line extends Shape {
    constructor(max_size) {
        super("position", "normal", "texture_coord");
        this.max_size = max_size;
        var object_transform = Mat4.identity();
        for (var i = 0; i < max_size; i++) {                                       // Each quad is a separate Square instance:
            defs.Square.insert_transformed_copy_into(this, [], object_transform);
            object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
        }
    }

    set_string(line, context) {           // set_string():  Call this to overwrite the texture coordinates buffer with new
        // values per quad, which enclose each of the string's characters.
        this.arrays.texture_coord = [];
        for (var i = 0; i < this.max_size; i++) {
            var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
                col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

            var skip = 3, size = 32, sizefloor = size - skip;
            var dim = size * 16,
                left = (col * size + skip) / dim, top = (row * size + skip) / dim,
                right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

            this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
                [left, 1 - top], [right, 1 - top]));
        }
        if (!this.existing) {
            this.copy_onto_graphics_card(context);
            this.existing = true;
        } else
            this.copy_onto_graphics_card(context, ["texture_coord"], false);
    }
}


export class Coin_Spawner extends Scene {
    constructor() {
        super();
        this.widget_options = {make_controls: false};

        this.shapes = {square: new defs.Square(), text: new Text_Line(35)};
        // To show text you need a Material like this one:
        this.text_image = new Material(new defs.Textured_Phong(1), {
            ambient: 1, diffusivity: 0, specularity: 0,
            texture: new Texture("assets/text.png")
        });

        this.coins = [];
        this.score = 0;

        this.next_spawn_time = 0;
        this.coin_obj = new Coin();

        this.total_spawned = 0;
        this.total_deleted = 0;

        this.submarine_transform = Mat4.identity(); //player position
    }
    
    attempt_spawn_coin(rng){
        if (rng < 0.75 && this.coins.length < 5) //every 3 seconds, 75% chance to generate a coin 
        {
//             console.log("spawn");
            this.coins.push([30, -7 + Math.random() * 14, 0]);
            this.total_spawned += 1;
//             console.log("spawned: " + this.total_spawned)
        }

        this.next_spawn_time += 3;
    }
   
    //run every frame, shift all coins left and delete when off-screen
    update_and_check_coins(program_state){
        for(let i = 0; i < this.coins.length; i++){
            this.coins[i][0] -= program_state.animation_delta_time/1000 * 10;

            if (this.coins[i][0] < -15)
            {
//                 console.log("delete");
                this.delete_coin(this.coins[i])
            }
        }
    }

    delete_coin(toDelete){
        const index = this.coins.indexOf(toDelete);
        if (index > -1){
            this.coins.splice(index, 1);
        }

        this.total_deleted += 1;
//         console.log("deleted: " + this.total_deleted)
//         console.log(this.coins);
    }

    //for all coins, check if player collides by getting their positions and seeing if the fall within a box area
    //if collided, add to a temp array of coins to delete, then delete them all and add to score
    check_collision(){
        let coins_to_delete = [];

        if (this.coins.length > 0)
        {
            for(let i = 0; i < this.coins.length; i++)
            {
                let player_pos = [this.submarine_transform[0][3] - 3.5, this.submarine_transform[1][3] - 1];
                let player_width = 7;
                let player_height = 2;

                let coin_pos = [this.coins[i][0], this.coins[i][1]]; 
                let coin_width = 1.5;
                let coin_height = 1.5;

                if (player_pos[0] > coin_width + coin_pos[0]
                    || coin_pos[0] > player_width + player_pos[0]
                    || player_pos[1] > coin_height + coin_pos[1]
                    || coin_pos[1] > player_height + player_pos[1])
                    {
                        //no collision do nothing
                    }

                else                    //collision
                {
                    coins_to_delete.push(this.coins[i]);
                }              
            }
        }

        if (coins_to_delete.length > 0)
        {
            for(let i = 0; i < coins_to_delete.length; i++)
            {
                this.delete_coin(coins_to_delete[i]);
                this.score += 1;
            }
        }
    }

    display(context, program_state, model_transform){
        if(program_state.animation_time/1000 > this.next_spawn_time) //75% chance to spawn coin every 3 seconds
        {
            let rng = Math.random();
            this.attempt_spawn_coin(rng);
        }

        this.update_and_check_coins(program_state); //shift coins left and delete off-screen
        
        //display coins
        if (this.coins.length > 0 && this.coins.length < 6)
        {
            for(let i = 0; i < this.coins.length; i++)
            {
                this.coin_obj.display(context, program_state, this.coins[i]);
            }
        }

        //check for collision and add to score if any
        this.submarine_transform = model_transform;
        this.check_collision();

        //display score
        let score_string = "Score: " + this.score; 
        this.shapes.text.set_string(score_string, context.context);
        this.shapes.text.draw(context, program_state, Mat4.identity().times(Mat4.translation(-9,6,5)).times(Mat4.scale(0.5, 0.5, 0.5)), this.text_image);     
    }
}


export class Coin extends Scene { 
    constructor() {
        super();
        // Load the model file:

        this.shapes = {
            "coin": new defs.Regular_2D_Polygon(1,30)
        };


        this.materials = {
            coin: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffaabb")})
        };
    }

    display(context, program_state, position) {

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(Mat4.translation(0, 0, -30));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        const t = program_state.animation_time; // IN MILLISECONDS

        program_state.lights = [new Light(vec4(3, 2, 10, 1),color(1, .7, .7, 1), 100000)];

        let model_transform = Mat4.identity();

        model_transform = model_transform.times(Mat4.translation(position[0], position[1], position[2])).times(Mat4.rotation(t/200,0,1,0));

        this.shapes.coin.draw(context,program_state,model_transform,this.materials.coin);
    }
}