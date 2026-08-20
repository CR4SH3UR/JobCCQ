// Configuration Babel standard pour un projet Expo (SDK 52) + expo-router.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
