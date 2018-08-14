FROM node:10.8.0
RUN npm install -g -s --no-progress yarn@1.9.4

RUN mkdir -p /code
WORKDIR /code

COPY package.json yarn.lock tsconfig.json tsconfig.npm.json /code/
RUN yarn install --production && yarn cache clean

COPY . /code

CMD ["yarn","start"]

EXPOSE 8080
