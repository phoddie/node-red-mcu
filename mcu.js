const fs = require('fs-extra');
const path = require('path');
const { exec } = require('node:child_process');
const { execSync } = require('child_process');

const build_env = [
    "./main.js",      
    "./manifest.json",
    "./nodered.js",
    "./nodes"
]

let controller;

module.exports = function(RED) {
    function mcuBuilder(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg, send, done) {

            let cfg = {
                flows2build: msg.mcu.flows || config.flows2build || [],
                cmd: msg.mcu.msg || config.cmd || "",
                cwd: msg.mcu.cwd || config.cwd || "",
                env: msg.mcu.env || config.env || false
            }

            let nodes = [];
            let error;
            // let stdout;
            // let stderr;

            let f2bl = cfg.flows2build.length;
            if (f2bl > 0) {
                RED.nodes.eachNode(function(n) {
                    for (let i=0; i<f2bl; i+=1) {
                        if ((n.id && n.id==cfg.flows2build[i]) || (n.z && n.z==cfg.flows2build[i])) {
                            nodes.push(n);
                            break;
                        }
                    }
                })
            }
            nodes = JSON.stringify(nodes, null, 2);

            flowsjs = "const flows=" + nodes + ";\n";
            flowsjs+= "export default Object.freeze(flows, true);"

            if (cfg.env === true) {

                try {
                    let env = build_env;
                    let dest = cfg.cwd;

                    fs.ensureDirSync(dest);
                    for (let i=0; i<env.length; i+=1) {
                        let source = path.join(__dirname,env[i]);
                        let target = path.join(dest,env[i]);
                        let stat = fs.statSync(source);
                        if (stat.isDirectory()) {
                            fs.emptyDirSync(target);
                        }
                        fs.copySync(source,target);
                    }    
                }
                catch(err){
                    error = err;
                }
            }

            if (!error) {
                fs.writeFileSync(path.join(cfg.cwd, 'flows.js'), flowsjs, (err) => {
                    if (err) {
                        error = err;
                    }
                });
            }

            if (error) {
                msg.error = {};
                for (e in error) {
                    msg.error[e] = error[e];
                }
                send(msg);
                done();    
                return;    
            }

            exec(cfg.cmd, {
                cwd: cfg.cwd,
            }, (err, stdout, stderr) => {

                if (err) {
                    msg.error = {};
                    for (e in err) {
                        msg.error[e] = err[e];
                    }
                }

                msg.exec = {};
                msg.exec.stdout = stdout;
                msg.exec.stderr = stderr;

                // console.log("sss", msg);

                send(msg);
                done();
                return;                    
            });    
        });
    }
    RED.nodes.registerType("node-red-mcu",mcuBuilder);
}