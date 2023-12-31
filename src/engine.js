__INFINITY__ = 99999
__MOVE_SCALE__ = 10
__GRAVITY__ = 5
__EPSILON__ = .0001
__AIR_RESISTANCE__ = .001
__FRICTION__ = .07
__CAM_SPEED__ = .9
__MAX_SPEED__ = 25
__MASS__ = 5
__BOUNCE__ = .85

let vec3 = (x, y, z) => new THREE.Vector3(x, y, z)

let keysPressed = {};
let makeEnum = nums =>
{
    let en = {}
    nums.forEach((n, i) => en[n] = i)
    return Object.freeze(en)
}

let SHADER_TYPES = makeEnum([
    "BASIC", "PHONG"
])

let clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v))

let clamp3 = (v, mn, mx) => vec3(
    clamp(v.x, mn, mx),
    clamp(v.y, mn, mx),
    clamp(v.z, mn, mx)
)

let CATALOGUE = makeEnum([
    
])

let get_distance_vector = (v1, v2) => v1.clone().add(v2.clone().multiplyScalar(-1))

let creatLight = (props) =>
{
        let {type, position, color, intensity, distance, decay} = props;
        let castShadow = true;
        
        let _type = null;
        if(type === "point")
            _type = THREE.PointLight;
        else if (type === "ambient")
        {
            _type = THREE.AmbientLight;
            castShadow = false;
        }else if (type === "directional")
            _type = THREE.DirectionalLight;
        
        let _l = new _type(new THREE.Color(color), intensity, distance, decay)
        _l.castShadow = castShadow;
        
        position && _l.position.set(position.x, position.y, position.z);
        // this.lights.add(_l);
        return _l;
}

class MaterialMaker
{
    constructor(context)
    {
        this.context = context
        this.basic = new THREE.MeshBasicMaterial( {
            side: THREE.DoubleSide,
            transparent: true
        } )
    
        this.phong = new THREE.MeshPhongMaterial();
    }

    make = (shaderUniforms, shader_type) =>
    {
        let material
        switch(shader_type)
        {
            case SHADER_TYPES.BASIC:
                material = this.basic; break;
            case SHADER_TYPES.PHONG:
                material = this.phong; break;
        }
        material = material.clone()
        material.needsUpdate = true;
        let {uuid} = material
        material.onBeforeCompile = (shader) =>
        {
            // shader.uniforms = {
            //     ...shader.uniforms,
            //     ...shaderUniforms,
            //     time: {value: 0},
            //     w_unit: {value: this.context.unit},
            // }
            
            // let shaders = this.shader_maker.make(shader_type)
            // shader.vertexShader = shaders.vertex
            // shader.fragmentShader = shaders.fragment;

            this.context.shaders[uuid] = shader
        }

        // material.customDepthMaterial = new THREE.MeshDepthMaterial({
        //     depthPacking: THREE.RGBADepthPacking,
        //     // map: clothTexture,
        //     alphaTest: 0.5
        //   });
        return material
    }
}

let createObject = (context, props) =>
{
    let { type, name,
            shader_type = SHADER_TYPES.BASIC,
            position = [0, 0, 0],
            rotation = [0, 0, 0],
            params = [0, 0, 0],
            color = 0xaaabaa,
            castShadow = true,
            receiveShadow = true,
            shininess,
            setDepthMaterial = false,
            shaderUniforms={},
        } = props;

    let geomType = null

    switch(type)
    {
        case "cylinder":      geomType = THREE.CylinderGeometry; break
        case "tetrahedron":   geomType = THREE.TetrahedronBufferGeometry; break
        case "cube":          geomType = THREE.BoxGeometry; break
        case "cone":          geomType = THREE.ConeGeometry; break
        case "sphere":        geomType = THREE.SphereGeometry; break
    }

    let geom = new geomType(...params)

    shaderUniforms = {
        ...shaderUniforms,
    }
    let material = context.material_maker.make(shaderUniforms, shader_type)
    material.color = new THREE.Color(color)
    if(shininess) material.shininess = shininess;

    let mesh = new THREE.Mesh(geom, material);
        
    if(name) mesh.name = name;
    if(position instanceof THREE.Vector3)
        position = [position.x, position.y, position.z]
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    return mesh;
}

class Entity
{
    constructor(name, features, context)
    {
        this.name = name
        let { mass=0 } = features
        this.context = context
        this.features = features
        this.object = createObject(context, features)
        context.scene.add(this.object)
        
        this.mass = mass
        this.acceleration = vec3(0, 0, 0)
        this.velocity = vec3(0, 0, 0)
        this.time_lerp = 0

        this.target = null
        this.locked_target = false
        this._ray_direction = vec3(0, -1, 0)
        this.raycaster = new THREE.Raycaster(this.object.position, this._ray_direction);
        // this.max_acc
        this.assert_surface()
    }    

    look_at = point => this.object.lookAt(point)

    cast_ray = direction =>
    {
        this._ray_direction = direction
        let ints = this.raycaster.intersectObjects( this.context.scene.children, true );
        return ints.length > 0 ? ints[0] : {distance: __INFINITY__}
    }

    create_target = () =>
    {
        this.target = createObject(this.context, {
            type: 'sphere',
            params: [.2, 5, 5],
            position: [0, 0, 10]
        })
        this.object.add(this.target)
    }

    direction_to = v =>
    {
        let dv = get_distance_vector(this.get_position(), v)
        dv.normalize()
        return dv
    }

    distance_to = v => get_distance_vector(this.get_position(), v).length()
    release_target = () =>
    {
        let t = vec3(0, 0, 10)
        this.target.position.set(t.x, t.y, t.z)
        this.locked_target = false
        t = this.to_global(t)
        this.object.lookAt(t)
    }
    set_target = v =>
    {
        this.object.lookAt(v)
        v = this.to_local(v)
        this.target.position.set(v.x, v.y + 2, v.z)
        this.locked_target = true
    }
    add_acceleration = tr_move => this.acceleration.add(tr_move)

    turn = a =>
    {
        // this.object.rotation.x -= a.z * Math.PI*2
        this.object.rotation.x = 0
        this.object.rotation.y -= a.x * Math.PI*2
        this.object.rotation.z = 0
    }

    _apply_gravity = () =>
    {
        // Δv = a * Δt
        this.acceleration.y -= __GRAVITY__
        this.acceleration.multiplyScalar(1 - __AIR_RESISTANCE__)
    }

    assert_surface = () =>
    {
        this.ground = this.cast_ray(vec3(0, -1, 0))
        if(this.ground.distance == __INFINITY__)
            return

        this.ground_point = this.ground.point
        let { y } = this.ground_point.clone()
        y += this.object.scale.y
        if(this.get_position().y < y + __EPSILON__)
        {   
            this.ground.distance = 0
            this.bounce(y)
            this.apply_friction(__FRICTION__)
        }
    }

    to_global = v => v.applyMatrix4(this.object.matrix)
    to_local = v => v.applyMatrix4(this.object.matrix.transpose())

    apply_force = f =>
    {
        let mv = f.clone()
        mv.y = 0
        let tr_move = this.to_global(mv)
        tr_move.add(this.get_position().multiplyScalar(-1))
        tr_move.y = f.y
        this.add_acceleration(tr_move)
        this.limit_acceleration()
    }
    
    compute_physics = () =>
    {
        let limit_jump = false
        if(this.mass > 0)
        {
            this._apply_gravity()
            this.object.position.add(this.get_acceleration().multiplyScalar(this.context.deltaTime))
            this.assert_surface()
        }else
        {
            this.object.position.add(this.get_acceleration().multiplyScalar(this.context.deltaTime))
            limit_jump = true
        }

        if(this.get_acceleration().length() < __EPSILON__)
            this.freeze()
        else 
            this.time_lerp = clamp(this.time_lerp + this.context.deltaTime, 0, 2)

        this.limit_acceleration(limit_jump)
    }

    limit_acceleration = limit_jump =>
    {
        let acc = this.acceleration
        acc.x = clamp(acc.x, -__MAX_SPEED__, __MAX_SPEED__)
        acc.z = clamp(acc.z, -__MAX_SPEED__, __MAX_SPEED__)
        if(limit_jump)
            acc.y = clamp(acc.y, -this.max_cc, this.max_cc)
        // if(acc.length() > this.max_acc)
        //     acc.multiplyScalar(.9)
    }

    bounce = from_height =>
    {
        this.object.position.y = from_height
        this.acceleration.y *= - __BOUNCE__ // bounce
    }

    apply_friction = friction =>
    {
        let a = this.get_acceleration()
        let h = a.y
        
        // check movement along xz axis
        a.y = 0
        if(a.length() > 0)
        {
            this.acceleration.multiplyScalar(1 - friction)
            this.acceleration.y = h
        }
    }

    freeze = () =>
    {
        this.acceleration.set(0, 0, 0)
        this.time_lerp = 0 
    }
    get_acceleration = () => this.acceleration.clone()
    get_position = () => this.object.position.clone()
    get_target = () =>
    {
        let t = this.target.position.clone()
        return this.locked_target ? t : this.to_global(t)
    }

    set_position = position =>
    {
        this.object.position.set(position.x, position.y, position.z)
    }

    add_magic_ball = features =>
    {
       let f = {...features}
       delete f.shader_type
       f.params = [.2, 32, 16]
       f.type = 'sphere'
    //    this.magic_ball = new Entity('magic', f, this.context)
    //    this.magic_ball.create_target()
    }
}

class Character extends Entity
{
    constructor(name, features, context)
    {
        features.type = 'sphere'
        super(name, features, context)
    }

    add_hat = () =>
    {
        let f = {...this.features}
        f.position = [0, f.params[0], 0]
        f.params = [1.5, .7, 7]
        f.type = "cone"
        let hat = createObject(this.context, f)
        this.object.add(hat)
    }

    add_sword = () =>
    {
        let f = {...this.features}
        let h = f.params[0]
        f.position = [-h, -.2 * h, 1]
        f.params = [.1, 5, 12]
        f.type = "cone"
        f.rotation = [.45 * Math.PI, 0, 0]
        let sword = createObject(this.context, f)
        // sword.rotation.set(new THREE.Vector3());

        this.object.add(sword)
    }
}

class Player extends Character
{
    constructor(name, features, context)
    {
        super(name, features, context)
        this.enemy = undefined
    }


    user_input = (move, turn) =>
    {
        if(this.ground.distance > 0)
            move.y = 0

        if(move.length() > 0)
            this.apply_force(move)

        if(turn.length() > 0)
            this.turn(turn)
    }

    set_enemy = enemy =>
    {
        this.enemy = enemy
    }

    advance = () =>
    {

        if(this.enemy != undefined)
            if(this.distance_to(this.enemy.get_position()) < 25)
            {
                
                this.enemy.set_target(this.get_position())
                if(this.enemy.ground.distance == 0)
                    this.enemy.acceleration.y += 10
                this.enemy.apply_force(vec3(Math.sin(Math.random() * 3.14 *2), 0, Math.sin(Math.random() * 3.14 *2)))
                //if(!this.player.locked_target)
                    this.set_target(this.enemy.get_position())
            }else if(this.locked_target)
                this.release_target()
    }
}

// Scene
class World
{
    constructor()
    {
        var scene, camera, renderer;
        var h = window.innerHeight
        var w = window.innerWidth
        var aspect = w/h;
        this.start = Date.now()
        this.raycaster = new THREE.Raycaster(); 
        this.mouse = new THREE.Vector2();
        camera = new THREE.PerspectiveCamera(15, aspect, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
	    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.body.appendChild(renderer.domElement);
        this.time = 0
        this.deltaTime = 0
        scene = new THREE.Scene();
        // this.time_lerp = 0
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.shaders = {}

        this.lights = new THREE.Object3D();
        this.scene.add(this.lights)

        this.setEventListeners();
        this.updateRender = this.updateRender.bind(this);

        this.clock = new THREE.Clock()
        this.material_maker = new MaterialMaker(this)

        // this.prev_mouse = undefined
    }
    
    update_camera = () =>
    {
        let target = this.player.get_target()
        target.y = 0

        let pl_p = this.player.get_position()
        let dir = this.player.direction_to(target).multiplyScalar(60)
        let p = pl_p.clone().add(dir)
        p.y += 10
        p = p.lerp(this.camera.position, __CAM_SPEED__)
        this.camera.position.set(p.x, p.y, p.z)

        target.y = 2
        this.camera.lookAt(target)
    }


    physics = (init=false) =>
    {
        this.masses.forEach(m =>
        {
            if(init || m.get_acceleration().length() > 0)
            {
                m.compute_physics()
            }
        })
    }

    user_input = () =>
    {
        let move = vec3(0, 0, 0)
        let turn = vec3(0, 0, 0)
        if(keysPressed["KeyW"]) move.z =  __MOVE_SCALE__
        if(keysPressed["KeyS"]) move.z = - __MOVE_SCALE__
        if(keysPressed["KeyA"]) move.x =  __MOVE_SCALE__
        if(keysPressed["KeyD"]) move.x = - __MOVE_SCALE__
        if(keysPressed["Space"]) move.y =  __MOVE_SCALE__

        if(keysPressed["ArrowUp"]) turn.z -= .005
        if(keysPressed["ArrowDown"]) turn.z += .005
        if(keysPressed["ArrowLeft"]) turn.x -= .005
        if(keysPressed["ArrowRight"]) turn.x += .005

        this.player.user_input(move, turn)
    }
    
    // cast_mouse_ray(event)
    // {
    //     this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1; 
    //     this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1; 
        
    //     this.raycaster.setFromCamera( this.mouse, this.camera );
    //     // calculate objects intersecting the picking ray 
    //     let ints = this.raycaster.intersectObjects( this.scene.children, true );
    //     // printf(ints)
    //     return ints;
    // }

    setEventListeners()
    {
        document.body.onresize = () =>
        {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        addEventListener( 'click', e => {}, false );  

        addEventListener('mousedown', e =>
        {
            // let t = createObject(this,
            //     {
            //         position: this.player.ground_point,
            //         type: 'sphere',
            //         params: [2, 32, 16]
            //     })
            // this.scene.add(t)
        });

        addEventListener('mousemove', e =>
        {
            // let mouse = new THREE.Vector3(e.pageX / window.innerWidth, 0, e.pageY / window.innerHeight)
            // mouse.x -= .5
            // mouse.z -= .5
            // mouse.z /= 4
            // this.player.turn(mouse)
        });

        addEventListener("keydown", event =>
        {
            let { code } = event
            keysPressed[code] = true;
        });

        addEventListener('keyup', event =>
        {
            delete keysPressed[event.code];
        });
    }      


    initScene()
    {
        this.let_there_be_light()        
        this.init_characters()
        this.create_world()
        this.physics(true)      
    }
    create_world = () =>
    {
        let features = {
            type: "cube",
            params: [100, 2, 100],
            setDepthMaterial: true,
            color: new THREE.Color(...[0.447, 0.941, .4]),
            castShadow: true,
            position: [0, -2, 0],
            shader_type: SHADER_TYPES.PHONG,
            shininess:0,
        }
        this.ground = new Entity("Ground", features, this)
        this.scene.add(this.ground.object)
    }
    init_characters = () =>
    {
        this.masses = []
        this.create_player([0, 5, -20])
        this.create_enemy([0, 5, 20])

        this.player.set_enemy(this.enemy)
    }
    let_there_be_light = () =>
    {
        let sun = creatLight({
            type: "directional",
            color: 0xaaaaaa,
            castShadow: true,
            position: {x:100, y:100, z: 0}
        });
        this.sun = sun
        this.lights.remove(sun)
        this.scene.add(sun)
        let d = 60;

        sun.shadow.camera.near = 0.1
        sun.shadow.camera.far = d*3
        sun.shadow.camera.left = - d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = - d;        

        this.ambient = creatLight({
            type: "ambient",
            color: 0x383838 ,
            position: {x:0, y:100, z: 0}
        })
        
        this.lights.add( this.ambient );
    }
    create_player = (position) =>
    {
        let features = {
            position: position,
            params: [1, 32, 16],
            color: 0xff3333,
            name: "Player",
            mass: __MASS__,
            shader_type: SHADER_TYPES.PHONG
        }
        let magic_features = {
            position: vec3(...position).clone().add(vec3(Math.random(), Math.random(), Math.random()).normalize().multiplyScalar(3)),
            color: 0xff5555,
        }
        this.player = new Player('Player', features, this)
        this.player.add_hat()
        this.player.add_sword()
        this.player.create_target()
        // this.player.add_magic_ball(magic_features)
        this.masses.push(this.player)
        
    }

    create_enemy = (position) =>
    {
        let features = {
            position: position,
            params: [1, 32, 16],
            color: 0x3333ff,
            name: 'Enemy',
            mass: __MASS__ * 3.4,
            shader_type: SHADER_TYPES.PHONG
        }
        let magic_features = {
            position: vec3(...position).add(vec3(Math.random(), Math.random(), Math.random()).normalize().multiplyScalar(3)),
            color: 0x5555ff,
        }
        this.enemy = new Character('Enemy', features, this)
        this.enemy.add_hat()
        this.enemy.add_sword()
        this.enemy.create_target()
        // this.enemy.add_magic_ball(magic_features)
        this.masses.push(this.enemy)
    }
    get_shader_ids() { return Object.keys(this.shaders) }
    
    updateScene()
    {
        this.deltaTime = this.clock.getDelta()
        this.time += this.deltaTime
        // this.player.set_target(this.player.target.position)
        this.physics()
        this.update_camera()
        this.user_input()
        
        this.player.advance()

        this.masses.forEach(m =>
        {
            // let position = m.get_position()
            // let p = m.magic_ball.get_position()
            // // position.y += 2
            // let dist_v = get_distance_vector(position, p)
            // let dist = Math.max(0, dist_v.length())
            // let dir = dist_v.clone().normalize()

            // m.magic_ball.set_target(position)
            // m.magic_ball.apply_force(vec3(0, 0, 1).multiplyScalar(.9 * dist))
            // // m.magic_ball.apply_force(dir.multiplyScalar(.9 * dist))
            // m.magic_ball.compute_physics()
            
        })
        // let ids = this.get_shader_ids()       
        // ids.forEach(i =>
        // {
        //     let s = this.shaders[i]
        //     s.uniforms.time.value = this.time
        // })
    }

    updateRender()
    {
        requestAnimationFrame(this.updateRender);

        this.updateScene();
        this.renderer.render( this.scene, this.camera );
    }

    run()
    {
        this.initScene();
        this.updateRender();
    }
}


let world = new World();

window.onload = function()
{
    var gui = new dat.GUI();
    var dt = {
        move: __MOVE_SCALE__,
        camera: __CAM_SPEED__,
        speed: __MAX_SPEED__,
        air: __AIR_RESISTANCE__ * .1,
        friction: __FRICTION__ * 10 ,
        gravity: __GRAVITY__,
        bounce: __BOUNCE__ * 10,
    };
    
    // String field
    let env1 = gui.addFolder('World')
    env1.add(dt, "move", 1, 50).name("Movement").onChange(v => __MOVE_SCALE__ =  v);
    env1.add(dt, "camera", 0, 1).name("Camera").onChange(c => __CAM_SPEED__ = c);
    env1.add(dt, "speed", 0, 100).name("Max Speed").onChange(c => __MAX_SPEED__ = c);

    let env2 = gui.addFolder('Physics')
    env2.add(dt, "air", 0, .1).name("Air Resistance").onChange(w => __AIR_RESISTANCE__ = w/.1);
    env2.add(dt, "friction", 0, 10).name("Friction").onChange(f => __FRICTION__ = f/10);
    env2.add(dt, "gravity", 0, 20).name("Gravity").onChange(g => __GRAVITY__ = g);
    env2.add(dt, "bounce", 0, 10).name("Bounce").onChange(b => __BOUNCE__ = b/10);
    env1.open()
    env2.open()
};

world.run();