import { mat4 } from 'gl-matrix';
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';
import VoxReader from '../VoxReader';
import template from '../templates/voxelVis.pug';

import fshaderSource from '../shaders/fragment.glsl';
import vshaderSource from '../shaders/vertex.glsl';
import '../stylesheets/voxelVis.styl';

const VoxelView = View.extend({
    events: {
        'mousedown .g-voxel-vis-canvas': function (e) {
            this._dragStart = [e.clientX, e.clientY];
        },
        'mousemove .g-voxel-vis-canvas': function (e) {
            var info = {
                event: e,
                delta: [
                    e.clientX - this._dragStart[0],
                    e.clientY - this._dragStart[1]
                ]
            };

            e.preventDefault();

            if (e.button === 0) {
                this._dragRotate(info);
            }
            else if (e.button === 2) {
                this._dragPan(info);
            }

            this._dragStart = [info.event.clientX, info.event.clientY];
        },
        'mouseup .g-voxel-vis-canvas': function () {
            this._dragStart = null;
        },
        'mousewheel .g-voxel-vis-canvas': function (e) {
            this._mouseWheel(e);
        },
        'DOMMouseScroll .g-voxel-vis-canvas': function (e) {
            this._mouseWheel(e);
        },
        'contextmenu .g-voxel-vis-canvas': function (e) {
            e.preventDefault();
        }
    },

    _dragRotate: function (info) {
        var dx = this.d2r(info.delta[0] / 3.0),
            dy = this.d2r(info.delta[1] / 3.0);

        this._xforms.rx += dx;
        this._xforms.ry += dy;
        this.draw(this.reader.getModel(), this.gl);
    },

    _mouseWheel: function (e) {
        e.preventDefault();
        var x = e.originalEvent.wheelDeltaY || e.originalEvent.detail;
        this._xforms.tz += (x > 0 ? 1.0 : -1.0);
        this.draw(this.reader.getModel(), this.gl);
    },

    initialize: function () {
        this._ready = false;
        this._shouldRender = false;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', this.model.downloadUrl(), true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
                this.reader = new VoxReader(new Uint8Array(xhr.response));
                if (this.reader.isValid()) {
                    this.reader.read();
                    this._ready = true;
                    if (this._shouldRender) {
                        this.render();
                    }
                } else {
                    console.warn('Not a valid vox file.');
                }
            };
        xhr.send();
    },

    render: function () {
        if (!this._ready) {
            this._shouldRender = true;
            return;
        }
        this.$el.html(template());

        this.renderVoxels(this.reader.getModel());
    },

    _initShaders: function (gl) {
        var program = gl.createProgram();
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        var vs = gl.createShader(gl.VERTEX_SHADER);

        gl.shaderSource(fs, fshaderSource);
        gl.shaderSource(vs, vshaderSource);
        gl.compileShader(fs);
        gl.compileShader(vs);

        gl.attachShader(program, fs);
        gl.attachShader(program, vs);

        gl.linkProgram(program);
        gl.useProgram(program);

        program.vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
        gl.enableVertexAttribArray(program.vertexPositionAttribute);
        program.vertexColorAttribute = gl.getAttribLocation(program, 'aVertexColor');
        gl.enableVertexAttribArray(program.vertexColorAttribute);

        program.pMatrixUniform = gl.getUniformLocation(program, 'uPMatrix');
        program.mvMatrixUniform = gl.getUniformLocation(program, 'uMVMatrix');

        return program;
    },

    renderVoxels: function (model) {
        this._xforms = {
            tx: model.size.x * -0.5,
            ty: model.size.y * -0.5,
            tz: model.size.z * -1.5,
            rx: 0.0,
            ry: 0.0,
            rz: 0.0
        };

        var canvas = this.$('.g-voxel-vis-canvas')[0];
        this.gl = canvas.getContext('webgl');
        this.shaderProgram = this._initShaders(this.gl);

        canvas.width = 941; // TODO
        canvas.height = 400;
        this.gl.viewportWidth = canvas.width;
        this.gl.viewportHeight = canvas.height;
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);

        this.computeBuffers(model, this.gl);
        this.draw(model, this.gl);
    },

    d2r: function (deg) {
        return deg * (Math.PI / 180.0);
    },

    draw: function (model, gl) {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var mvMatrix = mat4.create();
        var pMatrix = mat4.create();
        var xforms = this._xforms;

        mat4.perspective(pMatrix, this.d2r(60.0), gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, mvMatrix, [
            xforms.tx,
            xforms.ty,
            xforms.tz,
        ]);
        mat4.rotate(mvMatrix, mvMatrix, xforms.rx, [1, 0, 0]);
        mat4.rotate(mvMatrix, mvMatrix, xforms.ry, [0, 1, 0]);
        mat4.rotate(mvMatrix, mvMatrix, xforms.rz || 0, [0, 0, 1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, this.mesh.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshColors);
        gl.vertexAttribPointer(this.shaderProgram.vertexColorAttribute, this.meshColors.itemSize, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, pMatrix);
        gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, mvMatrix);
        gl.drawArrays(gl.POINTS, 0, this.mesh.numItems);
    },

    computeBuffers: function (model, gl) {
        this.mesh = gl.createBuffer();
        var vertices = [];
        var colors = [];
        for (var i = 0; i < model.nVoxels; i++) {
            vertices.push(model.voxels[4*i]);
            vertices.push(model.voxels[4*i+1]);
            vertices.push(model.voxels[4*i+2]);
            // TODO lookup color in palette using index model.voxels[4*i+3]
            colors.push(1.0);
            colors.push(1.0);
            colors.push(1.0);
            colors.push(1.0);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        this.mesh.itemSize = 3;
        this.mesh.numItems = vertices.length / 3;

        this.meshColors = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshColors);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        this.meshColors.itemSize = 4;
        this.meshColors.numItems = colors.length / 4;
    }
});

export default VoxelView;
