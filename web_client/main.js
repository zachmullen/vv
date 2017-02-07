import { wrap } from 'girder/utilities/PluginUtils';
import ItemView from 'girder/views/body/ItemView';
import VoxelView from './views/VoxelView';

wrap(ItemView, 'render', function (render) {
    this.once('g:rendered', function () {
        if (this.model.name().endsWith('.vox')) {
            var container = $('<div>', {
                class: 'g-voxel-render-container'
            }).insertBefore(this.$('.g-item-metadata'));

            if (!this.voxelView) {
                this.voxelView = new VoxelView({
                    parentView: this,
                    model: this.model
                });
            }
            this.voxelView.setElement(container).render();
        }
    }, this);
    return render.call(this);
});
