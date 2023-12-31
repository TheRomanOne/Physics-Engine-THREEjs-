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
            scale = [0, 0, 0],
            color = 0xaaabaa,
            castShadow = true,
            receiveShadow = true,
            shininess,
            setDepthMaterial = false,
            shaderUniforms={},
            mass = 0,
            has_target,
        } = props;

    let geomType = null
    switch(type)
    {
        case "cube":        geomType = THREE.BoxGeometry; break
        case "cylinder":    geomType = THREE.CylinderGeometry; break
        case "tetrahedron": geomType = THREE.TetrahedronBufferGeometry; break
        case "cone":        geomType = THREE.ConeGeometry; break
        case "sphere":      geomType = THREE.SphereGeometry; break
    }

    let geom = new geomType(...scale)

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

    mesh.entity = new THREE.Object3D()
    if(mass > 0)
    {
        mesh.entity.acceleration = vec3(0, 0, 0)
        mesh.entity.velocity = vec3(0, 0, 0)
        mesh.entity.mass = mass
        mesh.entity.time_lerp = 0
    }

    if(has_target)
    {
        mesh.entity.target = vec3()
    }
    return mesh;
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
        // camera.position.set(0, 10, -50)
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
	    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.body.appendChild(renderer.domElement);
        this.time = 0
        this.deltaTime = 0
        scene = new THREE.Scene();
        // this.entity.time_lerp = 0
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
    }
    
    update_camera = stat =>
    {
        let {
            position,
            look_at = this.player.position,
        } = stat

        let la = this.enemy.position.clone()
        la.y = 0

        if(position != undefined)
            this.camera.position.set(...position)
        else
        {
            let en_p = la.clone()
            let pl_p = this.player.position.clone()
            let dir = get_distance_vector(pl_p, en_p).normalize().multiplyScalar(50)
            let p = pl_p.clone().add(dir)
            p.y += 10
            p = p.lerp(this.camera.position, __CAM_SPEED__)
            this.camera.position.set(p.x, 10, p.z)
        }
        
        // if(!(look_at instanceof THREE.Vector3))
        //     look_at = vec3(look_at[0], look_at[1], look_at[2])    
        
        this.camera.lookAt(la)
    }


    physics = () =>
    {
        this.masses.forEach(m =>
        {
            if(m.entity.acceleration.length() > 0)
            {
                let { mass, velocity, acceleration } = m.entity

                acceleration.y -= __GRAVITY__
                acceleration.multiplyScalar(1 - __AIR_RESISTANCE__)
                // Δv = a * Δt
                m.position.add(acceleration.clone().multiplyScalar(this.deltaTime))
                
                
                if(m.entity.acceleration.length() < __EPSILON__)
                {
                    m.entity.acceleration.set(0, 0, 0)
                    m.entity.time_lerp = 0
                }else m.entity.time_lerp = clamp(m.entity.time_lerp + this.deltaTime, 0, 2)

                if(m.position.y < __EPSILON__)
                {
                    m.position.y = 0
                    m.entity.acceleration.y *= - __BOUNCE__ // bounce
                    let a = acceleration.clone()
                    a.y = 0
                    if(a.length() > 0)
                    {
                        a = acceleration.clone()
                        acceleration.multiplyScalar(1 - __FRICTION__)
                        acceleration.y = a.y
                    }
                }
                
            }
        })
    }

    move = () =>
    {
        let move = vec3(0, 0, 0)
        if(keysPressed["ArrowUp"] || keysPressed["KeyW"])
            move.z =  __MOVE_SCALE__
        if(keysPressed["ArrowDown"] || keysPressed["KeyS"])
            move.z = - __MOVE_SCALE__
        if(keysPressed["ArrowLeft"] || keysPressed["KeyA"])
            move.x =  __MOVE_SCALE__
        if(keysPressed["ArrowRight"] || keysPressed["KeyD"])
            move.x = - __MOVE_SCALE__

        if(keysPressed["Space"])
        {
            if(this.player.position.y == 0)
            {
                move.y =  __MOVE_SCALE__
            }
        }
        
        if(move.length() > 0)
        { 
            let mv = move.clone()
            mv.y = 0
            let tr_move = this.loc2glob(this.player, mv)
            // tr_move.add(this.player.position.clone().multiplyScalar(-1))
            let { acceleration } = this.player.entity
            acceleration.x += tr_move.x
            acceleration.y += move.y
            acceleration.z += tr_move.z

            acceleration.x = clamp(acceleration.x, -__MAX_SPEED__, __MAX_SPEED__)
            // acceleration.y = clamp(acceleration.y, 0, 50)
            acceleration.z = clamp(acceleration.z, -__MAX_SPEED__, __MAX_SPEED__)
        }
    }
    
    loc2glob = (obj, v) =>
    {
        let tr_move = v.applyMatrix4(obj.matrix)
        tr_move.add(this.player.position.clone().multiplyScalar(-1))
        return tr_move
    }
    setEventListeners()
    {
        document.body.onresize = () =>
        {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        addEventListener( 'click', e => {}, false );  

        addEventListener('mousemove', e => {});

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
        this.player.target

        let v = vec3(0, 0, 1)
    }
    create_world = () =>
    {
        this.ground = createObject( this, {
            type: "cube",
            scale: [50, 2, 50],
            setDepthMaterial: true,
            color: new THREE.Color(...[0.447, 0.941, .4]),
            castShadow: true,
            position: [0, -2, 0],
            shader_type: SHADER_TYPES.PHONG,
            shininess:0
        })

        this.scene.add(this.ground)
    }
    init_characters = () =>
    {
        this.masses = []
        this.create_player()
        this.create_enemy()
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
    create_player = () =>
    {
        this.player = createObject(this, {
            position: [0, 0, -10],
            scale: [1, 32, 16],
            color: 0xff3333,
            type: 'sphere',
            shader_type: SHADER_TYPES.PHONG,
            mass: __MASS__,
            name: "Player",
            has_target: true
        })

        this.player.magic_ball = createObject(this, {
            position: this.player.position.clone().add(vec3(Math.random(), Math.random(), Math.random()).normalize().multiplyScalar(3)),
            scale: [.2, 32, 16],
            color: 0xff5555,
            type: 'sphere',
        })
        this.scene.add(this.player.magic_ball)
        this.masses.push(this.player)
        this.scene.add(this.player)
    }

    create_enemy = () =>
    {
        this.enemy = createObject(this, {
            position: [0, 0, 10],
            scale: [1, 32, 16],
            color: 0x3333ff,
            type: 'sphere',
            shader_type: SHADER_TYPES.PHONG,
            name: 'Enemy',
            mass: __MASS__ * 3.4
        })
        this.enemy.magic_ball = createObject(this, {
            position: this.enemy.position.clone().add(vec3(Math.random(), Math.random(), Math.random()).normalize().multiplyScalar(3)),
            scale: [.2, 32, 16],
            color: 0x5555ff,
            type: 'sphere',
        })
        this.scene.add(this.enemy.magic_ball)
        this.masses.push(this.enemy)
        this.scene.add(this.enemy)
    }
    get_shader_ids() { return Object.keys(this.shaders) }
    
    updateScene()
    {
        this.deltaTime = this.clock.getDelta()
        this.time += this.deltaTime
        this.player.lookAt(this.player.entity.target)
        this.move()
        this.physics()
        this.update_camera({})
        // if(this.enemy.position.y < __EPSILON__)
        //     this.enemy.entity.acceleration.y += 10
        
        // if(get_distance_vector(this.player.position, this.player.enemy).length() < 50)
        {
            this.player.target = this.enemy.position.clone()
        }
        this.masses.forEach(m =>
        {
            let {position} = m
            let p = m.magic_ball.position
            let _p = position.clone()
            _p.y += 2
            let dist_v = get_distance_vector(_p, p)
            let dist = Math.max(0, dist_v.length() - 1.5)
            let dir = dist_v.clone().normalize()
            let new_p = p.clone().add(dir.multiplyScalar(dist * .1)).add(vec3(Math.sin(this.time * 5)/100, Math.cos(this.time*10)/100, 0))
            m.magic_ball.position.set(new_p.x, new_p.y, new_p.z)
            
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