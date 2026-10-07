FROM node:20.16-alpine

RUN mkdir -p /code
WORKDIR /code

COPY . /code

RUN yarn install --production && yarn cache clean
RUN NODE_OPTIONS="--max-old-space-size=4096" yarn build

CMD ["./node_modules/.bin/ts-node", "--transpile-only", "./src/boot.ts"]

EXPOSE 8080
