FROM node:20.16-alpine

RUN mkdir -p /code
WORKDIR /code

COPY . /code

RUN yarn install --production && yarn cache clean
RUN yarn build

CMD ["yarn","start"]

EXPOSE 8080
