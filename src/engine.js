__INFINITY__ = 99999
__MOVE_SCALE__ = 150
__GRAVITY__ = 10
__EPSILON__ = .0001
__AIR_RESISTANCE__ = .001
__FRICTION__ = .01
__CAM_SPEED__ = .9
__MAX_SPEED__ = 25
__MASS__ = 1
__BOUNCE__ = .85

let print = (...params) => console.log(...params)
let rnd = () => Math.random()
let rnd3 = () => vec3(rnd(), rnd(), rnd)
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

let clamp3 = (v, mn=null, mx=null) => vec3(
    clamp(v.x, mn, mx),
    clamp(v.y, mn, mx),
    clamp(v.z, mn, mx)
)

let min3 = (v, value) => vec3(
    Math.min(v.x, value),
    Math.min(v.y, value),
    Math.min(v.z, value)
)

let max3 = (v, value) => vec3(
    Math.max(v.x, value),
    Math.max(v.y, value),
    Math.max(v.z, value)
)

let sign3 = v => vec3(Math.sign(v.x),Math.sign(v.y),Math.sign(v.z)
)

let add = (v1, v2) => v1.clone().add(v2.clone())
let subtract = (v1, v2) => v1.clone().add(v2.clone().multiplyScalar(-1))
let mul = (v1, v2) => vec3().multiplyVectors(v1, v2)

let createLight = (props) =>
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

class Dashboard
{
    constructor()
    {
        this.board = null
        this.parameters3 = {
            velocity: null,
            acceleration: null,
            force: null
        }
        this.parameters1 = {
            time: 0
        }
        this.init()
    }

    set_value = (name, value) =>
    {
        if(value instanceof THREE.Vector3)
        {
            this.parameters3[name].x.innerHTML = value.x.toFixed(2)
            this.parameters3[name].y.innerHTML = value.y.toFixed(2)
            this.parameters3[name].z.innerHTML = value.z.toFixed(2)
        }else
        {
            this.parameters1[name].innerHTML = '' + value.toFixed(2)
        }
    }

    init = () =>
    {
        this.board = document.createElement('div')
        this.board.classList.add('dashboard')
        Object.keys(this.parameters3).forEach(param =>
        {  
            let v = document.createElement('div')
            this.parameters3[param] = {}
            v.classList.add(param)
            let axis = ['x', 'y', 'z']
            axis.forEach(a =>
            {
                let _a = document.createElement('div')  
                this.parameters3[param][a] = _a
                _a.classList.add(a)
                _a.innerHTML = 0
                v.appendChild(_a)
            })
            this.board.appendChild(v)
            
        })

        Object.keys(this.parameters1).forEach(param =>
        {  
            let v = document.createElement('div')
            this.parameters1[param] = v
            v.classList.add(param)
            this.board.appendChild(v)
            
        })
        document.body.appendChild(this.board)
    }
}
class MaterialMaker
{
    constructor(context)
    {
        this.context = context
        this.basic = new THREE.MeshBasicMaterial()
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

let make_mesh = (parent, props) =>
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
    let size = null
    switch(type)
    {
        // case "cylinder":      geomType = THREE.CylinderGeometry; break
        // case "tetrahedron":   geomType = THREE.TetrahedronBufferGeometry; break
        case "cube":
            geomType = THREE.BoxGeometry
            size = vec3(...params)
            break
        case "cone":
            geomType = THREE.ConeGeometry
            size = vec3(...[params[0], params[1], params[0]])
            break
        case "sphere":
            geomType = THREE.SphereGeometry;
            size = vec3(params[0], params[0], params[0])
            params[0] /= 2
            break
    }

    let geom = new geomType(...params)

    shaderUniforms = {
        ...shaderUniforms,
    }
    let material = parent.context.material_maker.make(shaderUniforms, shader_type)
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
    mesh.size = size
    mesh.entity = parent
    return mesh;
}

class Entity
{
    constructor(name, features, context)
    {
        this.name = name
        features.name = name
        let { mass=0 } = features
        this.context = context
        this.features = features
        this.object = make_mesh(this, features)
        this.object.entity = this
        context.colliders.add(this.object)
        if(mass > 0)this.context.masses.push(this)
        this.mass = mass
        this.acceleration = vec3()
        this.velocity = vec3()
        // this.momentum = vec3()
        // this.impulse = vec3()
        this.force = vec3()
        this.target = null
        this.locked_target = false
        this._ray_direction = vec3(0, -1, 0)
        this.raycaster = new THREE.Raycaster(this.object.position, this._ray_direction);
        this.in_motion = true
        this.sides = [
            vec3(1, 0, 0), vec3(-1, 0, 0),
            vec3(0, 1, 0), vec3(0, -1, 0),
            vec3(0, 0, 1), vec3(0, 0, -1),
        ]
        this.in_contact = {}

        // let is = [-1, 1]
        // is.forEach(i => is.forEach(j => is.forEach(k =>
        // {
        //     this.sides.push(vec3(i, j, k))
        // })))
    }    

    look_at = point => this.object.lookAt(point)

    cast_ray = direction =>
    {
        this._ray_direction = direction
        this.raycaster.set(this.object.position, this._ray_direction)
        let ints = this.raycaster.intersectObjects( this.context.colliders.children, false );
        return ints.length > 0 ? ints[0] : {distance: __INFINITY__}
    }

    create_target = () =>
    {
        this.target = make_mesh(this, {
            type: 'sphere',
            params: [.2, 5, 5],
            position: [0, 0, 20],
            name: 'target'
        })
        this.object.add(this.target)
    }

        
    to_global = v => v.applyMatrix4(this.object.matrix)
    to_local = v => v.applyMatrix4(this.object.matrix.transpose())
    distance_to = v => subtract(this.get_center(), v).length()

    direction_to = v =>
    {
        let dv = subtract(this.get_center(), v)
        dv.normalize()
        return dv
    }

    release_target = () =>
    {
        let t = vec3(0, 0, 10)
        this.target.position.set(t.x, t.y, t.z)
        this.locked_target = false
        t = this.to_global(t)
        this.object.lookAt(t)
    }
    
    turn = a =>
    {
        // a.multiplyScalar(0.05)
        // this.object.rotation.x -= a.z * Math.PI*2
        this.object.rotation.x = 0
        this.object.rotation.y = a.x * Math.PI*2
        this.object.rotation.z = 0
    }

    _apply_gravity = () =>
    {
        // F = m * g
        if(this.in_motion)
            this.add_force(vec3(0, -__GRAVITY__ * this.mass, 0))
    }

    _collide = surface =>
    {
        let s = this.get_size()

        if(s.length() < surface.distance)
            return false
    
        let p = surface.point.clone()
        let v = this.get_velocity()
        let a = this.get_acceleration()
        let n = surface.face.normal.clone()
        n = surface.object.entity.direction_to_global(n)
        surface.normal = n
        let obj_position = add(p, mul(n, s.multiplyScalar(.5)))
        
        let pos = this.get_center()
        let np = subtract(pos, obj_position)
        let mask = mul(np, sign3(n))
        
        let dx = this._calculate_delta_position(v, a, this.context.deltaTime*2)
        let np2 = subtract(add(pos, dx), obj_position)
        let mask2 = mul(np2, sign3(n))
        
        let m1 = sign3(mask)
        let m2 = sign3(mask2)
        let xx = m1.x != 0 && m1.x != m2.x
        let yy = m1.y != 0 && m1.y != m2.y
        let zz = m1.z != 0 && m1.z != m2.z
        
        if(xx || yy || zz)
        {
            surface.distance = 0
            this._bounce(obj_position, n)
            // this._apply_friction(__FRICTION__)
            
            // if(this.get_velocity().length() < .5)
            //     this.halt()
            return true    
        }

    
        return false
    }

    _check_collisions = () =>
    {
        // TODO: check if shooting only in movement direction is better
        this.sides.forEach(d =>
        {
            let s = this.cast_ray(d)
            let key = this.get_vector_sequence(d)
            let contact = false
            if(s.distance < __INFINITY__ && this.in_contact[key] != s)
                contact = this._collide(s)
            
            if(contact)
            {
                this.in_contact[key] = s

                // normal force
                let f = s.normal.clone().multiplyScalar(__GRAVITY__ * this.mass)
                this.add_force(f)
            }else if(Object.keys(this.in_contact).includes(key))
                delete this.in_contact[key]
            // if(key == "0-10")
            // print(this.in_contact[key])
        })

    }
    
    get_vector_sequence = v => v.x+''+v.y+''+v.z

    direction_to_global = d =>
    {
        d = this.to_global(d)
        d.add(this.get_center().multiplyScalar(-1))
        return d
    }

    compute_physics = () =>
    {
        if(this.mass > 0)
        {
            this._apply_gravity()
            this._check_collisions()
        }
        
        this.update_dashboard()
        this._calculate_state()
    }
    update_dashboard = () =>
    {
        if(this.dashboard != undefined)
        {
            this.dashboard.set_value("velocity", this.get_velocity())
            this.dashboard.set_value("acceleration", this.get_acceleration())
            this.dashboard.set_value("force", this.get_force())
        }
    }
    _calculate_delta_position = (v, a, t) =>
    {
        // 1. v * Δt
        // 2. ½ * a * (Δt²)
        // Δx = (1) + (2)
        let dx = vec3()
        dx.add(v.clone().multiplyScalar(t))
        dx.add(a.clone().multiplyScalar(0.5 * t * t))
        return dx
    }

    _calculate_state = () =>
    {
        let t = this.context.deltaTime
        let m = this.mass
        let {
            acceleration: a,
            velocity: v,
            position: p,
            force: f,
        } = this.get_status()
        
        // a = f / m
        // Δv = a * Δt
        if(this.in_motion || f.length() > __GRAVITY__ * m)
        {
            a = f.clone().multiplyScalar(1 / m)
            v.add(a.clone().multiplyScalar(t))
            
            let dx = this._calculate_delta_position(v, a, t)
            p.add(dx)

            // else
            {
                this.in_motion = true

                this.set_acceleration(a)
                this.set_velocity(v)
                this.set_center(p)

                this.force.set(0, 0, 0)
            }

            if(
                Object.keys(this.in_contact).length > 0 &&
                dx.length() < 1 && v.length() < .1
            )
                this.halt()
        }
            
    }
    
    _apply_friction = friction =>
    {
        let dv = this.get_velocity()
        //let mid_jump = dv.y > 0
        dv.y = 0 // check movement along xz axis
        if(dv.length() > 0)
        {
            // if(!this.in_motion)
            // {
            //     this.movement_axis = sign3(dv)
            //     this.in_motion = true
            // }
            let m = this.mass
            let n = m * __GRAVITY__
            let dir = dv.normalize().multiplyScalar(-n * friction)
            // let fm = n
            // let fa = vec3()
            // fa.x = -dv.x * fm       
            // fa.z = -dv.z * fm
            
            // reduce friction during bounce
            // if(mid_jump)
            //     fa.multiplyScalar(friction)
            // this.add_force(fa)
            // this.momentum = mul(this.momentum, vec3(friction, 0, friction))
            // this.momentum.x += fa.x; this.momentum.x *= friction
            // this.momentum.z += fa.z; this.momentum.z *= friction
        }
    }

    halt = () =>
    {
        console.log("object halted")
        this.acceleration.set(0, 0, 0)
        this.force.set(0, 0, 0)
        this.force.set(0, 0, 0)
        this.velocity.set(0, 0, 0)
        this.in_motion = false
    }

    _bounce = (center, normal) =>
    {
        this.set_center(center)

        // normal = normal.clone().multiplyScalar(-1)
        // F = Δp / Δt
        let m = this.mass
        let v = this.get_velocity()

        // let new_v = mul(v, mask)

        let dot = v.clone().normalize().dot(normal)
        let h = normal.clone().multiplyScalar(2 * dot * v.length())
        let new_v = subtract(v, h)  // Calculate reflection vector
        let delta_v = subtract(new_v, v)
        let dt_1 = 1 / this.context.deltaTime
        let force = delta_v.clone().multiplyScalar(m * dt_1)

        this.add_force(force.multiplyScalar(.9))
        // if(this.name == "ball")
        //     print(0)
    }

    get_movement_direction = () => this.get_velocity().normalize()
    get_acceleration = () => this.acceleration.clone()
    get_velocity = () => this.velocity.clone()
    get_center = () => this.object.position.clone()
    get_size = () => this.object.size.clone()
    get_force = () => this.force.clone()
    // get_momentum = () => this.momentum.clone()
    // get_impulse = () => this.impulse.clone()
    add_acceleration = acc => this.acceleration.add(acc)
    add_velocity = vel => this.velocity.add(vel)
    add_force = force =>
    {
        // this.impulse.add(force)
        this.force.add(force)
    }
    // add_momentum = mom => this.momentum.add(mom)
    get_target = () =>
    {
        let t = this.target.position.clone()
        return this.locked_target ? t : this.to_global(t)
    }
    get_status = () =>
    {
        return {
            acceleration: this.get_acceleration(),
            velocity: this.get_velocity(),
            position: this.get_center(),
            force: this.get_force(),
            // momentum: this.get_momentum()
        }
    }
    
    set_center = position => this.object.position.copy(position)
    set_velocity = velocity => this.velocity.copy(velocity)
    set_acceleration = acceleration => this.acceleration.copy(acceleration)
    // set_momentum = momentum => this.momentum.copy(momentum)
    set_force = force => this.force = force
    set_target = v =>
    {
        this.object.lookAt(v)
        v = this.to_local(v)
        this.target.position.set(v.x, v.y + 2, v.z)
        this.locked_target = true
    }
}

class Character extends Entity
{
    constructor(name, features, context)
    {
        features.type = 'sphere'
        super(name, features, context)
        this.jump_force = features.jump_force
        this.move_force = features.move_force
        this.temp = []
    }

    throw_ball = seconds =>
    {
        // looks like ball stays alive after timeout. check referances to it
        let r = .3 + .5*rnd()
        let o = add(this.get_center(), vec3(0, 2, 1))
        let d = this.direction_to_global(vec3(0, .2, 1).normalize())
        // let mv = this.get_movement_direction()
        // mv = mul(mv, vec3(.1, 0, .1))
        // d = add(d, mv).normalize()
        let t = SHADER_TYPES.PHONG
        let light = null
        let c = new THREE.Color(...[.2 + .7 * rnd(), .2 + .7 * rnd(), .2 + .7 * rnd()])
        if(rnd() < -.3)
        {
            t = SHADER_TYPES.BASIC
            c.r *= 2
            c.g *= 2
            c.b *= 2
            light = createLight({
                type: "point", color: c.getHex(),
                position: vec3(), intensity: .9,
                distance: 10*r, decay: 1,
                castShadow: true
            });
        }
        let features = {
            type: "sphere", params: [r, 32, 16],
            color: c, castShadow: true,
            position: o, shader_type:  t,
            mass: r
        }
        let ball = new Entity("ball", features, this.context)
        ball.add_force(d.multiplyScalar(750))
        if(light != null) ball.object.add(light)
        let i = this.temp.length
        setTimeout(() =>
        {
            let obj = this.temp[i].object
            let {parent} = obj
            parent.remove(obj)
            // this.temp.delete(this.temp[0])
        }, seconds * 1000)
    this.temp.push(ball)
    }

    add_hat = () =>
    {
        let f = {...this.features}
        f.position = [0, f.params[0], 0]
        f.params = [1.5, .7, 7]
        f.type = "cone"
        f.name = "hat"
        let hat = make_mesh(this, f)
        hat.ignore_collision = true
        this.object.add(hat)
    }

    add_sword = () =>
    {
        let f = {...this.features}
        let h = f.params[0]
        f.position = [-h, -.2 * h, 1]
        f.params = [.1, 5, 12]
        f.type = "cone"
        f.name = "sword"
        f.rotation = [.45 * Math.PI, 0, 0]
        let sword = make_mesh(this, f)
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
        this.dashboard = new Dashboard()
    }

    user_input = (move, turn) =>
    {
        if(Object.keys(this.in_contact).length > 0 && move.length() > 0)
        {
            this.in_motion = true
            // move only when on the ground
            let { y: jump } = move
            move.multiplyScalar(this.move_force)
            move.y=0
            this.add_force(move)
            if(jump > 0)
                this.add_force(vec3(0, 100, 0))
        }

        if(turn.length() > 0)
        {
            turn.multiplyScalar(.05)
            this.turn(turn)
        }
    }
    
    set_enemy = enemy =>
    {
        this.enemy = enemy
    }

    advance = () =>
    {

        // if(this.enemy != undefined)
        //     if(this.distance_to(this.enemy.get_center()) < 25)
        //     {
                
                // this.enemy.set_target(this.get_center())
                // if(this.enemy.ground.distance == 0)
                //     this.enemy.acceleration.y += 20
                // this.enemy.apply_force(vec3(Math.sin(rnd() * 3.14 *2), 0, Math.sin(rnd() * 3.14 *2)))
                    // this.set_target(this.enemy.get_center())
        //     }else if(this.locked_target)
        //         this.release_target()
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
        this.scene = scene;
        this.scene.background = new THREE.Color(0x5c87b8)
        this.camera = camera;
        this.renderer = renderer;
        this.shaders = {}

        this.lights = new THREE.Object3D();
        this.scene.add(this.lights)
        this.colliders = new THREE.Object3D()
        this.scene.add(this.colliders)
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
        target.y = 0

        let pl_p = this.player.get_center()
        let dir = this.player.direction_to(target).multiplyScalar(50)
        let p = add(pl_p, dir)
        p.y = 7
        p = p.lerp(this.camera.position, __CAM_SPEED__)
        this.camera.position.set(p.x, p.y, p.z)

        target.y = 2
        this.camera.lookAt(target)
    }


    physics = () =>
    {
        if(this.deltaTime == 0)
            return
        this.masses.forEach(m =>
        {
            m.compute_physics()
        })
    }

    user_input = () =>
    {
        let move = vec3(0, 0, 0)
        let turn = vec3(0, 0, 0)
        if(keysPressed["KeyW"]) move.z =  1
        if(keysPressed["KeyS"]) move.z = - 1
        if(keysPressed["KeyA"]) move.x =  1
        if(keysPressed["KeyD"]) move.x = - 1
        if(keysPressed["Space"]) move.y =  1

        if(keysPressed["ArrowUp"]) turn.z -= 1
        if(keysPressed["ArrowDown"]) turn.z += 1
        if(keysPressed["ArrowLeft"]) turn.x -= 1
        if(keysPressed["ArrowRight"]) turn.x += 1

        // if(move.length() + turn.length() > 0)
        //     this.player.user_input(move, turn)
    }
    
    // cast_mouse_ray(event)
    // {
    //     this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1; 
    //     this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1; 
        
    //     this.raycaster.setFromCamera( this.mouse, this.camera );
    //     // calculate objects intersecting the picking ray 
    //     let ints = this.raycaster.intersectObjects( this.scene.children, true );
    //     // print(ints)
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
            this.player.throw_ball(10)
        });

        addEventListener('mousemove', e =>
        {
            let mouse = new THREE.Vector3(e.pageX / window.innerWidth, 0, e.pageY / window.innerHeight)

            mouse.x -= .5
            mouse.x *= -.2
            mouse.y = 0
            mouse.z = 0
            this.player.turn(mouse)
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

    restart = () =>
    {
        this.player.set_center(vec3([0, 5, -20]))
    }

    initScene()
    {
        this.let_there_be_light()        
        this.create_world()
        this.init_characters()
        this.physics()      
    }
    create_world = () =>
    {
        let features = {
            type: "cube",
            params: [100, 2, 100],
            rotation: [0, 0, 0],
            setDepthMaterial: true,
            color: new THREE.Color(...[0.447, 0.941, .4]),
            castShadow: true,
            position: vec3(),
            shader_type: SHADER_TYPES.PHONG,
            shininess:0,
        }
        let h = 7
        let w1 = { ...features, position: vec3(0, h/2, 45), params: [20, h, 3] }
        let w2 = { ...w1, position: vec3(10, h/2, 43), rotation: [0, 3.14/7, 0] }
        let w3 = { ...w1, position: vec3(-10, h/2, 43), rotation: [0, -3.14/7, 0] }
        
        new Entity("ground", features, this)
        new Entity("wall_center", w1, this)
        new Entity("wall_right", w2, this)
        new Entity("wall_left", w3, this)
    }
    init_characters = () =>
    {
        this.masses = []
        this.create_player([0, 3, 0])
        // this.create_enemy([0,5, 20])

        // this.player.set_enemy(this.wall)
    }
    let_there_be_light = () =>
    {
        let sun = createLight({
            type: "directional",
            color: 0xaaaaaa,
            castShadow: true,
            position: vec3(20, 50, -30)
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

        this.ambient = createLight({
            type: "ambient",
            color: 0x484848 ,
            position: {x:0, y:100, z: 0}
        })
        
        this.lights.add( this.ambient );
    }
    create_player = (position) =>
    {
        let features = {
            position: position,
            params: [2, 32, 16],
            color: 0xff3333,
            name: "Player",
            mass: __MASS__,
            shader_type: SHADER_TYPES.PHONG,
            jump_force: 10,
            move_force: __MOVE_SCALE__
        }
        this.player = new Player('Player', features, this)
        this.player.add_hat()
        this.player.add_sword()
        this.player.create_target()
    }

    create_enemy = (position) =>
    {
        let features = {
            position: position,
            params: [1, 32, 16],
            color: 0x3333ff,
            name: 'Enemy',
            mass: __MASS__ * 13.4,
            shader_type: SHADER_TYPES.PHONG,
            jump_force: 10,
            move_force: __MOVE_SCALE__
        }
        this.enemy = new Character('Enemy', features, this)
        this.enemy.add_hat()
        this.enemy.add_sword()
        this.enemy.create_target()
    }
    get_shader_ids() { return Object.keys(this.shaders) }
    
    updateScene()
    {
        this.deltaTime = Math.min(0.02, this.clock.getDelta())

        this.time += this.deltaTime
        this.player.dashboard.set_value("time", this.time)
        this.physics()
        this.user_input()
        this.player.advance()
        this.update_camera()

        if(this.player.get_center().y < -5)
            this.restart()
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
        friction: __FRICTION__,
        gravity: __GRAVITY__,
        bounce: __BOUNCE__,
    };
    
    let env1 = gui.addFolder('World')
    env1.add(dt, "move", 1, 1000).name("Movement").onChange(v => world.player.move_force =  v);
    env1.add(dt, "camera", 0, 1).name("Camera").onChange(c => __CAM_SPEED__ = c);
    env1.add(dt, "speed", 0, 100).name("Max Speed").onChange(c => __MAX_SPEED__ = c);

    let env2 = gui.addFolder('Physics')
    env2.add(dt, "air", 0, .1).name("Air Resistance").onChange(w => __AIR_RESISTANCE__ = w/.1);
    env2.add(dt, "friction", 0, 1).name("Friction").onChange(f => __FRICTION__ = f);
    env2.add(dt, "gravity", 0, 20).name("Gravity").onChange(g => __GRAVITY__ = g);
    env2.add(dt, "bounce", 0, 1).name("Bounce").onChange(b => __BOUNCE__ = b);
};

world.run();