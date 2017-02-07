import { restRequest } from 'girder/rest';
import View from 'girder/views/View';
import VoxReader from '../VoxReader';
import template from '../templates/voxelVis.pug';
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

    renderVoxels: function (model) {
        var canvas = this.$('.g-voxels-vis-canvas')[0];
        var gl = canvas.getContext('webgl');
    }
});

export default VoxelView;
