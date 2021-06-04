module.exports = {
  apps: [
    {
      exec_mode: "cluster",
      script: "./bin/www",
      name: "mit",
      node_args: "--harmony",
      watch: false,
      error_file: "./logs/mit.err.log",
      out_file: "./logs/mit.out.log",
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
