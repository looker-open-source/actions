const { nyc } = require('@istanbuljs/schema').defaults;

module.exports = {
  "extends": "@istanbuljs/nyc-config-typescript",
  "sourceMap": true,
  "cache": false,
  "all": true,
  "include": [
    "src/**/*"
  ],
  "exclude": [
    ...nyc.exclude,
    '**/test_*.ts'
  ]
}
