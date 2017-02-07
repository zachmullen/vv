module.exports = function (config) {
    config.module.loaders.push({
        test: /\.glsl$/,
        loader: 'shader-loader',
        include: [/plugins(\/)voxel_vis(\/)web_client/],
    });
    return config;
};
