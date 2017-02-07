import { mat4 } from 'gl-matrix';
import { restRequest } from 'girder/rest';
import View from 'girder/views/View';
import VoxReader from '../VoxReader';
import template from '../templates/voxelVis.pug';

import fshaderSource from '../shaders/fragment.glsl';
import vshaderSource from '../shaders/vertex.glsl';
import '../stylesheets/voxelVis.styl';

const VoxelView = View.extend({
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
        var canvas = this.$('.g-voxel-vis-canvas')[0];
        var gl = canvas.getContext('webgl');
        this.shaderProgram = this._initShaders(gl);

        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        this.computeBuffers(model, gl);
        this.draw(gl);
    },

    d2r: function (deg) {
        return deg * (Math.PI / 180.0);
    },

    draw: function (gl) {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var mvMatrix = mat4.create();
        var pMatrix = mat4.create();

        mat4.perspective(pMatrix, this.d2r(45.0), gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, mvMatrix, [-70, -70, -180]);
        mat4.rotate(mvMatrix, mvMatrix, this.d2r(60), [0, 1, 0]);
        mat4.rotate(mvMatrix, mvMatrix, this.d2r(60), [0, 0, 1]);

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
